import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin, sniffMedia } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { findUserById, setAdminAvatar } from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

function revalidateAvatar(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${id}`);
}

export async function GET(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const user = await findUserById(id);
  if (!user || user.role !== "admin" || !user.logo_key || !user.logo_content_type) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, user.logo_key, user.logo_content_type);
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "admin") return jsonError("Admin not found.", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a profile photo.");
  if (file.size <= 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Profile photos need to be 2MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(bytes);
  if (!sniffed || sniffed.kind !== "image") return jsonError("Upload a JPEG, PNG, WebP, or GIF.");

  const key = `admins/${id}/avatar/${crypto.randomUUID()}`;
  await putObject(key, bytes, sniffed.contentType);
  await setAdminAvatar(id, key, sniffed.contentType);
  if (existing.logo_key && existing.logo_key !== key) {
    try {
      await deleteObject(existing.logo_key);
    } catch {
      // A leftover photo does not affect the page.
    }
  }
  revalidateAvatar(id);
  return NextResponse.json({ avatarKey: key });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "admin") return jsonError("Admin not found.", 404);
  await setAdminAvatar(id, null, null);
  if (existing.logo_key) {
    try {
      await deleteObject(existing.logo_key);
    } catch {
      // The photo is already gone.
    }
  }
  revalidateAvatar(id);
  return NextResponse.json({ ok: true });
}
