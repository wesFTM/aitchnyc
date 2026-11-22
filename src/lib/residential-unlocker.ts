import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

const BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request";
const OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";
const DEFAULT_ZONE = "streeteasy_listingtool";
const TIMEOUT_MS = 55000;

export type UnlockerDownload = { status: number; body: string };
export type UnlockerFailure = { error: "credentials" | "config" | "network" };

type BrightDataCreds = { kind: "brightdata"; token: string; zone: string };
type OxylabsCreds = { kind: "oxylabs"; username: string; password: string };
type UnlockerCreds = BrightDataCreds | OxylabsCreds;

async function envString(name: string) {
  const fromProcess = process.env[name]?.trim() || "";
  if (fromProcess) return fromProcess;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = env[name as keyof CloudflareEnv];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

export async function unlockerConfigured() {
  return Boolean(await unlockerCredentials());
}

async function unlockerCredentials(): Promise<UnlockerCreds | null> {
  const token = (await envString("BRIGHTDATA_API_KEY")) || (await envString("BRIGHTDATA_API_TOKEN"));
  if (token) {
    return { kind: "brightdata", token, zone: (await envString("BRIGHTDATA_ZONE")) || DEFAULT_ZONE };
  }
  const username = await envString("OXYLABS_USERNAME");
  const password = await envString("OXYLABS_PASSWORD");
  if (username && password) return { kind: "oxylabs", username, password };
  return null;
}

function bytesToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function proxyFailure(status: number, errorText: string): UnlockerFailure | null {
  if (status === 401 || status === 403) return { error: "credentials" };
  if (status === 402) return { error: "config" };
  const lowered = errorText.toLowerCase();
  if (lowered.includes("auth") || lowered.includes("token") || lowered.includes("unauthorized")) {
    return { error: "credentials" };
  }
  if (lowered.includes("zone") || lowered.includes("customer") || lowered.includes("balance")) {
    return { error: "config" };
  }
  return null;
}

function unwrapUnlockerBody(status: number, text: string): UnlockerDownload | UnlockerFailure {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return { status, body: text };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { status, body: text };
  }
  const record = asRecord(parsed);
  if (!record) return { status, body: text };
  if ("data" in record || "errors" in record) return { status, body: text };

  const errorText =
    typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : "";
  const failed = proxyFailure(status, errorText);
  if (failed && (status >= 400 || errorText)) return failed;

  const results = record.results;
  if (Array.isArray(results) && asRecord(results[0])) {
    const result = asRecord(results[0])!;
    const content = result.content;
    const nextStatus = typeof result.status_code === "number" ? result.status_code : status;
    if (typeof content === "string") return { status: nextStatus, body: content };
    if (content && typeof content === "object") return { status: nextStatus, body: JSON.stringify(content) };
  }

  const envelopeStatus =
    typeof record.status_code === "number"
      ? record.status_code
      : typeof record.status === "number"
        ? record.status
        : status;
  if (typeof record.body === "string") return { status: envelopeStatus, body: record.body };
  return { status, body: text };
}

async function postJson(url: string, headers: Record<string, string>, body: string): Promise<UnlockerDownload | UnlockerFailure> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  const failed = proxyFailure(response.status, text);
  if (failed && response.status >= 400 && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    return failed;
  }
  if (failed && (response.status === 401 || response.status === 402 || response.status === 403) && text.length < 500) {
    return failed;
  }
  return unwrapUnlockerBody(response.status, text);
}

async function fetchBrightData(creds: BrightDataCreds, targetUrl: string, graphqlBody: string) {
  return postJson(
    BRIGHTDATA_ENDPOINT,
    {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    JSON.stringify({
      zone: creds.zone,
      url: targetUrl,
      format: "raw",
      method: "POST",
      country: "us",
      body: graphqlBody,
    }),
  );
}

async function fetchOxylabs(creds: OxylabsCreds, targetUrl: string, graphqlBody: string, headers: Record<string, string>) {
  return postJson(
    OXYLABS_ENDPOINT,
    {
      Authorization: `Basic ${bytesToBase64(`${creds.username}:${creds.password}`)}`,
      "Content-Type": "application/json",
    },
    JSON.stringify({
      source: "universal",
      url: targetUrl,
      geo_location: "United States",
      context: [
        { key: "http_method", value: "post" },
        { key: "content", value: bytesToBase64(graphqlBody) },
        { key: "force_headers", value: true },
        { key: "headers", value: headers },
      ],
    }),
  );
}

export async function fetchGraphqlViaUnlocker(
  targetUrl: string,
  graphqlBody: string,
  headers: Record<string, string>,
): Promise<UnlockerDownload | UnlockerFailure | null> {
  const creds = await unlockerCredentials();
  if (!creds) return null;
  try {
    return creds.kind === "brightdata"
      ? await fetchBrightData(creds, targetUrl, graphqlBody)
      : await fetchOxylabs(creds, targetUrl, graphqlBody, headers);
  } catch (error) {
    console.error("Residential proxy request failed.", error);
    return { error: "network" };
  }
}

export function isUnlockerFailure(value: UnlockerDownload | UnlockerFailure | null): value is UnlockerFailure {
  return Boolean(value && "error" in value);
}
