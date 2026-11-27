import { jsonError } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { findClientByShareToken, getDeal, getDealDocument } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string; id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { token, id } = await context.params;
  if (!isShareToken(token)) return jsonError("File not found.", 404);
  const client = await findClientByShareToken(token);
  const document = client ? await getDealDocument(id) : null;
  const deal = document ? await getDeal(document.deal_id) : null;
  if (!client || !document || !deal || deal.client_id !== client.id) return jsonError("File not found.", 404);
  return respondWithMedia(request, document.storage_key, document.content_type, document.original_name);
}
