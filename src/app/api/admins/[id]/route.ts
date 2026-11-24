import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { deleteAdmin, findUserByEmail, findUserById, replaceAdminGrants, updateAdmin } from "@/lib/queries";
import { deleteObject } from "@/lib/storage";
import { isSuperAdminEmail } from "@/lib/session";
import { parseAdminAccount } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function revalidateAdminViews(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${id}`);
  revalidatePath("/admin/clients");
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "admin") return jsonError("Admin not found.", 404);
  const parsed = parseAdminAccount(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  if (isSuperAdminEmail(parsed.email)) {
    return jsonError("That email is already a super admin.");
  }
  const duplicate = await findUserByEmail(parsed.email);
  if (duplicate && duplicate.id !== id) {
    return jsonError("Someone with that email already has an account.");
  }
  if (parsed.updateAccess) {
    const saved = await replaceAdminGrants(id, parsed.propertyIds, parsed.clientIds);
    if (!saved) return jsonError("One of those listings or clients no longer exists.");
  }
  await updateAdmin(id, parsed.email, parsed.name);
  revalidateAdminViews(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "admin") return jsonError("Admin not found.", 404);
  if (existing.logo_key) {
    try {
      await deleteObject(existing.logo_key);
    } catch {
      // Removing the admin still succeeds if the photo is already gone.
    }
  }
  await deleteAdmin(id);
  revalidateAdminViews(id);
  return NextResponse.json({ ok: true });
}
