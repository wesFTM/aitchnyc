import "server-only";

import { clientForDeal, propertyForDeal, staffForDeal } from "@/lib/queries";
import type { DealInput, User } from "@/lib/types";

export async function dealWriteError(
  user: User,
  input: DealInput,
  current: { clientId: string | null; propertyId: string | null } | null,
) {
  const client = await clientForDeal(user, input.clientId, current?.clientId ?? null);
  if (!client) return "Choose a client from your list.";
  if (!(await staffForDeal(input.leadAgentId))) return "Choose a lead agent.";
  if (!(await propertyForDeal(user, input.propertyId, current?.propertyId ?? null))) {
    return "Choose a listing from your list.";
  }
  return null;
}
