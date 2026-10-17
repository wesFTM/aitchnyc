import "server-only";

export const OAUTH_STATE_COOKIE = "aitch_oauth_state";

export function requestOrigin(request: Request) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export function googleRedirectUri(request: Request) {
  return `${requestOrigin(request)}/api/auth/google/callback`;
}

export function readOAuthCookie(value: string | undefined) {
  if (!value) return { state: "", nextPath: "" };
  const separator = value.indexOf(":");
  if (separator === -1) return { state: value, nextPath: "" };
  return { state: value.slice(0, separator), nextPath: value.slice(separator + 1) };
}
