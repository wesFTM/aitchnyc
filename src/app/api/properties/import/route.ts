import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { emptyAmenities } from "@/lib/amenities";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin, sniffMedia } from "@/lib/http";
import type { SetupDraft } from "@/lib/meridian-listing";
import { insertMedia, insertProperty, nextImageSort } from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";
import { parsePropertyInput } from "@/lib/validators";

export const runtime = "nodejs";

const MAX_SAVED_IMAGES = 8;
const MAX_SAVED_IMAGE_BYTES = 2_000_000;

function textField(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function readImport(request: Request) {
  const form = await request.formData();
  const raw = form.get("draft");
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Couldn't read that flyer.");
  let parsedDraft: Partial<SetupDraft>;
  try {
    parsedDraft = JSON.parse(raw) as Partial<SetupDraft>;
  } catch {
    throw new Error("Couldn't read that flyer.");
  }
  const draft: SetupDraft = {
    address: textField(parsedDraft.address),
    neighborhood: textField(parsedDraft.neighborhood),
    price: textField(parsedDraft.price),
    sqft: textField(parsedDraft.sqft),
    totalSqft: textField(parsedDraft.totalSqft),
    possession: textField(parsedDraft.possession),
    terms: textField(parsedDraft.terms),
    frontage: textField(parsedDraft.frontage),
    ceilingHeight: textField(parsedDraft.ceilingHeight),
    description: textField(parsedDraft.description),
    neighboringTenants: textField(parsedDraft.neighboringTenants),
    keyMoney: textField(parsedDraft.keyMoney),
  };
  if (!draft.address.trim()) throw new Error("Couldn't find an address in that PDF.");
  const images: Uint8Array[] = [];
  for (const entry of form.getAll("image")) {
    if (!(entry instanceof File) || images.length >= MAX_SAVED_IMAGES) continue;
    if (entry.size <= 0 || entry.size > MAX_SAVED_IMAGE_BYTES) continue;
    images.push(new Uint8Array(await entry.arrayBuffer()));
  }
  return { draft, images };
}

export async function POST(request: Request) {
  try {
    return await importListing(request);
  } catch (error) {
    console.error("Listing import failed.", error);
    return jsonError("Couldn't save that flyer.");
  }
}

async function importListing(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;

  let imported: { draft: SetupDraft; images: Uint8Array[] };
  try {
    imported = await readImport(request);
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
        originalName: `imported-${imageCount + 1}.${sniffed.contentType === "image/png" ? "png" : sniffed.contentType === "image/webp" ? "webp" : sniffed.contentType === "image/gif" ? "gif" : "jpg"}`,
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
