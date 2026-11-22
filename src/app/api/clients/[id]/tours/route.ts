import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserById, scheduleTour } from "@/lib/queries";
import { parseTourSchedule } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client") return jsonError("Client not found.", 404);
  const parsed = parseTourSchedule(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const saved = await scheduleTour(client.id, parsed.propertyId, parsed.scheduledAt);
  if (!saved) return jsonError("This client has not requested a tour of that listing.", 404);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${parsed.propertyId}`);
  revalidatePath("/account");
  revalidatePath(`/properties/${parsed.propertyId}`);
  if (client.share_token) {
    revalidatePath(`/c/${client.share_token}`);
    revalidatePath(`/c/${client.share_token}/listings/${parsed.propertyId}`);
  }
  return NextResponse.json({ ok: true, scheduledAt: parsed.scheduledAt });
}
