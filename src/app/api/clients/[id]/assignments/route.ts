import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserById, replaceAssignments } from "@/lib/queries";
import { parseAssignmentIds } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client") return jsonError("Client not found.", 404);
  const propertyIds = parseAssignmentIds(await request.json().catch(() => null));
  if ("error" in propertyIds) return jsonError(propertyIds.error);
  const saved = await replaceAssignments(id, propertyIds);
  if (!saved) return jsonError("One of those listings no longer exists.");
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  return NextResponse.json({ ok: true });
}
