const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseContactInput(body: unknown):
  | {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      propertyId: string | null;
      message: string;
    }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "message" };
  const input = body as Record<string, unknown>;
  const firstName = asString(input.firstName);
  const lastName = asString(input.lastName);
  const email = asString(input.email).toLowerCase();
  const phone = asString(input.phone);
  const propertyId = asString(input.propertyId);
  const message = asString(input.message);
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) return { error: "name" };
  if (!CONTACT_EMAIL.test(email) || email.length > 160) return { error: "email" };
  if (phone.replace(/\D/g, "").length < 7 || phone.length > 40) return { error: "phone" };
  if (propertyId && !/^[0-9a-f-]{36}$/i.test(propertyId)) return { error: "listing" };
  if (!message || message.length > 2000) return { error: "message" };
  return { firstName, lastName, email, phone, propertyId: propertyId || null, message };
}
