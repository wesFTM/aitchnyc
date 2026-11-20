import { NextResponse } from "next/server";
import { isUser, jsonError, requireAdmin } from "@/lib/http";
import { listingPdfSource } from "@/lib/listing-pdf-source";
import { listImageIdsForProperties, listPropertiesByIds } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!isUser(admin)) return admin;
  const body = (await request.json().catch(() => null)) as { propertyIds?: unknown } | null;
  const ids = body?.propertyIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return jsonError("Choose at least one listing.");
  }
  const unique = [...new Set(ids)];
  if (unique.length > 40) return jsonError("Choose 40 listings or fewer.");

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
