import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserById, setClientHidden } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client") return jsonError("Client not found.", 404);
  const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
  if (typeof body?.hidden !== "boolean") return jsonError("Choose whether to hide this client.");
  await setClientHidden(id, body.hidden);
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/admins");
  revalidatePath("/account");
  if (client.share_token) revalidatePath(`/c/${client.share_token}`);
  return NextResponse.json({ ok: true, hidden: body.hidden });
}
