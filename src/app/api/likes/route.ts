import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { setListingLike } from "@/lib/queries";
import { parseLike } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return jsonError("Sign in to like a listing.", 401);
  const parsed = parseLike(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);
  const saved = await setListingLike(user.id, parsed.propertyId, parsed.liked);
  if (!saved) return jsonError("That listing isn't on this page.", 404);
  revalidatePath("/account");
  revalidatePath(`/properties/${parsed.propertyId}`);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/properties/${parsed.propertyId}`);
  return NextResponse.json({ ok: true, liked: parsed.liked });
}
