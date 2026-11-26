import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin, requireDashboardUser } from "@/lib/http";
import { fetchCompanyLogo, saveClientLogo } from "@/lib/company-logo";
import { clientEditor, deleteClient, findUserByEmail, findUserById, saveClientOverlay, updateClient } from "@/lib/queries";
import { deleteObject } from "@/lib/storage";
import { isSuperAdminEmail } from "@/lib/session";
import { parseClientInput } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change it.", 403);
  }
  const existing = access.client;

  const parsed = parseClientInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  if (parsed.email && isSuperAdminEmail(parsed.email)) {
    return jsonError("That email belongs to an administrator. Use the client's email instead.");
  }
  const duplicate = parsed.email ? await findUserByEmail(parsed.email) : undefined;
  if (duplicate && duplicate.id !== id) {
    return jsonError("Someone with that email already has an account.");
  }
  if (access.master) await updateClient(id, parsed);
  else await saveClientOverlay(user.id, id, parsed);
  const websiteChanged = access.master && parsed.companyWebsite !== (existing.company_website || "");
  let logoFound: boolean | null = null;
  if (websiteChanged && parsed.companyWebsite && !existing.logo_key) {
    logoFound = false;
    const logo = await fetchCompanyLogo(parsed.companyWebsite);
    if (logo) {
      await saveClientLogo(id, existing.logo_key, logo.bytes, logo.contentType);
      logoFound = true;
    }
  }
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  if (existing.share_token) revalidatePath(`/c/${existing.share_token}`);
  return NextResponse.json({ ok: true, logoFound });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await findUserById(id);
  if (!existing || existing.role !== "client") return jsonError("Client not found.", 404);
  const documentKeys = await deleteClient(id);
  const keys = existing.logo_key ? [existing.logo_key, ...documentKeys] : documentKeys;
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key);
      } catch {
        // Removing the account still succeeds if a file is already gone.
      }
    }),
  );
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
