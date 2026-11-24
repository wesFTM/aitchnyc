import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { openListingPdf } from "@/lib/import-listing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireDashboardUser();
  if (!isUser(admin)) return admin;
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) return jsonError("Paste a link to a listing PDF.");
  try {
    return await openListingPdf(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't download that flyer.";
    return jsonError(message);
  }
}
