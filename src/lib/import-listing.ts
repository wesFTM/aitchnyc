import "server-only";

import { extractTextItems, getDocumentProxy } from "unpdf";
import { extractSetupImages } from "@/lib/pdf-images";
import { parseMeridianSetup, type SetupDraft, type SetupTextItem } from "@/lib/meridian-listing";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "Mozilla/5.0 (compatible; AitchNYC/1.0; listing import)",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("That link didn't open. Check the URL and try again.");
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || blockedHost(finalUrl.hostname)) {
    throw new Error("Paste an https link to the listing PDF.");
  }
  const advertised = Number(response.headers.get("content-length") || 0);
  if (advertised > MAX_PDF_BYTES) throw new Error("That PDF is too large to import.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("That PDF is too large to import.");
  if (bytes.byteLength < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new Error("That link is not a PDF. Paste a Meridian setup sheet link.");
  }
  return bytes;
}

export async function readSetupPdf(bytes: Uint8Array): Promise<ImportedSetup> {
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
  const draft = parseMeridianSetup(pages);
  if (!draft.address) throw new Error("Couldn't find an address in that PDF.");
  if (!draft.price) throw new Error("Couldn't find an asking rent in that PDF.");
  return { draft, images };
}
