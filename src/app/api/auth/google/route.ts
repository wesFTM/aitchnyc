import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { googleRedirectUri, OAUTH_STATE_COOKIE } from "@/lib/oauth";
import { googleAuthConfigured } from "@/lib/session";

export async function GET(request: Request) {
  if (!googleAuthConfigured()) {
    return jsonError("Google sign-in is not configured yet.", 503);
  }
  const state = crypto.randomUUID();
  const next = new URL(request.url).searchParams.get("next") || "";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}:${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
