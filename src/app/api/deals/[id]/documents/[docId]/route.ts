import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { dealEditor, deleteDealDocument, getDealDocument } from "@/lib/queries";
import { revalidateDealClient } from "@/lib/revalidate-deal";
import { deleteObject } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing" || access === "forbidden") return jsonError("File not found.", 404);
  const document = await getDealDocument(docId);
  if (!document || document.deal_id !== id) return jsonError("File not found.", 404);
  return respondWithMedia(request, document.storage_key, document.content_type, document.original_name);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id, docId } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing") return jsonError("Deal not found.", 404);
  if (access === "forbidden") return jsonError("You can't change that deal.", 403);
  const document = await getDealDocument(docId);
  if (!document || document.deal_id !== id) return jsonError("File not found.", 404);
  const key = await deleteDealDocument(docId);
  if (key) {
    try {
      await deleteObject(key);
    } catch {
      // The row is already gone if the file was removed earlier.
    }
  }
  await revalidateDealClient(access.deal.client_id);
  return NextResponse.json({ ok: true });
}
