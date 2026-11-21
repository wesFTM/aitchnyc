import { jsonError } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { findClientByShareToken } from "@/lib/queries";
import { isShareToken } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!isShareToken(token)) return jsonError("File not found.", 404);
  const client = await findClientByShareToken(token);
  if (!client?.logo_key || !client.logo_content_type) return jsonError("File not found.", 404);
  return respondWithMedia(request, client.logo_key, client.logo_content_type);
}
