import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { deleteAdmin, findUserByEmail, insertAdmin, replaceAdminGrants } from "@/lib/queries";
import { isSuperAdminEmail } from "@/lib/session";
import { parseAdminAccount } from "@/lib/validators";

export const runtime = "nodejs";

function revalidateAdminViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/admins");
  revalidatePath("/admin/clients");
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const parsed = parseAdminAccount(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  if (isSuperAdminEmail(parsed.email)) {
    return jsonError("That email is already a super admin.");
  }
  if (await findUserByEmail(parsed.email)) {
    return jsonError("Someone with that email already has an account.");
  }
  const created = await insertAdmin(parsed.email, parsed.name);
  const saved = await replaceAdminGrants(created.id, parsed.propertyIds, parsed.clientIds);
  if (!saved) {
    await deleteAdmin(created.id);
    return jsonError("One of those listings or clients no longer exists.");
  }
  revalidateAdminViews();
  return NextResponse.json({ id: created.id });
}
