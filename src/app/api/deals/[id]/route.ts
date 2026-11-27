import { NextResponse } from "next/server";
import { dealWriteError } from "@/lib/deal-access";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { dealEditor, deleteDeal, updateDeal } from "@/lib/queries";
import { revalidateDealClient } from "@/lib/revalidate-deal";
import { deleteObject } from "@/lib/storage";
import { parseDealInput } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing") return jsonError("Deal not found.", 404);
  if (access === "forbidden") return jsonError("You can't change that deal.", 403);
  const parsed = parseDealInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const writeError = await dealWriteError(user, parsed, {
    clientId: access.deal.client_id,
    propertyId: access.deal.property_id,
  });
  if (writeError) return jsonError(writeError);
  const saved = await updateDeal(id, parsed);
  await revalidateDealClient(access.deal.client_id);
  if (saved && saved.client_id !== access.deal.client_id) await revalidateDealClient(saved.client_id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await dealEditor(user, id);
  if (access === "missing") return jsonError("Deal not found.", 404);
  if (access === "forbidden") return jsonError("You can't change that deal.", 403);
  const keys = await deleteDeal(id);
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key);
      } catch {
        // The deal is already gone if a file was removed earlier.
      }
    }),
  );
  await revalidateDealClient(access.deal.client_id);
  return NextResponse.json({ ok: true });
}
