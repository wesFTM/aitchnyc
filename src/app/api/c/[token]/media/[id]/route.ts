import { jsonError } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { findClientByShareToken, getMedia, userCanViewProperty } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string; id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { token, id } = await context.params;
  if (!isShareToken(token)) return jsonError("File not found.", 404);
  const client = await findClientByShareToken(token);
  if (!client) return jsonError("File not found.", 404);
  const media = await getMedia(id);
  if (!media || !(await userCanViewProperty(client.id, media.property_id))) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, media.storage_key, media.content_type);
}
