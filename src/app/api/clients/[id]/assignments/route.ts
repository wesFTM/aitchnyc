import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { clientEditor, replaceAdminClientPicks, replaceAssignments } from "@/lib/queries";
import { parseAssignmentIds } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await clientEditor(user, id);
  if (access === "missing") return jsonError("Client not found.", 404);
  if (access === "forbidden") {
    return jsonError("That client is on the master list. Only a super admin can change their listings.", 403);
  }
  const propertyIds = parseAssignmentIds(await request.json().catch(() => null));
  if ("error" in propertyIds) return jsonError(propertyIds.error);
  const saved = access.master
    ? await replaceAssignments(id, propertyIds)
    : await replaceAdminClientPicks(user.id, id, propertyIds);
  if (!saved) {
    return jsonError(access.master ? "One of those listings no longer exists." : "Choose listings from your list.");
  }
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  if (access.client.share_token) revalidatePath(`/c/${access.client.share_token}`);
  return NextResponse.json({ ok: true });
}
