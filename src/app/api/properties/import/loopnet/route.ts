import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin, sniffMedia } from "@/lib/http";
import { loadLoopNetListing, LoopNetImportError } from "@/lib/loopnet-listing";
import { deleteObject, putObject } from "@/lib/storage";
import { insertMedia, insertProperty, nextImageSort } from "@/lib/queries";
import { parsePropertyInput } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 120;

function imageName(contentType: string, index: number) {
  const extension =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/gif" ? "gif" : "jpg";
  return `loopnet-${index + 1}.${extension}`;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) return jsonError("Paste a LoopNet listing link.");

  try {
    const imported = await loadLoopNetListing(url);
    const parsed = parsePropertyInput({
      address: imported.address,
      unit: imported.unit,
      price: imported.price,
      listingType: imported.listingType,
      neighborhood: imported.neighborhood,
      sqft: imported.sqft,
      sqftOptional: imported.sqftOptional,
      bedrooms: "",
      bathrooms: "",
      amenities: null,
      description: imported.description,
      status: imported.status,
      keyMoney: imported.keyMoney,
      possession: imported.possession,
      terms: imported.terms,
      frontage: imported.frontage,
      ceilingHeight: imported.ceilingHeight,
      neighboringTenants: imported.neighboringTenants,
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
          originalName: imageName(sniffed.contentType, imageCount),
          sortOrder: await nextImageSort(id),
        });
        imageCount += 1;
      } catch (error) {
        console.error("Could not store a LoopNet photo.", error);
        await deleteObject(storageKey).catch(() => undefined);
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/properties/${id}`);
    revalidatePath(`/properties/${id}`);
    return NextResponse.json({ id, geocoded: Boolean(coords), imageCount });
  } catch (error) {
    if (error instanceof LoopNetImportError) return jsonError(error.message);
    console.error("LoopNet import failed.", error);
    return jsonError("Couldn't save that listing.");
  }
}
