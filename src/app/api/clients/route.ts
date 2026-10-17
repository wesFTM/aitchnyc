import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserByEmail, insertClient } from "@/lib/queries";
import { isSuperAdminEmail } from "@/lib/session";
import { parseClientInput } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const parsed = parseClientInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  if (isSuperAdminEmail(parsed.email)) {
    return jsonError("That email is a super admin. Invite the client's Gmail instead.");
  }
  if (await findUserByEmail(parsed.email)) {
    return jsonError("Someone with that email already has an account.");
  }
  const client = await insertClient(parsed.name, parsed.email);
  revalidatePath("/admin/clients");
  return NextResponse.json({ id: client.id });
}
