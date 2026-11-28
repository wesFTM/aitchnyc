import "server-only";

import { getDb } from "@/lib/db";
import type { ContactInquiry, PublicListing } from "@/lib/types";

export async function listPublicListings() {
  const db = await getDb();
  return db.all<PublicListing>(
    `SELECT id, address, unit, neighborhood, listing_type
     FROM properties
     WHERE IFNULL(hidden, 0) = 0 AND status != 'inactive'
     ORDER BY address COLLATE NOCASE ASC, unit COLLATE NOCASE ASC`,
  );
}

export async function getPublicListing(id: string) {
  const db = await getDb();
  return db.get<PublicListing>(
    `SELECT id, address, unit, neighborhood, listing_type
     FROM properties
     WHERE id = ? AND IFNULL(hidden, 0) = 0 AND status != 'inactive'`,
    id,
  );
}

export async function insertContactInquiry(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyId: string | null;
  listingLabel: string;
  message: string;
}) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO contact_inquiries
      (id, first_name, last_name, email, phone, property_id, listing_label, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.firstName,
    input.lastName,
    input.email,
    input.phone,
    input.propertyId,
    input.listingLabel,
    input.message,
  );
  return id;
}

export async function listContactInquiries() {
  const db = await getDb();
  return db.all<ContactInquiry>("SELECT * FROM contact_inquiries ORDER BY created_at DESC");
}
