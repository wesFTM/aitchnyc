import "server-only";

export const OAUTH_STATE_COOKIE = "aitch_oauth_state";

function isLocalOrigin(origin: string) {
  return origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
}

export function requestOrigin(request: Request) {
  const fromRequest = new URL(request.url).origin;
  const configured = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!configured) return fromRequest;
  if (isLocalOrigin(configured) && !isLocalOrigin(fromRequest)) return fromRequest;
  return configured;
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
