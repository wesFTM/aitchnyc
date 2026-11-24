import { NextResponse } from "next/server";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { listingPdfSource } from "@/lib/listing-pdf-source";
import { adminCanViewProperties, listImageIdsForProperties, listPropertiesByIds } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireDashboardUser();
  if (!isUser(admin)) return admin;
  const body = (await request.json().catch(() => null)) as { propertyIds?: unknown } | null;
  const ids = body?.propertyIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return jsonError("Choose at least one listing.");
  }
  const unique = [...new Set(ids)];
  if (unique.length > 40) return jsonError("Choose 40 listings or fewer.");
  if (admin.role === "admin" && !(await adminCanViewProperties(admin.id, unique))) {
    return jsonError("One of those listings isn't on your dashboard.", 403);
  }

  const properties = await listPropertiesByIds(unique);
  if (properties.length === 0) return jsonError("Those listings are no longer available.");
  const images = await listImageIdsForProperties(properties.map((property) => property.id));
  const byProperty = new Map<string, string[]>();
  for (const image of images) {
    const current = byProperty.get(image.property_id) ?? [];
    current.push(image.id);
    byProperty.set(image.property_id, current);
  }

  return NextResponse.json({
    listings: properties.map((property) =>
      listingPdfSource(property, byProperty.get(property.id) ?? [], (id) => `/api/media/${id}`),
    ),
  });
}
