import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { loadStreetEasyFields, StreetEasyImportError } from "@/lib/streeteasy-listing";

export const runtime = "nodejs";

const READER_ORIGINS = new Set([
  "https://h-nyc.com",
  "https://www.h-nyc.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function readerOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return "";
  return READER_ORIGINS.has(origin) ? origin : null;
}

function withReaderHeaders(response: NextResponse, origin: string) {
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Private-Network", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export function OPTIONS(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const origin = readerOrigin(request);
  if (origin === null) return new NextResponse(null, { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Private-Network", "true");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "content-type");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return jsonError("Not found.", 404);
  const origin = readerOrigin(request);
  if (origin === null) return jsonError("That site can't use the local reader.", 403);

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) return withReaderHeaders(jsonError("Paste a StreetEasy rental link."), origin);

  try {
    const fields = await loadStreetEasyFields(url);
    return withReaderHeaders(NextResponse.json(fields), origin);
  } catch (error) {
    if (error instanceof StreetEasyImportError) return withReaderHeaders(jsonError(error.message), origin);
    console.error("StreetEasy read failed.", error);
    return withReaderHeaders(jsonError("Couldn't read that StreetEasy listing."), origin);
  }
}
