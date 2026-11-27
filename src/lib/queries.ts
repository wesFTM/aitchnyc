import "server-only";

import { serializeAmenities } from "@/lib/amenities";
import { hideStreetNumber } from "@/lib/address";
import { getDb } from "@/lib/db";
import { newShareToken } from "@/lib/share";
import type {
  ClientDocument,
  ClientInput,
  Deal,
  DealDocument,
  DealInput,
  ListingStatus,
  Property,
  PropertyInput,
  PropertyListItem,
  PropertyMedia,
  User,
} from "@/lib/types";

const BLANK_EMAIL_DOMAIN = "@clients.invalid";

export function clientEmailForStorage(email: string, id: string) {
  const normalized = email.trim().toLowerCase();
  return normalized || `blank+${id}${BLANK_EMAIL_DOMAIN}`;
}

export function clientEmailForForm(email: string) {
  return email.endsWith(BLANK_EMAIL_DOMAIN) ? "" : email;
}

function presentClient(user: User): User {
  return { ...user, email: clientEmailForForm(user.email), phone: user.phone || "" };
}

const COVER_SQL = `(
  SELECT id FROM property_media m
  WHERE m.property_id = p.id AND m.kind = 'image'
  ORDER BY m.sort_order ASC, m.created_at ASC
  LIMIT 1
) AS cover_id`;

export async function findUserById(id: string) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE id = ?", id);
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.endsWith(BLANK_EMAIL_DOMAIN)) return undefined;
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE email = ?", normalized);
}

export async function upsertSuperAdmin(email: string, name: string) {
  const db = await getDb();
  const normalized = email.toLowerCase();
  const existing = await findUserByEmail(normalized);
  if (!existing) {
    const id = crypto.randomUUID();
    await db.run(
      "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'super_admin')",
      id,
      normalized,
      name || "Admin",
    );
    return (await findUserById(id))!;
  }
  if (existing.role !== "super_admin") {
    await db.run("UPDATE users SET role = 'super_admin' WHERE id = ?", existing.id);
    await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", existing.id);
    await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", existing.id);
  }
  return (await findUserById(existing.id))!;
}

export async function listAdmins() {
  const db = await getDb();
  return db.all<User>("SELECT * FROM users WHERE role = 'admin' ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC");
}

export async function insertAdmin(email: string, name: string) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run("INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'admin')", id, email, name);
  return (await findUserById(id))!;
}

export async function updateAdmin(id: string, email: string, name: string) {
  const db = await getDb();
  await db.run("UPDATE users SET email = ?, name = ? WHERE id = ? AND role = 'admin'", email, name, id);
}

export async function deleteAdmin(id: string) {
  const db = await getDb();
  await db.run("UPDATE deals SET lead_agent_id = NULL WHERE lead_agent_id = ?", id);
  await db.run("UPDATE deals SET created_by = NULL WHERE created_by = ?", id);
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", id);
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE admin_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE admin_id = ?", id);
  await db.run("DELETE FROM users WHERE id = ? AND role = 'admin'", id);
}

export async function markAdminSignIn(user: User, profileName?: string) {
  const incoming = profileName?.trim();
  const fallback = user.email.split("@")[0] || "Admin";
  const name = incoming && (user.name === fallback || user.name === user.email) ? incoming : user.name;
  const db = await getDb();
  await db.run(
    "UPDATE users SET name = ?, signed_in_at = datetime('now') WHERE id = ? AND role = 'admin'",
    name,
    user.id,
  );
  return (await findUserById(user.id)) ?? user;
}

export async function listAdminListingGrants() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string }>("SELECT user_id, property_id FROM admin_listing_grants");
}

export async function listAdminClientGrants() {
  const db = await getDb();
  return db.all<{ user_id: string; client_id: string }>("SELECT user_id, client_id FROM admin_client_grants");
}

export async function replaceAdminGrants(userId: string, propertyIds: string[], clientIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM properties WHERE id IN (${placeholders})`,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) return false;
  }
  if (clientIds.length > 0) {
    const placeholders = clientIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM users WHERE role = 'client' AND id IN (${placeholders})`,
      ...clientIds,
    );
    if (found.length !== clientIds.length) return false;
  }
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ?", userId);
  for (const propertyId of propertyIds) {
    await db.run("INSERT INTO admin_listing_grants (user_id, property_id) VALUES (?, ?)", userId, propertyId);
  }
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ?", userId);
  for (const clientId of clientIds) {
    await db.run("INSERT INTO admin_client_grants (user_id, client_id) VALUES (?, ?)", userId, clientId);
  }
  return true;
}

export async function adminCanViewProperties(userId: string, propertyIds: string[]) {
  if (propertyIds.length === 0) return true;
  const db = await getDb();
  const placeholders = propertyIds.map(() => "?").join(", ");
  const rows = await db.all<{ property_id: string }>(
    `SELECT g.property_id
     FROM admin_listing_grants g
     JOIN properties p ON p.id = g.property_id
     WHERE g.user_id = ? AND IFNULL(p.hidden, 0) = 0 AND g.property_id IN (${placeholders})`,
    userId,
    ...propertyIds,
  );
  return rows.length === propertyIds.length;
}

export async function listClients(options?: { hidden?: boolean }) {
  const db = await getDb();
  const clients = await db.all<User>(
    `SELECT u.*, creator.name AS created_by_name
     FROM users u
     LEFT JOIN users creator ON creator.id = u.created_by
     WHERE u.role = 'client' AND IFNULL(u.hidden, 0) = ?
     ORDER BY u.name COLLATE NOCASE ASC`,
    options?.hidden ? 1 : 0,
  );
  return clients.map(presentClient);
}

export async function insertClient(input: ClientInput, createdBy: string | null = null) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO users (id, email, name, phone, role, share_token, company_website, company_zip, created_by) VALUES (?, ?, ?, ?, 'client', ?, ?, ?, ?)",
    id,
    clientEmailForStorage(input.email, id),
    input.name,
    input.phone,
    newShareToken(),
    input.companyWebsite,
    input.companyZip,
    createdBy,
  );
  return presentClient((await findUserById(id))!);
}

export async function findClientByShareToken(token: string) {
  const db = await getDb();
  return db.get<User>(
    "SELECT * FROM users WHERE role = 'client' AND share_token = ? AND IFNULL(hidden, 0) = 0",
    token,
  );
}

export async function updateClient(id: string, input: ClientInput) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET name = ?, email = ?, phone = ?, company_website = ?, company_zip = ? WHERE id = ? AND role = 'client'",
    input.name,
    clientEmailForStorage(input.email, id),
    input.phone,
    input.companyWebsite,
    input.companyZip,
    id,
  );
}

export async function setClientLogo(id: string, logoKey: string | null, contentType: string | null) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET logo_key = ?, logo_content_type = ? WHERE id = ? AND role = 'client'",
    logoKey,
    contentType,
    id,
  );
}

export async function setAdminAvatar(id: string, logoKey: string | null, contentType: string | null) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET logo_key = ?, logo_content_type = ? WHERE id = ? AND role = 'admin'",
    logoKey,
    contentType,
    id,
  );
}

export async function deleteClient(id: string) {
  const db = await getDb();
  const documents = await db.all<{ storage_key: string }>(
    "SELECT storage_key FROM client_documents WHERE client_id = ?",
    id,
  );
  const dealDocuments = await db.all<{ storage_key: string }>(
    `SELECT storage_key FROM deal_documents
     WHERE deal_id IN (SELECT id FROM deals WHERE client_id = ?)`,
    id,
  );
  await db.run("DELETE FROM listing_likes WHERE user_id = ?", id);
  await db.run("DELETE FROM street_number_hides WHERE user_id = ?", id);
  await db.run("DELETE FROM client_documents WHERE client_id = ?", id);
  await db.run("DELETE FROM deal_documents WHERE deal_id IN (SELECT id FROM deals WHERE client_id = ?)", id);
  await db.run("DELETE FROM deals WHERE client_id = ?", id);
  await db.run("DELETE FROM property_assignments WHERE user_id = ?", id);
  await db.run("DELETE FROM admin_client_grants WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE client_id = ?", id);
  await db.run("DELETE FROM users WHERE id = ? AND role = 'client'", id);
  return [...documents, ...dealDocuments].map((document) => document.storage_key);
}

const PROPERTY_LIST_SQL = `SELECT p.*, creator.name AS created_by_name, ${COVER_SQL}
  FROM properties p
  LEFT JOIN users creator ON creator.id = p.created_by`;

export async function listProperties(options?: { hidden?: boolean }) {
  const db = await getDb();
  return db.all<PropertyListItem>(
    `${PROPERTY_LIST_SQL}
     WHERE IFNULL(p.hidden, 0) = ?
     ORDER BY p.updated_at DESC`,
    options?.hidden ? 1 : 0,
  );
}

export async function listPropertiesForAdmin(userId: string) {
  const db = await getDb();
  const rows = await db.all<PropertyListItem>(
    `${PROPERTY_LIST_SQL}
     JOIN admin_listing_grants g ON g.property_id = p.id
     WHERE g.user_id = ? AND IFNULL(p.hidden, 0) = 0
     ORDER BY p.updated_at DESC`,
    userId,
  );
  return withAdminListingEdits(userId, rows);
}

export async function listClientsForAdmin(userId: string) {
  const db = await getDb();
  const clients = await db.all<User>(
    `SELECT u.*, creator.name AS created_by_name
     FROM users u
     JOIN admin_client_grants g ON g.client_id = u.id
     LEFT JOIN users creator ON creator.id = u.created_by
     WHERE g.user_id = ? AND u.role = 'client' AND IFNULL(u.hidden, 0) = 0
     ORDER BY u.name COLLATE NOCASE ASC`,
    userId,
  );
  return withAdminClientEdits(userId, clients.map(presentClient));
}

export async function listPropertiesForUser(userId: string) {
  const db = await getDb();
  const client = await db.get<{ created_by: string | null }>(
    "SELECT created_by FROM users WHERE id = ? AND role = 'client' AND IFNULL(hidden, 0) = 0",
    userId,
  );
  if (!client) return [];
  const pickSet = client.created_by ? await hasAdminPickSet(client.created_by, userId) : false;
  const rows = await db.all<PropertyListItem>(
    pickSet
      ? `${PROPERTY_LIST_SQL}
         JOIN admin_client_picks a ON a.property_id = p.id
         WHERE a.admin_id = ? AND a.client_id = ? AND IFNULL(p.hidden, 0) = 0
         ORDER BY p.updated_at DESC`
      : `${PROPERTY_LIST_SQL}
         JOIN property_assignments a ON a.property_id = p.id
         WHERE a.user_id = ? AND IFNULL(p.hidden, 0) = 0
         ORDER BY p.updated_at DESC`,
    ...(pickSet ? [client.created_by, userId] : [userId]),
  );
  const edited = client.created_by ? await withAdminListingEdits(client.created_by, rows) : rows;
  return redactStreetNumbers(userId, edited);
}

export async function getProperty(id: string) {
  const db = await getDb();
  return db.get<Property>("SELECT * FROM properties WHERE id = ?", id);
}

export async function insertProperty(
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
  createdBy: string | null = null,
) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO properties (
      id, address, unit, price_cents, listing_type, neighborhood, sqft, sqft_optional,
      bedrooms, bathrooms, amenities, description, status, is_inactive, key_money_cents,
      possession, terms, frontage, ceiling_height, neighboring_tenants, lat, lng, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.sqft_optional,
    input.bedrooms,
    input.bathrooms,
    serializeAmenities(input.amenities),
    input.description,
    input.status,
    input.is_inactive,
    input.key_money_cents,
    input.possession,
    input.terms,
    input.frontage,
    input.ceiling_height,
    input.neighboring_tenants,
    coords?.lat ?? null,
    coords?.lng ?? null,
    createdBy,
  );
  return id;
}

export async function publishProperty(
  actor: User,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const id = await insertProperty(input, coords, actor.id);
  if (actor.role === "admin") await grantAdminListing(actor.id, id);
  return id;
}

export async function publishClient(actor: User, input: ClientInput) {
  const client = await insertClient(input, actor.id);
  if (actor.role === "admin") await grantAdminClient(actor.id, client.id);
  return client;
}

export async function setPropertyStatus(id: string, status: ListingStatus) {
  const db = await getDb();
  await db.run(
    `UPDATE properties
     SET status = ?, is_inactive = ?, updated_at = datetime('now')
     WHERE id = ?`,
    status,
    status === "inactive" ? 1 : 0,
    id,
  );
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const db = await getDb();
  await db.run(
    `UPDATE properties SET
      address = ?, unit = ?, price_cents = ?, listing_type = ?, neighborhood = ?,
      sqft = ?, sqft_optional = ?, bedrooms = ?, bathrooms = ?, amenities = ?,
      description = ?, status = ?, is_inactive = ?, key_money_cents = ?, possession = ?,
      terms = ?, frontage = ?, ceiling_height = ?, neighboring_tenants = ?, lat = ?,
      lng = ?, updated_at = datetime('now')
     WHERE id = ?`,
    input.address,
    input.unit,
    input.price_cents,
    input.listing_type,
    input.neighborhood,
    input.sqft,
    input.sqft_optional,
    input.bedrooms,
    input.bathrooms,
    serializeAmenities(input.amenities),
    input.description,
    input.status,
    input.is_inactive,
    input.key_money_cents,
    input.possession,
    input.terms,
    input.frontage,
    input.ceiling_height,
    input.neighboring_tenants,
    coords?.lat ?? null,
    coords?.lng ?? null,
    id,
  );
}

export async function deleteProperty(id: string) {
  const db = await getDb();
  const media = await listMedia(id);
  const documents = await db.all<{ storage_key: string }>(
    "SELECT storage_key FROM client_documents WHERE property_id = ?",
    id,
  );
  await db.run("DELETE FROM listing_likes WHERE property_id = ?", id);
  await db.run("DELETE FROM client_documents WHERE property_id = ?", id);
  await db.run("DELETE FROM street_number_hides WHERE property_id = ?", id);
  await db.run("DELETE FROM property_assignments WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_listing_grants WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE property_id = ?", id);
  await db.run("DELETE FROM property_media WHERE property_id = ?", id);
  await db.run("UPDATE deals SET property_id = NULL WHERE property_id = ?", id);
  await db.run("DELETE FROM properties WHERE id = ?", id);
  return { media, documentKeys: documents.map((document) => document.storage_key) };
}

export async function listPropertiesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db.all<Property>(
    `SELECT * FROM properties WHERE id IN (${placeholders})`,
    ...ids,
  );
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export async function listImageIdsForProperties(propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const db = await getDb();
  const placeholders = propertyIds.map(() => "?").join(", ");
  return db.all<{ id: string; property_id: string }>(
    `SELECT id, property_id FROM property_media
     WHERE kind = 'image' AND property_id IN (${placeholders})
     ORDER BY sort_order ASC, created_at ASC`,
    ...propertyIds,
  );
}

export async function listMedia(propertyId: string) {
  const db = await getDb();
  return db.all<PropertyMedia>(
    "SELECT * FROM property_media WHERE property_id = ? ORDER BY kind ASC, sort_order ASC, created_at ASC",
    propertyId,
  );
}

export async function getMedia(id: string) {
  const db = await getDb();
  return db.get<PropertyMedia>("SELECT * FROM property_media WHERE id = ?", id);
}

export async function countImages(propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM property_media WHERE property_id = ? AND kind = 'image'",
    propertyId,
  );
  return Number(row?.count ?? 0);
}

export async function nextImageSort(propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ max_sort: number | null }>(
    "SELECT MAX(sort_order) AS max_sort FROM property_media WHERE property_id = ? AND kind = 'image'",
    propertyId,
  );
  return Number(row?.max_sort ?? -1) + 1;
}

export async function existingVideo(propertyId: string) {
  const db = await getDb();
  return db.get<PropertyMedia>(
    "SELECT * FROM property_media WHERE property_id = ? AND kind = 'video' LIMIT 1",
    propertyId,
  );
}

export async function insertMedia(media: {
  id: string;
  propertyId: string;
  kind: "image" | "video";
  storageKey: string;
  contentType: string;
  originalName: string;
  sortOrder: number;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO property_media (
      id, property_id, kind, storage_key, content_type, original_name, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    media.id,
    media.propertyId,
    media.kind,
    media.storageKey,
    media.contentType,
    media.originalName,
    media.sortOrder,
  );
  await db.run("UPDATE properties SET updated_at = datetime('now') WHERE id = ?", media.propertyId);
}

export async function deleteMediaRow(id: string) {
  const db = await getDb();
  await db.run("DELETE FROM property_media WHERE id = ?", id);
}

export async function makeCover(propertyId: string, mediaId: string) {
  const images = (await listMedia(propertyId)).filter((item) => item.kind === "image");
  const chosen = images.find((item) => item.id === mediaId);
  if (!chosen) return false;
  const ordered = [chosen, ...images.filter((item) => item.id !== chosen.id)];
  const db = await getDb();
  for (let index = 0; index < ordered.length; index += 1) {
    await db.run("UPDATE property_media SET sort_order = ? WHERE id = ?", index, ordered[index].id);
  }
  return true;
}

export async function listAssignments() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string }>(
    "SELECT user_id, property_id FROM property_assignments",
  );
}

export async function adminCanViewClient(userId: string, clientId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok
     FROM admin_client_grants g
     JOIN users u ON u.id = g.client_id
     WHERE g.user_id = ? AND g.client_id = ? AND u.role = 'client' AND IFNULL(u.hidden, 0) = 0`,
    userId,
    clientId,
  );
  return Boolean(row);
}

export async function adminCanViewProperty(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok
     FROM admin_listing_grants g
     JOIN properties p ON p.id = g.property_id
     WHERE g.user_id = ? AND g.property_id = ? AND IFNULL(p.hidden, 0) = 0`,
    userId,
    propertyId,
  );
  return Boolean(row);
}

export async function userCanSeeProperty(user: { id: string; role: User["role"] }, propertyId: string) {
  const db = await getDb();
  const property = await db.get<{ hidden: number }>("SELECT hidden FROM properties WHERE id = ?", propertyId);
  if (!property) return false;
  if (user.role === "super_admin") return true;
  if (property.hidden) return false;
  if (user.role === "admin") return adminCanViewProperty(user.id, propertyId);
  return userCanViewProperty(user.id, propertyId);
}

export async function userCanViewProperty(userId: string, propertyId: string) {
  const db = await getDb();
  const client = await db.get<{ created_by: string | null }>(
    "SELECT created_by FROM users WHERE id = ? AND role = 'client' AND IFNULL(hidden, 0) = 0",
    userId,
  );
  if (!client) return false;
  const property = await db.get<{ hidden: number }>("SELECT hidden FROM properties WHERE id = ?", propertyId);
  if (!property || property.hidden) return false;
  if (client.created_by && (await hasAdminPickSet(client.created_by, userId))) {
    const pick = await db.get<{ ok: number }>(
      "SELECT 1 AS ok FROM admin_client_picks WHERE admin_id = ? AND client_id = ? AND property_id = ?",
      client.created_by,
      userId,
      propertyId,
    );
    return Boolean(pick);
  }
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM property_assignments WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return Boolean(row);
}

type ListingOverlay = {
  address: string;
  unit: string | null;
  price_cents: number;
  listing_type: Property["listing_type"];
  neighborhood: string;
  sqft: number | null;
  sqft_optional: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string;
  description: string;
  status: ListingStatus;
  is_inactive: number;
  key_money_cents: number | null;
  possession: string;
  terms: string;
  frontage: string;
  ceiling_height: string;
  neighboring_tenants: string;
  lat: number | null;
  lng: number | null;
};

type ClientOverlay = {
  name: string;
  email: string;
  phone: string;
  company_website: string;
  company_zip: string;
};

function listingOverlayFromInput(input: PropertyInput, coords: { lat: number; lng: number } | null): ListingOverlay {
  return {
    address: input.address,
    unit: input.unit,
    price_cents: input.price_cents,
    listing_type: input.listing_type,
    neighborhood: input.neighborhood,
    sqft: input.sqft,
    sqft_optional: input.sqft_optional,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    amenities: serializeAmenities(input.amenities),
    description: input.description,
    status: input.status,
    is_inactive: input.is_inactive,
    key_money_cents: input.key_money_cents,
    possession: input.possession,
    terms: input.terms,
    frontage: input.frontage,
    ceiling_height: input.ceiling_height,
    neighboring_tenants: input.neighboring_tenants,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
}

function listingOverlayFromProperty(property: Property): ListingOverlay {
  return {
    address: property.address,
    unit: property.unit,
    price_cents: property.price_cents,
    listing_type: property.listing_type,
    neighborhood: property.neighborhood,
    sqft: property.sqft,
    sqft_optional: property.sqft_optional,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    amenities: property.amenities,
    description: property.description,
    status: property.status,
    is_inactive: property.is_inactive,
    key_money_cents: property.key_money_cents,
    possession: property.possession,
    terms: property.terms,
    frontage: property.frontage,
    ceiling_height: property.ceiling_height,
    neighboring_tenants: property.neighboring_tenants,
    lat: property.lat,
    lng: property.lng,
  };
}

function readJson<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

async function withAdminListingEdits<T extends Property>(adminId: string, rows: T[]) {
  if (rows.length === 0) return rows;
  const db = await getDb();
  const placeholders = rows.map(() => "?").join(", ");
  const edits = await db.all<{ property_id: string; payload: string }>(
    `SELECT property_id, payload FROM admin_listing_edits WHERE admin_id = ? AND property_id IN (${placeholders})`,
    adminId,
    ...rows.map((row) => row.id),
  );
  const byId = new Map(edits.map((edit) => [edit.property_id, edit.payload]));
  return rows.map((row) => {
    const payload = byId.get(row.id);
    if (!payload) return row;
    const data = readJson<Partial<ListingOverlay>>(payload);
    return data ? { ...row, ...data } : row;
  });
}

async function withAdminClientEdits(adminId: string, rows: User[]) {
  if (rows.length === 0) return rows;
  const db = await getDb();
  const placeholders = rows.map(() => "?").join(", ");
  const edits = await db.all<{ client_id: string; payload: string }>(
    `SELECT client_id, payload FROM admin_client_edits WHERE admin_id = ? AND client_id IN (${placeholders})`,
    adminId,
    ...rows.map((row) => row.id),
  );
  const byId = new Map(edits.map((edit) => [edit.client_id, edit.payload]));
  return rows.map((row) => {
    if (row.created_by !== adminId) return row;
    const payload = byId.get(row.id);
    if (!payload) return row;
    const data = readJson<ClientOverlay>(payload);
    return data ? { ...row, ...data } : row;
  });
}

async function hasAdminPickSet(adminId: string, clientId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM admin_client_pick_sets WHERE admin_id = ? AND client_id = ?",
    adminId,
    clientId,
  );
  return Boolean(row);
}

export async function grantAdminListing(adminId: string, propertyId: string) {
  const db = await getDb();
  await db.run(
    "INSERT OR IGNORE INTO admin_listing_grants (user_id, property_id) VALUES (?, ?)",
    adminId,
    propertyId,
  );
}

export async function grantAdminClient(adminId: string, clientId: string) {
  const db = await getDb();
  await db.run(
    "INSERT OR IGNORE INTO admin_client_grants (user_id, client_id) VALUES (?, ?)",
    adminId,
    clientId,
  );
}

export async function removeAdminListingGrant(adminId: string, propertyId: string) {
  const db = await getDb();
  await db.run("DELETE FROM admin_listing_grants WHERE user_id = ? AND property_id = ?", adminId, propertyId);
}

export async function removeAdminClientGrant(adminId: string, clientId: string) {
  const db = await getDb();
  await db.run("DELETE FROM admin_client_grants WHERE user_id = ? AND client_id = ?", adminId, clientId);
}

export async function saveListingOverlay(
  adminId: string,
  propertyId: string,
  input: PropertyInput,
  coords: { lat: number; lng: number } | null,
) {
  const db = await getDb();
  await db.run(
    `INSERT INTO admin_listing_edits (admin_id, property_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, property_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    propertyId,
    JSON.stringify(listingOverlayFromInput(input, coords)),
  );
}

export async function saveListingStatusOverlay(adminId: string, property: Property, status: ListingStatus) {
  const db = await getDb();
  const existing = await db.get<{ payload: string }>(
    "SELECT payload FROM admin_listing_edits WHERE admin_id = ? AND property_id = ?",
    adminId,
    property.id,
  );
  const base = (existing && readJson<ListingOverlay>(existing.payload)) || listingOverlayFromProperty(property);
  base.status = status;
  base.is_inactive = status === "inactive" ? 1 : 0;
  await db.run(
    `INSERT INTO admin_listing_edits (admin_id, property_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, property_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    property.id,
    JSON.stringify(base),
  );
}

export async function saveClientOverlay(adminId: string, clientId: string, input: ClientInput) {
  const db = await getDb();
  const payload: ClientOverlay = {
    name: input.name,
    email: input.email,
    phone: input.phone,
    company_website: input.companyWebsite,
    company_zip: input.companyZip,
  };
  await db.run(
    `INSERT INTO admin_client_edits (admin_id, client_id, payload, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(admin_id, client_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    adminId,
    clientId,
    JSON.stringify(payload),
  );
}

export async function propertyForEditor(adminId: string, property: Property) {
  return (await withAdminListingEdits(adminId, [property]))[0];
}

const CLIENT_DOCUMENT_SQL = `SELECT d.id, d.client_id, d.property_id, d.storage_key, d.content_type, d.original_name, d.created_at, p.address, p.unit
  FROM client_documents d
  JOIN properties p ON p.id = d.property_id`;

export async function listClientDocuments(clientIds: string[]) {
  if (clientIds.length === 0) return [];
  const db = await getDb();
  const placeholders = clientIds.map(() => "?").join(", ");
  return db.all<ClientDocument>(
    `${CLIENT_DOCUMENT_SQL}
     WHERE d.client_id IN (${placeholders})
     ORDER BY d.created_at DESC, d.original_name COLLATE NOCASE ASC`,
    ...clientIds,
  );
}

export async function getClientDocument(id: string) {
  const db = await getDb();
  return db.get<ClientDocument>(`${CLIENT_DOCUMENT_SQL} WHERE d.id = ?`, id);
}

export async function countClientDocuments(clientId: string) {
  const db = await getDb();
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM client_documents WHERE client_id = ?", clientId);
  return row?.n ?? 0;
}

export async function insertClientDocument(input: {
  id: string;
  clientId: string;
  propertyId: string;
  storageKey: string;
  contentType: string;
  originalName: string;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO client_documents (id, client_id, property_id, storage_key, content_type, original_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.id,
    input.clientId,
    input.propertyId,
    input.storageKey,
    input.contentType,
    input.originalName,
  );
  return getClientDocument(input.id);
}

export async function setClientDocumentListing(id: string, propertyId: string) {
  const db = await getDb();
  await db.run("UPDATE client_documents SET property_id = ? WHERE id = ?", propertyId, id);
}

export async function deleteClientDocument(id: string) {
  const db = await getDb();
  const existing = await db.get<{ storage_key: string }>("SELECT storage_key FROM client_documents WHERE id = ?", id);
  if (!existing) return null;
  await db.run("DELETE FROM client_documents WHERE id = ?", id);
  return existing.storage_key;
}

export async function listStreetNumberHides() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string }>(
    "SELECT user_id, property_id FROM street_number_hides",
  );
}

export async function setStreetNumberHidden(userId: string, propertyId: string, hidden: boolean) {
  const property = await getProperty(propertyId);
  if (!property) return { error: "That listing no longer exists.", status: 404 } as const;
  if (property.listing_type === "commercial") {
    return { error: "Street numbers can be hidden on rentals and sales.", status: 400 } as const;
  }
  const db = await getDb();
  const assigned = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM property_assignments WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  if (!assigned) return { error: "Put this listing on their page first.", status: 400 } as const;
  if (hidden) {
    await db.run(
      "INSERT OR IGNORE INTO street_number_hides (user_id, property_id) VALUES (?, ?)",
      userId,
      propertyId,
    );
  } else {
    await db.run("DELETE FROM street_number_hides WHERE user_id = ? AND property_id = ?", userId, propertyId);
  }
  return { hidden } as const;
}

async function redactStreetNumbers<T extends Property>(userId: string, properties: T[]) {
  if (properties.length === 0) return properties;
  const db = await getDb();
  const rows = await db.all<{ property_id: string }>(
    "SELECT property_id FROM street_number_hides WHERE user_id = ?",
    userId,
  );
  if (rows.length === 0) return properties;
  const hidden = new Set(rows.map((row) => row.property_id));
  return properties.map((property) => {
    if (!hidden.has(property.id) || property.listing_type === "commercial") return property;
    const address = hideStreetNumber(property.address);
    return address === property.address ? property : { ...property, address };
  });
}

export async function clientAsCreatorSees(client: User) {
  const presented = presentClient(client);
  if (!client.created_by) return presented;
  return (await withAdminClientEdits(client.created_by, [presented]))[0];
}

export async function listingForClient(client: User, property: Property) {
  const shown = client.created_by ? (await withAdminListingEdits(client.created_by, [property]))[0] : property;
  return (await redactStreetNumbers(client.id, [shown]))[0];
}

export async function listingEditor(user: User, propertyId: string) {
  const property = await getProperty(propertyId);
  if (!property) return "missing" as const;
  if (user.role === "super_admin") return { property, master: true as const };
  if (user.role === "admin" && property.created_by === user.id && !property.hidden) {
    return { property, master: false as const };
  }
  return "forbidden" as const;
}

export async function clientEditor(user: User, clientId: string) {
  const client = await findUserById(clientId);
  if (!client || client.role !== "client") return "missing" as const;
  if (user.role === "super_admin") return { client, master: true as const };
  if (client.hidden) return "missing" as const;
  if (user.role === "admin" && client.created_by === user.id && (await adminCanViewClient(user.id, client.id))) {
    return { client, master: false as const };
  }
  return "forbidden" as const;
}

export async function replaceAdminClientPicks(adminId: string, clientId: string, propertyIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT p.id
       FROM properties p
       JOIN admin_listing_grants g ON g.property_id = p.id AND g.user_id = ?
       WHERE p.id IN (${placeholders}) AND IFNULL(p.hidden, 0) = 0`,
      adminId,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) return false;
  }
  await db.run("DELETE FROM admin_client_picks WHERE admin_id = ? AND client_id = ?", adminId, clientId);
  for (const propertyId of propertyIds) {
    await db.run(
      "INSERT INTO admin_client_picks (admin_id, client_id, property_id) VALUES (?, ?, ?)",
      adminId,
      clientId,
      propertyId,
    );
  }
  await db.run(
    "INSERT OR IGNORE INTO admin_client_pick_sets (admin_id, client_id) VALUES (?, ?)",
    adminId,
    clientId,
  );
  return true;
}

export async function assignmentIdsForAdminView(adminId: string, client: User, masterIds: string[]) {
  if (client.created_by !== adminId) return masterIds;
  if (!(await hasAdminPickSet(adminId, client.id))) return masterIds;
  const db = await getDb();
  const rows = await db.all<{ property_id: string }>(
    "SELECT property_id FROM admin_client_picks WHERE admin_id = ? AND client_id = ?",
    adminId,
    client.id,
  );
  return rows.map((row) => row.property_id);
}

export async function setPropertyHidden(id: string, hidden: boolean) {
  const db = await getDb();
  await db.run("UPDATE properties SET hidden = ?, updated_at = datetime('now') WHERE id = ?", hidden ? 1 : 0, id);
  if (!hidden) return;
  await db.run("DELETE FROM admin_listing_grants WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_listing_edits WHERE property_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE property_id = ?", id);
}

export async function setClientHidden(id: string, hidden: boolean) {
  const db = await getDb();
  await db.run("UPDATE users SET hidden = ? WHERE id = ? AND role = 'client'", hidden ? 1 : 0, id);
  if (!hidden) return;
  await db.run("DELETE FROM admin_client_grants WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_edits WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_picks WHERE client_id = ?", id);
  await db.run("DELETE FROM admin_client_pick_sets WHERE client_id = ?", id);
}

export async function setClientFlag(id: string, flagged: boolean, note: string) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET flagged = ?, flag_note = ? WHERE id = ? AND role = 'client'",
    flagged ? 1 : 0,
    flagged ? note.trim() : "",
    id,
  );
}

export async function listLikedPropertyIds(userId: string) {
  const db = await getDb();
  const rows = await db.all<{ property_id: string }>(
    "SELECT property_id FROM listing_likes WHERE user_id = ? ORDER BY created_at DESC",
    userId,
  );
  return rows.map((row) => row.property_id);
}

export async function isListingLiked(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return Boolean(row);
}

export async function listClientInterest(userId: string) {
  const db = await getDb();
  const rows = await db.all<{ property_id: string; tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT property_id, tour_requested, tour_scheduled_at FROM listing_likes WHERE user_id = ? ORDER BY tour_requested DESC, created_at DESC",
    userId,
  );
  const tourSchedules: Record<string, string> = {};
  for (const row of rows) {
    if (row.tour_requested && row.tour_scheduled_at) tourSchedules[row.property_id] = row.tour_scheduled_at;
  }
  return {
    likedIds: rows.map((row) => row.property_id),
    tourIds: rows.filter((row) => row.tour_requested).map((row) => row.property_id),
    tourSchedules,
  };
}

export async function getListingInterest(userId: string, propertyId: string) {
  const db = await getDb();
  const row = await db.get<{ tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT tour_requested, tour_scheduled_at FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  return {
    liked: Boolean(row),
    tourRequested: Boolean(row?.tour_requested),
    tourScheduledAt: row?.tour_requested && row.tour_scheduled_at ? row.tour_scheduled_at : null,
  };
}

export async function listLikes() {
  const db = await getDb();
  return db.all<{ user_id: string; property_id: string; tour_requested: number; tour_scheduled_at: string | null }>(
    "SELECT user_id, property_id, tour_requested, tour_scheduled_at FROM listing_likes ORDER BY tour_requested DESC, created_at DESC, property_id ASC",
  );
}

export async function listInterestedClients(propertyId: string) {
  const db = await getDb();
  return db.all<{ id: string; name: string; tour_requested: number; tour_scheduled_at: string | null }>(
    `SELECT u.id, u.name, l.tour_requested, l.tour_scheduled_at
     FROM listing_likes l
     JOIN users u ON u.id = l.user_id
     WHERE l.property_id = ? AND u.role = 'client'
     ORDER BY l.tour_requested DESC, l.created_at DESC, u.name COLLATE NOCASE ASC`,
    propertyId,
  );
}

export async function setTourRequest(userId: string, propertyId: string, requested: boolean) {
  if (!(await userCanViewProperty(userId, propertyId))) return false;
  if (!(await isListingLiked(userId, propertyId))) return false;
  const db = await getDb();
  await db.run(
    "UPDATE listing_likes SET tour_requested = ?, tour_scheduled_at = CASE WHEN ? = 0 THEN NULL ELSE tour_scheduled_at END WHERE user_id = ? AND property_id = ?",
    requested ? 1 : 0,
    requested ? 1 : 0,
    userId,
    propertyId,
  );
  return true;
}

export async function scheduleTour(userId: string, propertyId: string, scheduledAt: string | null) {
  const db = await getDb();
  const row = await db.get<{ tour_requested: number }>(
    "SELECT tour_requested FROM listing_likes WHERE user_id = ? AND property_id = ?",
    userId,
    propertyId,
  );
  if (!row?.tour_requested) return false;
  await db.run(
    "UPDATE listing_likes SET tour_scheduled_at = ? WHERE user_id = ? AND property_id = ?",
    scheduledAt,
    userId,
    propertyId,
  );
  return true;
}

export async function setListingLike(userId: string, propertyId: string, liked: boolean) {
  const allowed = await userCanViewProperty(userId, propertyId);
  if (!allowed) return false;
  const db = await getDb();
  if (liked) {
    await db.run(
      "INSERT OR IGNORE INTO listing_likes (user_id, property_id) VALUES (?, ?)",
      userId,
      propertyId,
    );
  } else {
    await db.run("DELETE FROM listing_likes WHERE user_id = ? AND property_id = ?", userId, propertyId);
  }
  return true;
}

const DEAL_SQL = `SELECT d.id, d.client_id, d.property_id, d.address, d.unit, d.city, d.state, d.zip,
  d.deal_type, d.represented, d.monthly_rent_cents, d.lease_start, d.lease_end,
  d.fee_payer, d.fee_payer_note, d.publicly_advertised, d.lead_source, d.lead_agent_id,
  d.created_by, d.created_at, d.updated_at,
  client.name AS client_name,
  agent.name AS lead_agent_name
  FROM deals d
  JOIN users client ON client.id = d.client_id
  LEFT JOIN users agent ON agent.id = d.lead_agent_id`;

export async function listStaff() {
  const db = await getDb();
  return db.all<User>(
    `SELECT * FROM users
     WHERE role IN ('super_admin', 'admin')
     ORDER BY name COLLATE NOCASE ASC, email COLLATE NOCASE ASC`,
  );
}

export async function listDealsForDashboard(user: User) {
  const db = await getDb();
  if (user.role === "super_admin") {
    return db.all<Deal>(`${DEAL_SQL} ORDER BY d.updated_at DESC, client.name COLLATE NOCASE ASC`);
  }
  return db.all<Deal>(
    `${DEAL_SQL}
     WHERE d.client_id IN (SELECT client_id FROM admin_client_grants WHERE user_id = ?)
        OR d.lead_agent_id = ?
        OR d.created_by = ?
     ORDER BY d.updated_at DESC, client.name COLLATE NOCASE ASC`,
    user.id,
    user.id,
    user.id,
  );
}

export async function listDealsForClients(clientIds: string[]) {
  if (clientIds.length === 0) return [];
  const db = await getDb();
  const placeholders = clientIds.map(() => "?").join(", ");
  return db.all<Deal>(
    `${DEAL_SQL} WHERE d.client_id IN (${placeholders}) ORDER BY d.updated_at DESC`,
    ...clientIds,
  );
}

export async function listDealsForClient(clientId: string) {
  const db = await getDb();
  return db.all<Deal>(`${DEAL_SQL} WHERE d.client_id = ? ORDER BY d.updated_at DESC`, clientId);
}

export async function getDeal(id: string) {
  const db = await getDb();
  return db.get<Deal>(`${DEAL_SQL} WHERE d.id = ?`, id);
}

export async function dealEditor(user: User, dealId: string) {
  const deal = await getDeal(dealId);
  if (!deal) return "missing" as const;
  if (user.role === "super_admin") return { deal };
  if (user.role !== "admin") return "forbidden" as const;
  if (deal.lead_agent_id === user.id || deal.created_by === user.id) return { deal };
  if (await adminCanViewClient(user.id, deal.client_id)) return { deal };
  return "forbidden" as const;
}

export async function clientForDeal(user: User, clientId: string, currentClientId: string | null = null) {
  if (currentClientId && clientId === currentClientId) {
    const current = await findUserById(clientId);
    if (!current || current.role !== "client") return null;
    if (user.role === "super_admin" || user.role === "admin") return current;
    return null;
  }
  const client = await findUserById(clientId);
  if (!client || client.role !== "client") return null;
  if (user.role === "super_admin") return client;
  if (client.hidden) return null;
  if (user.role === "admin" && (await adminCanViewClient(user.id, client.id))) return client;
  return null;
}

export async function staffForDeal(id: string) {
  const person = await findUserById(id);
  if (!person || (person.role !== "super_admin" && person.role !== "admin")) return null;
  return person;
}

export async function propertyForDeal(user: User, propertyId: string | null, currentPropertyId: string | null) {
  if (!propertyId) return true;
  if (propertyId === currentPropertyId) return Boolean(await getProperty(propertyId));
  return userCanSeeProperty(user, propertyId);
}

function dealValues(input: DealInput) {
  return [
    input.clientId,
    input.propertyId,
    input.address,
    input.unit,
    input.city,
    input.state,
    input.zip,
    input.dealType,
    input.represented,
    input.monthlyRentCents,
    input.leaseStart,
    input.leaseEnd,
    input.feePayer,
    input.feePayerNote,
    input.publiclyAdvertised ? 1 : 0,
    input.leadSource,
    input.leadAgentId,
  ] as const;
}

export async function insertDeal(input: DealInput, createdBy: string) {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO deals (
      id, client_id, property_id, address, unit, city, state, zip,
      deal_type, represented, monthly_rent_cents, lease_start, lease_end,
      fee_payer, fee_payer_note, publicly_advertised, lead_source, lead_agent_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ...dealValues(input),
    createdBy,
  );
  return (await getDeal(id))!;
}

export async function updateDeal(id: string, input: DealInput) {
  const db = await getDb();
  await db.run(
    `UPDATE deals SET
      client_id = ?, property_id = ?, address = ?, unit = ?, city = ?, state = ?, zip = ?,
      deal_type = ?, represented = ?, monthly_rent_cents = ?, lease_start = ?, lease_end = ?,
      fee_payer = ?, fee_payer_note = ?, publicly_advertised = ?, lead_source = ?, lead_agent_id = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
    ...dealValues(input),
    id,
  );
  return getDeal(id);
}

export async function deleteDeal(id: string) {
  const db = await getDb();
  const documents = await db.all<{ storage_key: string }>(
    "SELECT storage_key FROM deal_documents WHERE deal_id = ?",
    id,
  );
  await db.run("DELETE FROM deal_documents WHERE deal_id = ?", id);
  await db.run("DELETE FROM deals WHERE id = ?", id);
  return documents.map((document) => document.storage_key);
}

export async function listDealDocuments(dealIds: string[]) {
  if (dealIds.length === 0) return [];
  const db = await getDb();
  const placeholders = dealIds.map(() => "?").join(", ");
  return db.all<DealDocument>(
    `SELECT id, deal_id, storage_key, content_type, original_name, created_at
     FROM deal_documents
     WHERE deal_id IN (${placeholders})
     ORDER BY created_at DESC, original_name COLLATE NOCASE ASC`,
    ...dealIds,
  );
}

export async function getDealDocument(id: string) {
  const db = await getDb();
  return db.get<DealDocument>("SELECT * FROM deal_documents WHERE id = ?", id);
}

export async function countDealDocuments(dealId: string) {
  const db = await getDb();
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM deal_documents WHERE deal_id = ?", dealId);
  return row?.n ?? 0;
}

export async function insertDealDocument(input: {
  id: string;
  dealId: string;
  storageKey: string;
  contentType: string;
  originalName: string;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO deal_documents (id, deal_id, storage_key, content_type, original_name)
     VALUES (?, ?, ?, ?, ?)`,
    input.id,
    input.dealId,
    input.storageKey,
    input.contentType,
    input.originalName,
  );
  await db.run("UPDATE deals SET updated_at = datetime('now') WHERE id = ?", input.dealId);
  return getDealDocument(input.id);
}

export async function deleteDealDocument(id: string) {
  const db = await getDb();
  const existing = await db.get<{ deal_id: string; storage_key: string }>(
    "SELECT deal_id, storage_key FROM deal_documents WHERE id = ?",
    id,
  );
  if (!existing) return null;
  await db.run("DELETE FROM deal_documents WHERE id = ?", id);
  await db.run("UPDATE deals SET updated_at = datetime('now') WHERE id = ?", existing.deal_id);
  return existing.storage_key;
}

export async function replaceAssignments(userId: string, propertyIds: string[]) {
  const db = await getDb();
  if (propertyIds.length > 0) {
    const placeholders = propertyIds.map(() => "?").join(", ");
    const found = await db.all<{ id: string }>(
      `SELECT id FROM properties WHERE id IN (${placeholders})`,
      ...propertyIds,
    );
    if (found.length !== propertyIds.length) {
      return false;
    }
  }
  await db.run("DELETE FROM property_assignments WHERE user_id = ?", userId);
  for (const propertyId of propertyIds) {
    await db.run(
      "INSERT INTO property_assignments (property_id, user_id) VALUES (?, ?)",
      propertyId,
      userId,
    );
  }
  return true;
}
