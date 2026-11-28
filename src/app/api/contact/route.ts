import { NextResponse } from "next/server";
import { sendInquiryEmail } from "@/lib/contact-mail";
import { jsonError } from "@/lib/http";
import { insertContactInquiry } from "@/lib/contact-store";
import { parseContactInput } from "@/lib/contact-input";

export const runtime = "nodejs";

const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { company?: unknown }).company === "string") {
    const company = (body as { company: string }).company.trim();
    if (company) return NextResponse.json({ ok: true });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return jsonError("send", 429);

  const parsed = parseContactInput(body);
  if ("error" in parsed) return jsonError(parsed.error);

  await insertContactInquiry({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
    phone: parsed.phone,
    propertyId: null,
    listingLabel: "",
    inquiryType: parsed.inquiryType,
    budget: parsed.budget,
    neighborhood: parsed.neighborhood,
    message: parsed.message,
  });

  try {
    await sendInquiryEmail({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
      inquiryType: parsed.inquiryType,
      budget: parsed.budget,
      neighborhood: parsed.neighborhood,
      message: parsed.message,
    });
  } catch (error) {
    console.error(error);
  }

  return NextResponse.json({ ok: true });
}
