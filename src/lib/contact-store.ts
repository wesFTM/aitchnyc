import "server-only";

import { getDb } from "@/lib/db";
import type { ContactInquiry } from "@/lib/types";

export async function insertContactInquiry(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyId: string | null;
  listingLabel: string;
  inquiryType: string;
  budget: string;
  neighborhood: string;
  message: string;
}) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO contact_inquiries
      (id, first_name, last_name, email, phone, property_id, listing_label, inquiry_type, budget, neighborhood, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.firstName,
    input.lastName,
    input.email,
    input.phone,
    input.propertyId,
    input.listingLabel,
    input.inquiryType,
    input.budget,
    input.neighborhood,
    input.message,
  );
  return id;
}

export async function listContactInquiries() {
  const db = await getDb();
  return db.all<ContactInquiry>("SELECT * FROM contact_inquiries ORDER BY created_at DESC");
}
