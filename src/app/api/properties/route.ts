import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { geocodeAddress } from "@/lib/geocode";
import { isUser, jsonError, requireDashboardUser } from "@/lib/http";
import { publishProperty } from "@/lib/queries";
import { parsePropertyInput } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireDashboardUser();
  if (!isUser(user)) return user;

  const parsed = parsePropertyInput(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);

  const coords = await geocodeAddress(parsed.address);
  const id = await publishProperty(user, parsed, coords);
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
  return NextResponse.json({ id, geocoded: Boolean(coords) });
}
