import { jsonError } from "@/lib/http";
import { respondWithMedia } from "@/lib/media-response";
import { getCurrentUser } from "@/lib/auth";
import { getClientDocument, userCanViewProperty } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return jsonError("Sign in to open that file.", 401);
  const { id } = await context.params;
  const document = await getClientDocument(id);
  if (!document || document.client_id !== user.id || !(await userCanViewProperty(user.id, document.property_id))) {
    return jsonError("File not found.", 404);
  }
  return respondWithMedia(request, document.storage_key, document.content_type, document.original_name);
}
