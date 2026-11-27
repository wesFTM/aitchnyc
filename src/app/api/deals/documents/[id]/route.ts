import { jsonError } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { getCurrentUser } from "@/lib/auth";
import { dealEditor, getDeal, getDealDocument } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to open that file.", 401);
  const { id } = await context.params;
  const document = await getDealDocument(id);
  if (!document) return jsonError("File not found.", 404);
  const deal = await getDeal(document.deal_id);
  if (!deal) return jsonError("File not found.", 404);
  if (user.role === "client") {
    if (deal.client_id !== user.id) return jsonError("File not found.", 404);
  } else {
    const access = await dealEditor(user, deal.id);
    if (access === "missing" || access === "forbidden") return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, document.storage_key, document.content_type, document.original_name);
}
