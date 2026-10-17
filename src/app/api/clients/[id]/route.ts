import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { deleteClient, findUserByEmail, findUserById, updateClient } from "@/lib/queries";
import { isSuperAdminEmail } from "@/lib/session";
import { parseClientInput } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "client") return jsonError("Client not found.", 404);

  const parsed = parseClientInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  if (isSuperAdminEmail(parsed.email)) {
    return jsonError("That email is a super admin. Invite the client's Gmail instead.");
  }
  const duplicate = await findUserByEmail(parsed.email);
  if (duplicate && duplicate.id !== id) {
    return jsonError("Someone with that email already has an account.");
  }
  await updateClient(id, parsed.name, parsed.email);
  revalidatePath("/admin/clients");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "client") return jsonError("Client not found.", 404);
  await deleteClient(id);
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
