import "server-only";

import { NextResponse } from "next/server";
import { contentDisposition } from "@/lib/documents";
import { jsonError } from "@/lib/http";
import { objectSize, readObject } from "@/lib/storage";

function parseRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return null;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const start = Math.max(size - suffix, 0);
    return { start, end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function respondWithMedia(
  request: Request,
  storageKey: string,
  contentType: string,
  downloadName?: string,
) {
  const size = await objectSize(storageKey);
  if (size == null) return jsonError("File not found.", 404);

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, size) : { start: 0, end: size - 1 };
  if (!range) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const bytes = await readObject(storageKey, range.start, range.end);
  if (!bytes) return jsonError("File not found.", 404);

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  if (downloadName) headers.set("Content-Disposition", contentDisposition(downloadName));
  const status = rangeHeader ? 206 : 200;
  if (rangeHeader) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  }
  return new NextResponse(Buffer.from(bytes), { status, headers });
}
