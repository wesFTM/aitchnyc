import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { setTourRequest } from "@/lib/queries";
import { parseTour } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return jsonError("Sign in to request a tour.", 401);
  const parsed = parseTour(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const saved = await setTourRequest(user.id, parsed.propertyId, parsed.requested);
  if (!saved) return jsonError("Like this listing before requesting a tour.", 404);
  revalidatePath("/account");
  revalidatePath(`/properties/${parsed.propertyId}`);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${parsed.propertyId}`);
  return NextResponse.json({ ok: true, requested: parsed.requested });
}
