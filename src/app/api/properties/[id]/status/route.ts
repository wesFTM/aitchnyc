import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { getProperty, setPropertyStatus } from "@/lib/queries";
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
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await getProperty(id);
  if (!existing) return jsonError("Listing not found.", 404);

  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = readStatus(body?.status);
  if (typeof status !== "string") return jsonError(status.error);

  await setPropertyStatus(id, status);
  refresh(id);
  return NextResponse.json({ ok: true, status });
}
