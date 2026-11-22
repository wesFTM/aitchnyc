import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { findClientByShareToken, setListingLike } from "@/lib/queries";
import { isShareToken } from "@/lib/share";
import { parseLike } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!isShareToken(token)) return jsonError("Page not found.", 404);
  const client = await findClientByShareToken(token);
  if (!client) return jsonError("Page not found.", 404);
  const parsed = parseLike(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const saved = await setListingLike(client.id, parsed.propertyId, parsed.liked);
  if (!saved) return jsonError("That listing isn't on this page.", 404);
  revalidatePath(`/c/${token}`);
  revalidatePath(`/c/${token}/listings/${parsed.propertyId}`);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${parsed.propertyId}`);
  return NextResponse.json({ ok: true, liked: parsed.liked });
}
