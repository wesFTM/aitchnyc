import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserById, setStreetNumberHidden } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client") return jsonError("Client not found.", 404);
  const body = (await request.json().catch(() => null)) as { propertyId?: unknown; hidden?: unknown } | null;
  if (typeof body?.propertyId !== "string" || !body.propertyId) return jsonError("Choose a listing.");
  if (typeof body.hidden !== "boolean") return jsonError("Choose whether to hide the street number.");
  const propertyId = body.propertyId;
  const saved = await setStreetNumberHidden(id, propertyId, body.hidden);
  if ("error" in saved) return jsonError(saved.error ?? "Could not update the street number.", saved.status);
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  revalidatePath(`/properties/${propertyId}`);
  if (client.share_token) {
    revalidatePath(`/c/${client.share_token}`);
    revalidatePath(`/c/${client.share_token}/listings/${propertyId}`);
  }
  return NextResponse.json({ ok: true, hidden: saved.hidden });
}
