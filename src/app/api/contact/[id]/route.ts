import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deleteContactInquiry } from "@/lib/contact-store";
import { isUser, jsonError, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const removed = await deleteContactInquiry(id);
  if (!removed) return jsonError("Message not found.", 404);
  revalidatePath("/admin");
  return NextResponse.json({ ok: true });
}
