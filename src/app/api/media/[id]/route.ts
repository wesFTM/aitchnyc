import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { deleteMediaRow, getMedia, userCanViewProperty } from "@/lib/queries";
import { deleteObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to view this file.", 401);
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return jsonError("File not found.", 404);
  if (user.role !== "super_admin" && !(await userCanViewProperty(user.id, media.property_id))) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, media.storage_key, media.content_type);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return jsonError("File not found.", 404);
  await deleteMediaRow(id);
  await deleteObject(media.storage_key);
  revalidatePath(`/admin/properties/${media.property_id}`);
  revalidatePath(`/properties/${media.property_id}`);
  revalidatePath("/admin");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
