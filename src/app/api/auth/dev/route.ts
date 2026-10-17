import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { userForEmail, sessionTokenFor } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import {
  SESSION_COOKIE,
  devAuthEnabled,
  safeNextPath,
  sessionCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!devAuthEnabled()) return jsonError("Dev sign-in is off.", 404);
  const body = (await request.json().catch(() => null)) as { email?: string; next?: string } | null;
  const user = await userForEmail(body?.email || "");
  if (!user) {
    return jsonError("That email is not a super admin or an invited client.", 403);
  }
  const response = NextResponse.json({
    ok: true,
    role: user.role,
    next: safeNextPath(body?.next, user.role),
  });
  response.cookies.set(SESSION_COOKIE, await sessionTokenFor(user), sessionCookieOptions());
  revalidatePath("/", "layout");
  return response;
}
