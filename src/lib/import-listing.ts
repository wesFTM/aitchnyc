import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { extractTextItems, getDocumentProxy } from "unpdf";
import { extractSetupImages } from "@/lib/pdf-images";
import { addressFromFilename, parseListingFlyer, type SetupDraft, type SetupTextItem } from "@/lib/meridian-listing";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export type ImportedSetup = {
  draft: SetupDraft;
  images: Uint8Array[];
};

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "169.254.169.254") return true;
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

const BROWSER_HEADERS = {
  Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export function assertListingPdf(bytes: Uint8Array, invalidMessage?: string) {
  return pdfBytes(bytes, invalidMessage);
}

function pdfBytes(bytes: Uint8Array, invalidMessage = "That link isn't a PDF flyer. Paste a direct link to the listing PDF.") {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("That PDF is too large to import.");
  if (bytes.byteLength < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new Error(invalidMessage);
  }
  return bytes;
}

function failureMessage(status: number) {
  if (status === 403 || status === 410) return "That link didn't open. If it was a temporary share link, paste a fresh one.";
  if (status === 429) return "That site blocked the download. Use Upload a PDF instead.";
  return "That link didn't open. Check the URL and try again.";
}

// Some flyer hosts (KSR on Vercel) reject Node's TLS fingerprint and serve a
// checkpoint page. Python's HTTP client from the same machine is allowed through.
const PYTHON_DOWNLOAD = `
import sys, urllib.request, urllib.error
url = sys.argv[1]
class Guard(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.request.urlparse(newurl)
        if target.scheme != "https":
            raise urllib.error.HTTPError(req.full_url, code, "redirect", headers, fp)
        return urllib.request.HTTPRedirectHandler.redirect_request(self, req, fp, code, msg, headers, newurl)
opener = urllib.request.build_opener(Guard)
req = urllib.request.Request(url, headers={
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
})
try:
    with opener.open(req, timeout=20) as res:
        data = res.read(20971521)
        sys.stdout.buffer.write(data)
except urllib.error.HTTPError as exc:
    sys.stderr.write(str(exc.code))
    sys.exit(1)
except Exception:
    sys.stderr.write("0")
    sys.exit(1)
`;

async function downloadWithPython(target: string) {
  let spawn: typeof import("node:child_process").spawn;
  try {
    ({ spawn } = await import("node:child_process"));
  } catch {
    return null;
  }
  const bins = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3", "python3"];
  for (const bin of bins) {
    const downloaded = await new Promise<Uint8Array | null>((resolve, reject) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(/*turbopackIgnore: true*/ bin, ["-c", PYTHON_DOWNLOAD, target], { stdio: ["ignore", "pipe", "pipe"] });
      } catch {
        resolve(null);
        return;
      }
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let settled = false;
      const finish = (value: Uint8Array | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(null);
      }, 20000);
      child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => err.push(chunk));
      child.on("error", () => finish(null));
      child.on("close", (code) => {
        if (settled) return;
        if (code !== 0) {
          const status = Number(Buffer.concat(err).toString().trim());
          if (status === 403 || status === 410) {
            const failure = new Error(failureMessage(status));
            settled = true;
            clearTimeout(timer);
            reject(failure);
            return;
          }
          finish(null);
          return;
        }
        finish(new Uint8Array(Buffer.concat(out)));
      });
    }).catch((error: unknown) => {
      if (error instanceof Error && (error.message.includes("blocked") || error.message.includes("didn't open"))) throw error;
      return null;
    });
    if (downloaded) return downloaded;
  }
  return null;
}

// KSR's checkpoint rejects the worker's TLS fingerprint. A real browser session
// is allowed through. Local Node uses the Python fallback above instead.
async function downloadWithBrowser(target: string) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.BROWSER) return null;
    const { default: puppeteer } = await import("@cloudflare/puppeteer");
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(25000);
      const response = await page.goto(target, { waitUntil: "load", timeout: 25000 });
      if (!response || !response.ok()) return null;
      const bytes = new Uint8Array(await response.buffer());
      if (bytes.byteLength < 5 || bytes[0] !== 0x25) return null;
      return bytes;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Could not download the flyer in a browser.", error);
    return null;
  }
}

function listingPdfUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a full link, starting with https://.");
  }
  if (url.protocol !== "https:" || blockedHost(url.hostname)) {
    throw new Error("Paste an https link to the listing PDF.");
  }
  return url;
}

async function loadListingPdf(rawUrl: string) {
  const url = listingPdfUrl(rawUrl);
  const response = await fetch(url, {
    redirect: "follow",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  const challenged = response.status === 429 || response.headers.get("x-vercel-mitigated") === "challenge";
  if (challenged) {
    await response.body?.cancel().catch(() => undefined);
    let fallback: Uint8Array | null = null;
    try {
      fallback = await downloadWithPython(url.href);
    } catch (error) {
      if (error instanceof Error && error.message.includes("didn't open")) throw error;
    }
    fallback ??= await downloadWithBrowser(url.href);
    if (!fallback) throw new Error("That site blocked the download. Use Upload a PDF instead.");
    return { buffered: pdfBytes(fallback) };
  }
  if (!response.ok) throw new Error(failureMessage(response.status));
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || blockedHost(finalUrl.hostname)) {
    throw new Error("Paste an https link to the listing PDF.");
  }
  const advertised = Number(response.headers.get("content-length") || 0);
  if (advertised > MAX_PDF_BYTES) throw new Error("That PDF is too large to import.");
  return { streamed: response };
}

export async function fetchListingPdf(rawUrl: string) {
  const loaded = await loadListingPdf(rawUrl);
  if ("buffered" in loaded) return loaded.buffered;
  return pdfBytes(new Uint8Array(await loaded.streamed.arrayBuffer()));
}

export async function openListingPdf(rawUrl: string) {
  const loaded = await loadListingPdf(rawUrl);
  const headers = { "content-type": "application/pdf", "cache-control": "no-store" };
  if ("buffered" in loaded) return new Response(loaded.buffered, { headers });
  const body = loaded.streamed.body;
  if (!body) throw new Error("That link didn't open. Check the URL and try again.");
  const reader = body.getReader();
  const first = await reader.read();
  const chunk = first.value;
  if (first.done || !chunk || chunk.byteLength < 5 || chunk[0] !== 0x25 || chunk[1] !== 0x50 || chunk[2] !== 0x44 || chunk[3] !== 0x46) {
    await reader.cancel().catch(() => undefined);
    throw new Error("That link isn't a PDF flyer. Paste a direct link to the listing PDF.");
  }
  let sent = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(chunk);
        return;
      }
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    cancel() {
      return reader.cancel();
    },
  });
  return new Response(stream, { headers });
}

function realImage(bytes: Uint8Array) {
  if (bytes.byteLength < 8) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

const MAX_LISTING_IMAGES = 8;
const MAX_STORED_IMAGE_BYTES = 1_500_000;

function listingImages(bytes: Uint8Array) {
  // Encrypted flyers (Buildout) hide their photos inside encoded streams. Decoding
  // those to full-size pixels exceeds the worker's memory and CPU, which comes
  // back as a 503. Keep photos that are already stored as JPEG or PNG files.
  return extractSetupImages(bytes)
    .filter((image) => realImage(image) && image.byteLength <= MAX_STORED_IMAGE_BYTES)
    .slice(0, MAX_LISTING_IMAGES);
}

export async function readSetupPdf(bytes: Uint8Array, sourceUrl = ""): Promise<ImportedSetup> {
  const images = listingImages(bytes);
  const pdf = await getDocumentProxy(new Uint8Array(bytes), {
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  try {
    const extracted = await extractTextItems(pdf);
    const pages = extracted.items.map((page) =>
      page.map(
        (item): SetupTextItem => ({
          str: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          fontSize: item.fontSize,
        }),
      ),
    );
    const draft = parseListingFlyer(pages);
    if (!draft.address && sourceUrl) draft.address = addressFromFilename(sourceUrl);
    if (!draft.address) throw new Error("Couldn't find an address in that PDF.");
    return { draft, images };
  } finally {
    const destroy = (pdf as { destroy?: () => Promise<void> }).destroy?.bind(pdf);
    if (destroy) await destroy().catch(() => undefined);
  }
}
