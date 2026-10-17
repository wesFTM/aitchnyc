import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionTokenFor, userForEmail } from "@/lib/auth";
import { googleRedirectUri, OAUTH_STATE_COOKIE, readOAuthCookie } from "@/lib/oauth";
import {
  SESSION_COOKIE,
  googleAuthConfigured,
  safeNextPath,
  sessionCookieOptions,
} from "@/lib/session";

function loginRedirect(request: Request, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  if (!googleAuthConfigured()) return loginRedirect(request, "google");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const stored = readOAuthCookie(jar.get(OAUTH_STATE_COOKIE)?.value);
  if (!code || !state || !stored.state || state !== stored.state) {
    return loginRedirect(request, "state");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return loginRedirect(request, "google");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return loginRedirect(request, "google");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return loginRedirect(request, "google");
  const profile = (await profileResponse.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!profile.email || profile.email_verified === false) {
    return loginRedirect(request, "google");
  }

  const user = await userForEmail(profile.email, profile.name);
  if (!user) return loginRedirect(request, "invite");

  const destination = new URL(safeNextPath(stored.nextPath, user.role), request.url);
  const response = NextResponse.redirect(destination);
  response.cookies.set(SESSION_COOKIE, await sessionTokenFor(user), sessionCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
