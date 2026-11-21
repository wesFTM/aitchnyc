import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin, sniffMedia } from "@/lib/http";
import { insertMedia, insertProperty, nextImageSort } from "@/lib/queries";
import { loadStreetEasyRental, StreetEasyImportError } from "@/lib/streeteasy-listing";
import { deleteObject, putObject } from "@/lib/storage";
import { parsePropertyInput } from "@/lib/validators";

export const runtime = "nodejs";

function imageName(contentType: string, index: number) {
  const extension =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/gif" ? "gif" : "jpg";
  return `streeteasy-${index + 1}.${extension}`;
}

const MAX_CLIENT_IMAGES = 30;
const MAX_CLIENT_IMAGE_CHARS = 2_800_000;

type ClientDraft = {
  address?: unknown;
  unit?: unknown;
  price?: unknown;
  neighborhood?: unknown;
  sqft?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  amenities?: unknown;
  description?: unknown;
  status?: unknown;
};

function decodeImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  const images: Uint8Array[] = [];
  for (const item of value.slice(0, MAX_CLIENT_IMAGES)) {
    if (typeof item !== "string" || item.length === 0 || item.length > MAX_CLIENT_IMAGE_CHARS) continue;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item)) continue;
    try {
      const binary = atob(item);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      images.push(bytes);
    } catch {
      continue;
    }
  }
  return images;
}

async function saveListing(input: Parameters<typeof parsePropertyInput>[0], images: Uint8Array[]) {
  const parsed = parsePropertyInput(input);
  if ("error" in parsed) return jsonError(parsed.error);

  const coords = await geocodeAddress(parsed.address);
  const id = await insertProperty(parsed, coords);
  let imageCount = 0;
  for (const bytes of images) {
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
      console.error("Could not store a StreetEasy photo.", error);
      await deleteObject(storageKey).catch(() => undefined);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath(`/properties/${id}`);
  return NextResponse.json({ id, geocoded: Boolean(coords), imageCount });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;

  const body = (await request.json().catch(() => null)) as { url?: unknown; draft?: ClientDraft; images?: unknown } | null;
  try {
    if (body?.draft && typeof body.draft === "object") {
      const draft = body.draft;
      return await saveListing(
        {
          address: draft.address,
          unit: draft.unit,
          price: draft.price,
          listingType: "rental",
          neighborhood: draft.neighborhood,
          sqft: draft.sqft,
          bedrooms: draft.bedrooms,
          bathrooms: draft.bathrooms,
          amenities: draft.amenities,
          description: draft.description,
          status: draft.status,
        },
        decodeImages(body.images),
      );
    }

    const url = typeof body?.url === "string" ? body.url : "";
    if (!url.trim()) return jsonError("Paste a StreetEasy rental link.");
    const imported = await loadStreetEasyRental(url);
    return await saveListing(
      {
        address: imported.address,
        unit: imported.unit,
        price: imported.price,
        listingType: "rental",
        neighborhood: imported.neighborhood,
        sqft: imported.sqft,
        bedrooms: imported.bedrooms,
        bathrooms: imported.bathrooms,
        amenities: imported.amenities,
        description: imported.description,
        status: imported.status,
      },
      imported.images,
    );
  } catch (error) {
    if (error instanceof StreetEasyImportError) return jsonError(error.message);
    console.error("StreetEasy import failed.", error);
    return jsonError("Couldn't save that listing.");
  }
}
