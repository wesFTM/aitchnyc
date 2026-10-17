import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { getMedia, makeCover } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media || media.kind !== "image") return jsonError("Choose a photo to use as the cover.", 404);
  const updated = await makeCover(media.property_id, media.id);
  if (!updated) return jsonError("Choose a photo to use as the cover.", 404);
  revalidatePath(`/admin/properties/${media.property_id}`);
  revalidatePath(`/properties/${media.property_id}`);
  revalidatePath("/admin");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
