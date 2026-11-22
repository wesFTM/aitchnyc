import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { findClientByShareToken, setTourRequest } from "@/lib/queries";
import { isShareToken } from "@/lib/share";
import { parseTour } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!isShareToken(token)) return jsonError("Page not found.", 404);
  const client = await findClientByShareToken(token);
  if (!client) return jsonError("Page not found.", 404);
  const parsed = parseTour(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const saved = await setTourRequest(client.id, parsed.propertyId, parsed.requested);
  if (!saved) return jsonError("Like this listing before requesting a tour.", 404);
  revalidatePath(`/c/${token}`);
  revalidatePath(`/c/${token}/listings/${parsed.propertyId}`);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${parsed.propertyId}`);
  return NextResponse.json({ ok: true, requested: parsed.requested });
}
