import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { emptyAmenities } from "@/lib/amenities";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin, sniffMedia } from "@/lib/http";
import { fetchListingPdf, readSetupPdf } from "@/lib/import-listing";
import { insertMedia, insertProperty, nextImageSort } from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";
import { parsePropertyInput } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) return jsonError("Paste a link to a listing PDF.");

  let imported;
  try {
    imported = await readSetupPdf(await fetchListingPdf(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't read that listing.";
    return jsonError(message);
  }

  const draft = imported.draft;
  const parsed = parsePropertyInput({
    address: draft.address,
    unit: "",
    price: draft.price,
    listingType: "commercial",
    neighborhood: draft.neighborhood,
    sqft: draft.sqft,
    sqftOptional: draft.totalSqft,
    bedrooms: "",
    bathrooms: "",
    amenities: emptyAmenities(),
    description: draft.description,
    status: "active",
    keyMoney: draft.keyMoney,
    possession: draft.possession,
    terms: draft.terms,
    frontage: draft.frontage,
    ceilingHeight: draft.ceilingHeight,
    neighboringTenants: draft.neighboringTenants,
  });
  if ("error" in parsed) return jsonError(parsed.error);

  const coords = await geocodeAddress(parsed.address);
  const id = await insertProperty(parsed, coords);
  let imageCount = 0;
  for (const bytes of imported.images) {
    const sniffed = sniffMedia(bytes);
    if (!sniffed || sniffed.kind !== "image") continue;
    const mediaId = crypto.randomUUID();
    const storageKey = `${id}/${mediaId}`;
    try {
      await putObject(storageKey, bytes, sniffed.contentType);
      await insertMedia({
        id: mediaId,
        propertyId: id,
        kind: "image",
        storageKey,
        contentType: sniffed.contentType,
        originalName: `imported-${imageCount + 1}.jpg`,
        sortOrder: await nextImageSort(id),
      });
      imageCount += 1;
    } catch (error) {
      console.error("Could not store an imported photo.", error);
      await deleteObject(storageKey).catch(() => undefined);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath(`/properties/${id}`);
  return NextResponse.json({ id, geocoded: Boolean(coords), imageCount });
}
