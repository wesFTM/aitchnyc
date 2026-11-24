import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireAdmin, requireDashboardUser } from "@/lib/http";
import { deleteProperty, getProperty, listingEditor, propertyForEditor, saveListingOverlay, updateProperty } from "@/lib/queries";
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
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;
  const { id } = await context.params;
  const access = await listingEditor(user, id);
  if (access === "missing") return jsonError("Listing not found.", 404);
  if (access === "forbidden") {
    return jsonError("That listing is on the master list. Only a super admin can change it.", 403);
  }
  const existing = access.master ? access.property : await propertyForEditor(user.id, access.property);

  const parsed = parsePropertyInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);

  const addressChanged = existing.address.trim() !== parsed.address;
  let coords = existing.lat != null && existing.lng != null ? { lat: existing.lat, lng: existing.lng } : null;
  let geocoded = Boolean(coords);
  if (addressChanged || !coords) {
    coords = await geocodeAddress(parsed.address);
    geocoded = Boolean(coords);
  }

  if (access.master) await updateProperty(id, parsed, coords);
  else await saveListingOverlay(user.id, id, parsed, coords);
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
