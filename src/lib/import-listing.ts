import "server-only";

import { extractTextItems, getDocumentProxy } from "unpdf";
import { extractSetupImages } from "@/lib/pdf-images";
import { parseListingFlyer, type SetupDraft, type SetupTextItem } from "@/lib/meridian-listing";

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
  if (status === 429) return "That site blocked the download. Paste a direct PDF link.";
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
        child = spawn(bin, ["-c", PYTHON_DOWNLOAD, target], { stdio: ["ignore", "pipe", "pipe"] });
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
          if (status === 403 || status === 410 || status === 429) {
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

export async function fetchListingPdf(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a full link, starting with https://.");
  }
  if (url.protocol !== "https:" || blockedHost(url.hostname)) {
    throw new Error("Paste an https link to the listing PDF.");
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  const challenged = response.status === 429 || response.headers.get("x-vercel-mitigated") === "challenge";
  if (challenged) {
    const fallback = await downloadWithPython(url.href);
    if (!fallback) throw new Error("That site blocked the download. Paste a direct PDF link.");
    return pdfBytes(fallback);
  }
  if (!response.ok) throw new Error(failureMessage(response.status));
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || blockedHost(finalUrl.hostname)) {
    throw new Error("Paste an https link to the listing PDF.");
  }
  const advertised = Number(response.headers.get("content-length") || 0);
  if (advertised > MAX_PDF_BYTES) throw new Error("That PDF is too large to import.");
  return pdfBytes(new Uint8Array(await response.arrayBuffer()));
}

function addressFromFilename(sourceUrl: string) {
  let name = "";
  try {
    const url = new URL(sourceUrl);
    const named = url.searchParams.get("filename") || url.searchParams.get("response-content-disposition") || "";
    const disposition = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(named);
    name = decodeURIComponent((disposition?.[1] || named || url.pathname.split("/").pop() || "").replace(/"/g, ""));
  } catch {
    name = sourceUrl;
  }
  name = name
    .replace(/\.pdf$/i, "")
    .replace(/[_+]+/g, " ")
    .replace(/-+/g, " ")
    .replace(/\b(v\d+|flyer|setup|brochure|offering|memorandum|final|draft|upload|document)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/^\d+\s+[A-Za-z]/.test(name)) return "";
  if (!/\b(street|st|avenue|ave|boulevard|blvd|place|pl|road|rd|drive|dr|lane|ln|broadway|way|plaza|square)\b/i.test(name)) {
    return "";
  }
  return name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export async function readSetupPdf(bytes: Uint8Array, sourceUrl = ""): Promise<ImportedSetup> {
  const images = extractSetupImages(bytes);
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
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
}
