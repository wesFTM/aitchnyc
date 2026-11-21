import "server-only";

import { sniffMedia } from "@/lib/http";
import { setClientLogo } from "@/lib/queries";
import { deleteObject, putObject } from "@/lib/storage";

const MAX_HTML_BYTES = 1_200_000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const FETCH_BUDGET_MS = 15_000;

export async function saveClientLogo(
  clientId: string,
  previousKey: string | null,
  bytes: Uint8Array,
  contentType: string,
) {
  const key = `clients/${clientId}/logo/${crypto.randomUUID()}`;
  await putObject(key, bytes, contentType);
  await setClientLogo(clientId, key, contentType);
  if (previousKey && previousKey !== key) {
    try {
      await deleteObject(previousKey);
    } catch {
      // A leftover object does not affect the page.
    }
  }
  return key;
}

export async function clearClientLogo(clientId: string, previousKey: string | null) {
  await setClientLogo(clientId, null, null);
  if (previousKey) {
    try {
      await deleteObject(previousKey);
    } catch {
      // The file is already gone.
    }
  }
}

export async function fetchCompanyLogo(website: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  let page: URL;
  try {
    page = new URL(website);
  } catch {
    return null;
  }
  if (!isPublicHttpUrl(page)) return null;

  const deadline = Date.now() + FETCH_BUDGET_MS;
  const htmlResponse = await fetchChecked(page, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", deadline);
  const htmlBytes = htmlResponse ? await readLimited(htmlResponse, MAX_HTML_BYTES) : null;
  const html = htmlBytes ? new TextDecoder().decode(htmlBytes) : "";
  const candidates = rankCandidates(page, html);

  let fallback: { bytes: Uint8Array; contentType: string } | null = null;
  for (const candidate of candidates.slice(0, 5)) {
    if (Date.now() > deadline) break;
    const response = await fetchChecked(candidate.url, "image/*,*/*;q=0.8", deadline);
    if (!response) continue;
    const bytes = await readLimited(response, MAX_IMAGE_BYTES);
    if (!bytes || bytes.byteLength < 80) continue;
    const contentType = sniffLogo(bytes);
    if (!contentType) continue;
    const image = { bytes, contentType };
    const size = imageSize(bytes, contentType);
    if (size && size.width < 24 && size.height < 24) {
      fallback ??= image;
      continue;
    }
    if (candidate.kind === "banner" && size && size.width > 400 && size.width / size.height > 2.2) {
      fallback ??= image;
      continue;
    }
    return image;
  }
  return fallback;
}

function sniffLogo(bytes: Uint8Array) {
  const media = sniffMedia(bytes);
  if (media?.kind === "image") return media.contentType;
  if (bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) {
    return "image/x-icon";
  }
  return null;
}

type Candidate = { url: URL; score: number; kind: "logo" | "banner" };

function rankCandidates(page: URL, html: string): Candidate[] {
  const found: Candidate[] = [];
  const push = (raw: string, score: number, kind: Candidate["kind"]) => {
    const url = resolveUrl(page, raw);
    if (!url) return;
    found.push({ url, score, kind });
  };

  for (const block of jsonLdBlocks(html)) {
    for (const logo of logosFromJson(block)) push(logo, 180, "logo");
  }

  for (const tag of tags(html, "link")) {
    const rel = attr(tag, "rel").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    const size = iconSize(attr(tag, "sizes"));
    if (rel.includes("apple-touch-icon")) push(href, 200 + size, "logo");
    else if (rel.split(/\s+/).includes("icon")) push(href, 70 + size, "logo");
  }

  for (const tag of tags(html, "meta")) {
    const property = `${attr(tag, "property")} ${attr(tag, "name")} ${attr(tag, "itemprop")}`.toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (property.includes("logo")) push(content, 170, "logo");
    else if (property.includes("og:image") || property.includes("twitter:image")) push(content, 40, "banner");
  }

  for (const tag of tags(html, "img")) {
    const src = firstSrc(tag);
    if (!src) continue;
    const hint = `${src} ${attr(tag, "alt")} ${attr(tag, "class")} ${attr(tag, "id")}`;
    if (mentionsLogo(hint)) push(src, 160, "logo");
  }

  push(new URL("/apple-touch-icon.png", page.origin).toString(), 120, "logo");
  push(new URL("/favicon.ico", page.origin).toString(), 20, "logo");

  const seen = new Set<string>();
  return found
    .filter((candidate) => {
      const key = candidate.url.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

function jsonLdBlocks(html: string) {
  const blocks: unknown[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = match[1]?.trim();
    if (!raw || raw.length > 200_000) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Ignore broken structured data and keep looking.
    }
  }
  return blocks;
}

function logosFromJson(value: unknown, depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap((item) => logosFromJson(item, depth + 1));
  const record = value as Record<string, unknown>;
  const found: string[] = [];
  const logo = record.logo;
  if (typeof logo === "string") found.push(logo);
  else if (logo && typeof logo === "object") {
    const url = (logo as { url?: unknown }).url;
    if (typeof url === "string") found.push(url);
  }
  if ("@graph" in record) found.push(...logosFromJson(record["@graph"], depth + 1));
  return found;
}

function tags(html: string, name: string) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function attr(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i").exec(tag);
  return decodeHtml((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim());
}

function firstSrc(tag: string) {
  const src = attr(tag, "src");
  if (src) return src;
  const srcset = attr(tag, "srcset");
  return srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

function iconSize(sizes: string) {
  const match = /(\d+)\s*x\s*(\d+)/i.exec(sizes);
  if (!match) return 0;
  return Math.max(Number(match[1]), Number(match[2]));
}

function mentionsLogo(value: string) {
  return /(^|[^a-z])logo([^a-z]|$)/i.test(value);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function resolveUrl(base: URL, raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    const url = new URL(trimmed, base);
    if (!isPublicHttpUrl(url)) return null;
    if (/\.(svg|pdf|html?)($|\?)/i.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

function isPublicHttpUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return !isBlockedHost(url.hostname);
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  return isPrivateIp(host);
}

function isPrivateIp(host: string): boolean {
  if (host.includes(":")) {
    const bare = host.split("%")[0];
    if (bare === "::" || bare === "::1") return true;
    if (/^(fc|fd|fe80)/i.test(bare)) return true;
    const mapped = /(?::ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return a >= 224;
}

async function fetchChecked(url: URL, accept: string, deadline: number) {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    if (!isPublicHttpUrl(current) || Date.now() > deadline) return null;
    const remaining = Math.max(deadline - Date.now(), 1);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: {
          Accept: accept,
          "User-Agent": "Mozilla/5.0 (compatible; AitchNYC/1.0; +https://h-nyc.com)",
        },
        signal: AbortSignal.timeout(Math.min(remaining, 8000)),
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) return null;
    return response;
  }
  return null;
}

async function readLimited(response: Response, max: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > max ? null : bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function imageSize(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/png" && bytes.length >= 24) {
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }
  if (contentType === "image/gif" && bytes.length >= 10) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (contentType === "image/x-icon" && bytes.length > 8) {
    return { width: bytes[6] || 256, height: bytes[7] || 256 };
  }
  if (contentType === "image/jpeg") return jpegSize(bytes);
  return null;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}
