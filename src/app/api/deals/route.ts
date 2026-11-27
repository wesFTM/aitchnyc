import { NextResponse } from "next/server";
import { dealWriteError } from "@/lib/deal-access";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { insertDeal } from "@/lib/queries";
import { revalidateDealClient } from "@/lib/revalidate-deal";
import { parseDealInput } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const parsed = parseDealInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const writeError = await dealWriteError(user, parsed, null);
  if (writeError) return jsonError(writeError);
  const deal = await insertDeal(parsed, user.id);
  await revalidateDealClient(deal.client_id);
  return NextResponse.json({ id: deal.id });
}
