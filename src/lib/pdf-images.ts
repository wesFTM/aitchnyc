import { deflateSync, inflateSync } from "node:zlib";

const MIN_EDGE = 400;

type PdfObject = {
  n: number;
  dict: string;
  streamStart: number | null;
  length: number | null;
};

function indexOfAscii(hay: Uint8Array, needle: string, from = 0) {
  const size = needle.length;
  if (size === 0 || from < 0) return -1;
  for (let i = from; i <= hay.length - size; i += 1) {
    let matched = true;
    for (let j = 0; j < size; j += 1) {
      if (hay[i + j] !== needle.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  let text = "";
  const stop = Math.min(end, bytes.length);
  for (let i = Math.max(0, start); i < stop; i += 1) text += String.fromCharCode(bytes[i]);
  return text;
}

function findObjectHeader(pdf: Uint8Array, from: number) {
  let pos = from;
  while (pos < pdf.length) {
    const at = indexOfAscii(pdf, " 0 obj", pos);
    if (at < 0) return null;
    let start = at - 1;
    while (start >= 0 && pdf[start] >= 48 && pdf[start] <= 57) start -= 1;
    const boundary = start < 0 || pdf[start] === 10 || pdf[start] === 13 || pdf[start] === 32;
    if (boundary && start + 1 < at) {
      return { at: start + 1, n: Number(ascii(pdf, start + 1, at)) };
    }
    pos = at + 1;
  }
  return null;
}

function streamOffset(pdf: Uint8Array, keywordAt: number) {
  let offset = keywordAt + "stream".length;
  if (pdf[offset] === 13 && pdf[offset + 1] === 10) return offset + 2;
  if (pdf[offset] === 10 || pdf[offset] === 13) return offset + 1;
  return offset;
}

function scanObjects(pdf: Uint8Array) {
  const objects = new Map<number, PdfObject>();
  let cursor = 0;
  while (cursor < pdf.length) {
    const header = findObjectHeader(pdf, cursor);
    if (!header) break;
    const window = ascii(pdf, header.at, header.at + 65536);
    const streamRel = window.search(/stream(?:\r\n|\n|\r)/);
    const endRel = window.indexOf("endobj");
    const ownsStream = streamRel >= 0 && (endRel < 0 || streamRel < endRel);
    const dictEnd = ownsStream ? streamRel : endRel > 0 ? endRel : window.length;
    const dict = window.slice(0, dictEnd);
    const lengthMatch = /\/Length\s+(\d+)/.exec(dict);
    const streamStart = ownsStream ? streamOffset(pdf, header.at + streamRel) : null;
    const length = lengthMatch ? Number(lengthMatch[1]) : null;
    objects.set(header.n, { n: header.n, dict, streamStart, length });
    if (streamStart != null && length != null) cursor = streamStart + length;
    else cursor = header.at + (endRel > 0 ? endRel + 6 : 8);
  }
  return objects;
}

function innerDict(dict: string, key: string) {
  const keyAt = dict.indexOf(key);
  if (keyAt < 0) return null;
  const open = dict.indexOf("<<", keyAt);
  if (open < 0 || open > keyAt + key.length + 8) return null;
  let depth = 0;
  for (let i = open; i < dict.length - 1; i += 1) {
    if (dict[i] === "<" && dict[i + 1] === "<") {
      depth += 1;
      i += 1;
      continue;
    }
    if (dict[i] === ">" && dict[i + 1] === ">") {
      depth -= 1;
      if (depth === 0) return dict.slice(open + 2, i);
      i += 1;
    }
  }
  return null;
}

function kids(dict: string) {
  const match = /\/Kids\s*\[([^\]]*)\]/.exec(dict);
  if (!match) return [];
  return [...match[1].matchAll(/(\d+)\s+0\s+R/g)].map((item) => Number(item[1]));
}

function pageNumbers(objects: Map<number, PdfObject>) {
  const seen = new Set<number>();
  const pages: number[] = [];
  function walk(n: number) {
    if (seen.has(n)) return;
    const object = objects.get(n);
    if (!object) return;
    seen.add(n);
    if (/\/Type\s*\/Pages\b/.test(object.dict)) {
      for (const kid of kids(object.dict)) walk(kid);
      return;
    }
    if (/\/Type\s*\/Page\b/.test(object.dict)) pages.push(n);
  }
  for (const object of objects.values()) {
    if (/\/Type\s*\/Pages\b/.test(object.dict)) walk(object.n);
  }
  if (pages.length === 0) {
    for (const object of objects.values()) {
      if (/\/Type\s*\/Page\b/.test(object.dict)) pages.push(object.n);
    }
  }
  return pages;
}

function isJpegImage(object: PdfObject | undefined) {
  if (!object) return false;
  return /\/Subtype\s*\/Image\b/.test(object.dict) && /\/DCTDecode\b/.test(object.dict);
}

function dimension(dict: string, key: "Width" | "Height") {
  const match = new RegExp(`\\/${key}\\s+(\\d+)`).exec(dict);
  return match ? Number(match[1]) : 0;
}

function streamBytes(pdf: Uint8Array, object: PdfObject) {
  if (object.streamStart == null || object.length == null) return null;
  const end = object.streamStart + object.length;
  if (end > pdf.length) return null;
  return pdf.subarray(object.streamStart, end);
}

function jpegBytes(pdf: Uint8Array, object: PdfObject) {
  const bytes = streamBytes(pdf, object);
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  return new Uint8Array(bytes);
}

function pngChunk(type: string, data: Uint8Array) {
  const body = new Uint8Array(4 + data.length);
  body.set(new TextEncoder().encode(type), 0);
  body.set(data, 4);
  const chunk = new Uint8Array(8 + body.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return chunk;
}

function crc32(data: Uint8Array) {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngFromRgb(rgb: Uint8Array, width: number, height: number) {
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), row + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 2;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [signature, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", new Uint8Array())];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

function flatePng(pdf: Uint8Array, object: PdfObject, width: number, height: number) {
  if (!/\/Filter\s*\/FlateDecode\b/.test(object.dict)) return null;
  if (/\/ImageMask\s+true/.test(object.dict)) return null;
  if (!/\/ColorSpace\s*\/DeviceRGB\b/.test(object.dict)) return null;
  if (!/\/BitsPerComponent\s+8\b/.test(object.dict)) return null;
  if (width * height > 6_000_000) return null;
  const encoded = streamBytes(pdf, object);
  if (!encoded) return null;
  let raw: Uint8Array;
  try {
    raw = inflateSync(encoded);
  } catch {
    return null;
  }
  if (raw.length !== width * height * 3) return null;
  return pngFromRgb(raw, width, height);
}

function imageBytes(pdf: Uint8Array, object: PdfObject) {
  const width = dimension(object.dict, "Width");
  const height = dimension(object.dict, "Height");
  if (width < MIN_EDGE || height < MIN_EDGE) return null;
  if (isJpegImage(object)) return jpegBytes(pdf, object);
  if (/\/Subtype\s*\/Image\b/.test(object.dict)) return flatePng(pdf, object, width, height);
  return null;
}

function xobjectRefs(dict: string) {
  const resources = innerDict(dict, "/Resources") ?? dict;
  const xobjects = innerDict(resources, "/XObject");
  if (!xobjects) return [];
  return [...xobjects.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)]
    .map((match) => ({
      name: match[1],
      n: Number(match[2]),
      order: Number(/(\d+)$/.exec(match[1])?.[1] ?? "0"),
    }))
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function collectImages(
  objects: Map<number, PdfObject>,
  pdf: Uint8Array,
  objectNumber: number,
  seen: Set<number>,
  images: Uint8Array[],
) {
  if (seen.has(objectNumber) || images.length >= 30) return;
  const object = objects.get(objectNumber);
  if (!object) return;
  if (/\/Subtype\s*\/Image\b/.test(object.dict)) {
    seen.add(objectNumber);
    const bytes = imageBytes(pdf, object);
    if (bytes) images.push(bytes);
    return;
  }
  if (!/\/Subtype\s*\/Form\b/.test(object.dict)) return;
  seen.add(objectNumber);
  for (const ref of xobjectRefs(object.dict)) collectImages(objects, pdf, ref.n, seen, images);
}

export function extractSetupImages(pdf: Uint8Array) {
  const objects = scanObjects(pdf);
  const images: Uint8Array[] = [];
  const seen = new Set<number>();
  for (const pageNumber of pageNumbers(objects)) {
    const page = objects.get(pageNumber);
    if (!page) continue;
    for (const ref of xobjectRefs(page.dict)) collectImages(objects, pdf, ref.n, seen, images);
    if (images.length >= 30) break;
  }
  return images;
}
