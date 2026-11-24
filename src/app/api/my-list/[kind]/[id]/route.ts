import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { adminCanViewClient, adminCanViewProperty, removeAdminClientGrant, removeAdminListingGrant } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ kind: string; id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  if (user.role !== "admin") return jsonError("Only an admin can take something off their own list.", 403);
  const { kind, id } = await context.params;
  if (kind === "listing") {
    if (!(await adminCanViewProperty(user.id, id))) return jsonError("That listing is not on your list.", 404);
    await removeAdminListingGrant(user.id, id);
  } else if (kind === "client") {
    if (!(await adminCanViewClient(user.id, id))) return jsonError("That client is not on your list.", 404);
    await removeAdminClientGrant(user.id, id);
  } else {
    return jsonError("Not found.", 404);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/admins");
  return NextResponse.json({ ok: true });
}
