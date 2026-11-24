import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { listingEditor, saveListingStatusOverlay, setPropertyStatus } from "@/lib/queries";
import type { ListingStatus } from "@/lib/types";

const LISTING_STATUSES: ListingStatus[] = ["active", "leased", "pending", "inactive"];

function readStatus(value: unknown): ListingStatus | { error: string } {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "rented" || raw === "sold") return "leased";
  if (LISTING_STATUSES.includes(raw as ListingStatus)) return raw as ListingStatus;
  return { error: "Choose Active, Leased, Pending, or Inactive." };
}

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function refresh(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  revalidatePath("/account");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath(`/properties/${id}`);
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await listingEditor(user, id);
  if (access === "missing") return jsonError("Listing not found.", 404);
  if (access === "forbidden") {
    return jsonError("That listing is on the master list. Only a super admin can change it.", 403);
  }

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = readStatus(body?.status);
  if (typeof status !== "string") return jsonError(status.error);

  if (access.master) await setPropertyStatus(id, status);
  else await saveListingStatusOverlay(user.id, access.property, status);
  refresh(id);
  return NextResponse.json({ ok: true, status });
}
