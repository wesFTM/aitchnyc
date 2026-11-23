import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  LoopNetImportError,
  parseLoopNetLink,
  parseLoopNetPage,
  type LoopNetFields,
} from "@/lib/loopnet-parse";
import {
  fetchPageViaUnlocker,
  isUnlockerFailure,
  unlockerConfigured,
} from "@/lib/residential-unlocker";

const MAX_PHOTO_BYTES = 2_000_000;

const BROWSER_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
};

export { LoopNetImportError };

export type LoopNetDraft = Omit<LoopNetFields, "photoUrls"> & {
  images: Uint8Array[];
};

function fail(message: string): never {
  throw new LoopNetImportError(message);
}

function blockedPage(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return /access denied/i.test(title) || html.includes("errors.edgesuite.net") || html.includes("AkamaiGHost");
}

function unlockerFail(kind: "credentials" | "config" | "network"): never {
  if (kind === "credentials") {
    fail("LoopNet import credentials were rejected. Check the Bright Data or Oxylabs secret on the Worker.");
  }
  if (kind === "config") {
    fail("LoopNet import isn't configured correctly. Check the residential proxy zone and plan.");
  }
  fail("Couldn't open that LoopNet listing.");
}

async function pageInBrowser(target: string) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.BROWSER) return null;
    const { default: puppeteer } = await import("@cloudflare/puppeteer");
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(25000);
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
      const html = await page.content();
      if (!html || blockedPage(html)) return null;
      return html;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Could not read the LoopNet listing in a browser.", error);
    return null;
  }
}

async function pageDirect(target: string) {
  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    const html = await response.text();
    if (!response.ok || blockedPage(html)) return null;
    return html;
  } catch {
    return null;
  }
}

async function loadHtml(target: string) {
  const downloaded = await fetchPageViaUnlocker(target);
  if (downloaded && isUnlockerFailure(downloaded)) unlockerFail(downloaded.error);
  if (downloaded && !blockedPage(downloaded.body) && downloaded.body.includes("RealEstateListing")) {
    return downloaded.body;
  }
  const viaBrowser = await pageInBrowser(target);
  if (viaBrowser) return viaBrowser;
  const direct = await pageDirect(target);
  if (direct) return direct;
  if (!(await unlockerConfigured())) {
    fail("LoopNet import isn't configured on this site yet. Add a Bright Data or Oxylabs secret to the Worker.");
  }
  fail("LoopNet blocked the import. Try again in a moment.");
}

function imageHost(url: URL) {
  return /^(?:images\d*|images)\.loopnet\.(?:com|co\.uk)$/i.test(url.hostname);
}

async function downloadPhoto(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" || !imageHost(target)) return null;
  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: { Accept: "image/jpeg,image/webp,image/*;q=0.8", "User-Agent": BROWSER_HEADERS["User-Agent"] },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || !imageHost(finalUrl)) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const advertised = Number(response.headers.get("content-length") || 0);
    if (advertised > MAX_PHOTO_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

async function downloadPhotos(urls: string[]) {
  const images: Uint8Array[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      const bytes = await downloadPhoto(urls[index]);
      if (bytes) images[index] = bytes;
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => worker()));
  return images.filter((image): image is Uint8Array => image instanceof Uint8Array);
}

export async function loadLoopNetListing(rawUrl: string): Promise<LoopNetDraft> {
  const target = parseLoopNetLink(rawUrl);
  const fields = parseLoopNetPage(await loadHtml(target.href));
  const { photoUrls, ...draft } = fields;
  return { ...draft, images: await downloadPhotos(photoUrls) };
}
