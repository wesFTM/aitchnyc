import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { deleteMediaRow, getMedia, listingEditor, userCanSeeProperty } from "@/lib/queries";
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
  if (!(await userCanSeeProperty(user, media.property_id))) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, media.storage_key, media.content_type);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return jsonError("File not found.", 404);
  const access = await listingEditor(user, media.property_id);
  if (access === "missing") return jsonError("File not found.", 404);
  if (access === "forbidden") {
    return jsonError("That listing is on the master list. Only a super admin can change its photos.", 403);
  }
  await deleteMediaRow(id);
  await deleteObject(media.storage_key);
  revalidatePath(`/admin/properties/${media.property_id}`);
  revalidatePath(`/properties/${media.property_id}`);
  revalidatePath("/admin");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
