import { NEIGHBORHOODS } from "@/lib/styles";

const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CONTACT_INQUIRY_TYPES = ["general", "commercial", "residential"] as const;
export type ContactInquiryType = (typeof CONTACT_INQUIRY_TYPES)[number];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseContactInput(body: unknown):
  | {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      inquiryType: ContactInquiryType;
      budget: string;
      neighborhood: string;
      message: string;
    }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "message" };
  const input = body as Record<string, unknown>;
  const firstName = asString(input.firstName);
  const lastName = asString(input.lastName);
  const email = asString(input.email).toLowerCase();
  const phone = asString(input.phone);
  const inquiryType = asString(input.inquiryType);
  const budget = asString(input.budget);
  const neighborhood = asString(input.neighborhood);
  const message = asString(input.message);
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) return { error: "name" };
  if (!CONTACT_EMAIL.test(email) || email.length > 160) return { error: "email" };
  if (phone.replace(/\D/g, "").length < 7 || phone.length > 40) return { error: "phone" };
  if (!CONTACT_INQUIRY_TYPES.includes(inquiryType as ContactInquiryType)) return { error: "inquiry" };
  if (!budget || budget.length > 80) return { error: "budget" };
  if (!NEIGHBORHOODS.includes(neighborhood)) return { error: "neighborhood" };
  if (!message || message.length > 2000) return { error: "message" };
  return {
    firstName,
    lastName,
    email,
    phone,
    inquiryType: inquiryType as ContactInquiryType,
    budget,
    neighborhood,
    message,
  };
}
