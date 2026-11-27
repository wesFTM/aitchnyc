import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { dealEditor } from "@/lib/queries";
import { revalidateDealClient } from "@/lib/revalidate-deal";
import type { DealStatus } from "@/lib/types";

export const runtime = "nodejs";

const DEAL_STATUSES: DealStatus[] = ["in_process", "closed", "complete"];

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing") return jsonError("Deal not found.", 404);
  if (access === "forbidden") return jsonError("You can't change that deal.", 403);

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  if (!DEAL_STATUSES.includes(status as DealStatus)) {
    return jsonError("Choose In-Process, Closed, or Complete.");
  }

  const db = await getDb();
  await db.run("UPDATE deals SET status = ?, updated_at = datetime('now') WHERE id = ?", status, id);
  await revalidateDealClient(access.deal.client_id);
  return NextResponse.json({ ok: true, status });
}
