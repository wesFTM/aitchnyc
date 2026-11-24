import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { findUserById, setClientFlag } from "@/lib/queries";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const client = await findUserById(id);
  if (!client || client.role !== "client") return jsonError("Client not found.", 404);
  const body = (await request.json().catch(() => null)) as { flagged?: unknown; note?: unknown } | null;
  if (typeof body?.flagged !== "boolean") return jsonError("Choose whether to flag this client.");
  const note = typeof body.note === "string" ? body.note.slice(0, 280) : "";
  await setClientFlag(id, body.flagged, note);
  revalidatePath("/admin/clients");
  return NextResponse.json({ ok: true, flagged: body.flagged });
}
