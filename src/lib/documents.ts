import { sniffMedia } from "@/lib/http";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOC = "application/msword";
const XLS = "application/vnd.ms-excel";

export function sniffDocument(bytes: Uint8Array, filename: string) {
  const image = sniffMedia(bytes);
  if (image?.kind === "image") return { contentType: image.contentType };
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { contentType: "application/pdf" };
  }
  const extension = filename.toLowerCase().split(".").pop() || "";
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (zip && extension === "docx") return { contentType: DOCX };
  if (zip && extension === "xlsx") return { contentType: XLSX };
  const ole = bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (ole && extension === "doc") return { contentType: DOC };
  if (ole && extension === "xls") return { contentType: XLS };
  return null;
}

export function documentFileName(name: string) {
  const base = name.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  return base || "document";
}

export function documentLinksByProperty(
  documents: { id: string; property_id: string; original_name: string }[],
  hrefFor: (id: string) => string,
) {
  const byProperty = new Map<string, { href: string; name: string }[]>();
  for (const document of documents) {
    const current = byProperty.get(document.property_id) ?? [];
    current.push({ href: hrefFor(document.id), name: document.original_name });
    byProperty.set(document.property_id, current);
  }
  return byProperty;
}

export function contentDisposition(name: string) {
  const cleaned = documentFileName(name).replace(/[\r\n"]/g, "");
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
