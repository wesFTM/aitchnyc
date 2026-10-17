import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { deleteProperty, getProperty, updateProperty } from "@/lib/queries";
import { deleteObject } from "@/lib/storage";
import { parsePropertyInput } from "@/lib/validators";

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

  const parsed = parsePropertyInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);

  const addressChanged = existing.address.trim() !== parsed.address;
  let coords = existing.lat != null && existing.lng != null ? { lat: existing.lat, lng: existing.lng } : null;
  let geocoded = Boolean(coords);
  if (addressChanged || !coords) {
    coords = await geocodeAddress(parsed.address);
    geocoded = Boolean(coords);
  }

  await updateProperty(id, parsed, coords);
  refresh(id);
  return NextResponse.json({ ok: true, geocoded });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const { id } = await context.params;
  const existing = await getProperty(id);
  if (!existing) return jsonError("Listing not found.", 404);
  const media = await deleteProperty(id);
  await Promise.all(media.map((item) => deleteObject(item.storage_key)));
  refresh(id);
  return NextResponse.json({ ok: true });
}
