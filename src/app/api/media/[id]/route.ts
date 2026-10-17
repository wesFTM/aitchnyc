import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { deleteMediaRow, getMedia, userCanViewProperty } from "@/lib/queries";
import { deleteObject, objectSize, readObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return null;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(size - suffix, 0);
    return { start, end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to view this file.", 401);
  const { id } = await context.params;
  const media = await getMedia(id);
  if (!media) return jsonError("File not found.", 404);
  if (user.role !== "super_admin" && !(await userCanViewProperty(user.id, media.property_id))) {
    return jsonError("File not found.", 404);
  }

  const size = await objectSize(media.storage_key);
  if (size == null) return jsonError("File not found.", 404);

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : { start: 0, end: size - 1 };
  if (!range) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const bytes = await readObject(media.storage_key, range.start, range.end);
  if (!bytes) return jsonError("File not found.", 404);

  const headers = new Headers({
    "Content-Type": media.content_type,
    "Content-Length": String(bytes.byteLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  const status = rangeHeader ? 206 : 200;
  if (rangeHeader) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  }
  return new NextResponse(Buffer.from(bytes), { status, headers });
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
