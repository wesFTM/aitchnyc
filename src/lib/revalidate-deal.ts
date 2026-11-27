import "server-only";

import { revalidatePath } from "next/cache";
import { findUserById } from "@/lib/queries";

export async function revalidateDealClient(clientId: string) {
  revalidatePath("/admin/deals");
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  const client = await findUserById(clientId);
  if (client?.share_token) revalidatePath(`/c/${client.share_token}`);
}
