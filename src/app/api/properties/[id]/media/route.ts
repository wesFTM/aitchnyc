import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser, sniffMedia } from "@/lib/http";
import {
  countImages,
  deleteMediaRow,
  existingVideo,
  insertMedia,
  listingEditor,
  nextImageSort,
} from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_IMAGES = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await listingEditor(user, id);
  if (access === "missing") return jsonError("Listing not found.", 404);
  if (access === "forbidden") {
    return jsonError("That listing is on the master list. Only a super admin can change its photos.", 403);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a photo or video.");
  if (file.size <= 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Files need to be 60MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(bytes);
  if (!sniffed) return jsonError("Upload a JPEG, PNG, WebP, GIF, MP4, MOV, or WebM file.");

  const mediaId = crypto.randomUUID();
  const storageKey = `${id}/${mediaId}`;

  if (sniffed.kind === "image") {
    if ((await countImages(id)) >= MAX_IMAGES) {
      return jsonError(`A listing can have up to ${MAX_IMAGES} photos.`);
    }
  } else {
    const previous = await existingVideo(id);
    if (previous) {
      await deleteMediaRow(previous.id);
      await deleteObject(previous.storage_key);
    }
  }

  await putObject(storageKey, bytes, sniffed.contentType);
  await insertMedia({
    id: mediaId,
    propertyId: id,
    kind: sniffed.kind,
    storageKey,
    contentType: sniffed.contentType,
    originalName: file.name.slice(0, 180),
    sortOrder: sniffed.kind === "image" ? await nextImageSort(id) : 0,
  });

  revalidatePath(`/admin/properties/${id}`);
  revalidatePath(`/properties/${id}`);
  revalidatePath("/admin");
  revalidatePath("/account");
  return NextResponse.json({ id: mediaId, kind: sniffed.kind });
}
