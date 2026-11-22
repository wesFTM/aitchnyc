import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { emptyAmenities, type Amenities } from "@/lib/amenities";
import {
  fetchGraphqlViaUnlocker,
  fetchPageViaUnlocker,
  isUnlockerFailure,
  unlockerConfigured,
} from "@/lib/residential-unlocker";
import type { ListingStatus } from "@/lib/types";

const ENDPOINT = "https://api-v6.streeteasy.com/";
const PHOTO_HOST = "photos.zillowstatic.com";
const MAX_PHOTOS = 30;
const MAX_PHOTO_BYTES = 2_000_000;

const BROWSER_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Apollographql-Client-Name": "srp-frontend-service",
  "Apollographql-Client-Version": "version 50bef71ef923e981bdcb7c781851c3bfdb12a0c1",
  "App-Version": "1.0.0",
  "Content-Type": "application/json",
  Origin: "https://streeteasy.com",
  Os: "web",
  Referer: "https://streeteasy.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
};

export class StreetEasyImportError extends Error {}

export type StreetEasyFields = {
  address: string;
  unit: string;
  price: string;
  neighborhood: string;
  sqft: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
  status: ListingStatus;
  amenities: Amenities;
  photoUrls: string[];
};

export type StreetEasyDraft = Omit<StreetEasyFields, "photoUrls"> & {
  images: Uint8Array[];
};

type ListingRef = { kind: "rental"; id: string } | { kind: "building"; slug: string; unit: string };

type Photo = { key?: string | null } | null;

type RentalPayload = {
  rentalByListingId?: {
    status?: string | null;
    offMarketAt?: string | null;
    description?: string | null;
    pricing?: { price?: number | null } | null;
    propertyDetails?: {
      address?: {
        street?: string | null;
        city?: string | null;
        state?: string | null;
        zipCode?: string | null;
        unit?: string | null;
      } | null;
      bedroomCount?: number | null;
      fullBathroomCount?: number | null;
      halfBathroomCount?: number | null;
      livingAreaSize?: number | null;
      amenities?: {
        list?: string[] | null;
        doormanTypes?: string[] | null;
        sharedOutdoorSpaceTypes?: string[] | null;
      } | null;
      features?: {
        list?: string[] | null;
        privateOutdoorSpaceTypes?: string[] | null;
      } | null;
    } | null;
    media?: { photos?: Photo[] | null } | null;
  } | null;
  buildingByRentalListingId?: {
    type?: string | null;
    area?: { name?: string | null } | null;
    policies?: {
      list?: string[] | null;
      petPolicy?: { catsAllowed?: boolean | null; dogsAllowed?: boolean | null } | null;
    } | null;
  } | null;
};

type BuildingPayload = {
  buildingBySlug?: {
    rentalInventorySummary?: {
      availableListingDigests?: { id?: string | null; unit?: string | null; urlPath?: string | null }[] | null;
    } | null;
  } | null;
};

const RENTAL_QUERY = `
  query RentalListing($listingID: ID!) {
    rentalByListingId(id: $listingID) {
      status
      offMarketAt
      description
      pricing { price }
      propertyDetails {
        address { street city state zipCode unit }
        bedroomCount
        fullBathroomCount
        halfBathroomCount
        livingAreaSize
        amenities { list doormanTypes sharedOutdoorSpaceTypes }
        features { list privateOutdoorSpaceTypes }
      }
      media { photos { key } }
    }
    buildingByRentalListingId(id: $listingID) {
      type
      area { name }
      policies { list petPolicy { catsAllowed dogsAllowed } }
    }
  }
`;

const BUILDING_QUERY = `
  query BuildingBySlug($slug: String!) {
    buildingBySlug(slug: $slug) {
      rentalInventorySummary {
        availableListingDigests { id unit urlPath }
      }
    }
  }
`;

function fail(message: string): never {
  throw new StreetEasyImportError(message);
}

function blockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
}

export function parseStreetEasyLink(rawUrl: string): ListingRef {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    fail("Enter a full StreetEasy link, starting with https://.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (host !== "streeteasy.com" && host !== "www.streeteasy.com") ||
    blockedHost(host) ||
    (url.port && url.port !== "443")
  ) {
    fail("Paste an https://streeteasy.com rental link.");
  }
  const parts = url.pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (parts[0] === "sale") fail("Paste a rental listing. Sale links stay on StreetEasy.");
  if (parts[0] === "rental" && parts.length === 2 && /^\d{1,12}$/.test(parts[1])) {
    return { kind: "rental", id: parts[1] };
  }
  if (parts[0] === "building" && parts.length === 2) {
    fail("Paste the link for a specific unit, not the whole building.");
  }
  if (
    parts[0] === "building" &&
    parts.length === 3 &&
    /^[a-z0-9][a-z0-9_-]{0,120}$/i.test(parts[1]) &&
    parts[2].length > 0 &&
    parts[2].length <= 40
  ) {
    return { kind: "building", slug: parts[1], unit: parts[2] };
  }
  fail("Paste a StreetEasy rental link, like streeteasy.com/building/name/4a or streeteasy.com/rental/123.");
}

function compactUnit(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function listingIdForUnit(
  unit: string,
  digests: { id?: string | null; unit?: string | null; urlPath?: string | null }[],
) {
  const wanted = compactUnit(unit);
  const wantedPath = unit.toLowerCase();
  const matches = digests.filter((digest) => {
    const pathUnit = (digest.urlPath || "").split("/").filter(Boolean).pop() || "";
    return pathUnit.toLowerCase() === wantedPath || compactUnit(digest.unit || "") === wanted || compactUnit(pathUnit) === wanted;
  });
  const exact = matches.find((digest) => {
    const pathUnit = (digest.urlPath || "").split("/").filter(Boolean).pop() || "";
    return pathUnit.toLowerCase() === wantedPath;
  });
  const chosen = exact || matches[0];
  if (!chosen?.id) fail("That unit isn't an active rental. Paste the listing's /rental/ link if you have it.");
  return chosen.id;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function placeName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === trimmed.toUpperCase()) return titleCase(trimmed);
  return trimmed;
}

function listingAddress(address: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}) {
  const street = (address.street || "").trim().replace(/\s+/g, " ");
  if (!street) fail("Couldn't find an address on that listing.");
  const city = placeName(address.city || "New York");
  const state = (address.state || "NY").trim();
  const zip = (address.zipCode || "").trim();
  const place = [city, state].filter(Boolean).join(", ");
  const line = place ? `${street}, ${place}` : street;
  return zip ? `${line} ${zip}` : line;
}

function plainDescription(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\* /gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);
}

function money(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function whole(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  return String(Math.round(value));
}

function bathrooms(full: number | null | undefined, half: number | null | undefined) {
  const baths = (full || 0) + (half || 0) * 0.5;
  if (baths <= 0) return "";
  return Number.isInteger(baths) ? String(baths) : baths.toFixed(1);
}

function rentalStatus(status: string | null | undefined, offMarketAt: string | null | undefined): ListingStatus {
  if (offMarketAt) return "rented";
  const value = (status || "").toUpperCase();
  if (value.includes("RENT") || value.includes("OFF") || value.includes("NO_LONGER")) return "rented";
  if (value.includes("CONTRACT") || value.includes("PENDING")) return "pending";
  return "active";
}

function tokenSet(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase()));
}

function hasToken(tokens: Set<string>, names: string[]) {
  return names.some((name) => tokens.has(name));
}

function rentalAmenities(payload: RentalPayload): Amenities {
  const details = payload.rentalByListingId?.propertyDetails;
  const building = payload.buildingByRentalListingId;
  const tokens = tokenSet([
    ...(details?.amenities?.list || []),
    ...(details?.features?.list || []),
    ...(details?.amenities?.doormanTypes || []),
    ...(details?.amenities?.sharedOutdoorSpaceTypes || []),
    ...(details?.features?.privateOutdoorSpaceTypes || []),
    ...(building?.policies?.list || []),
    building?.type,
  ]);
  const pets = building?.policies?.petPolicy;
  const amenities = emptyAmenities();
  amenities.elevator = hasToken(tokens, ["ELEVATOR"]);
  amenities.doorman = hasToken(tokens, ["DOORMAN", "FULL_TIME", "PART_TIME"]);
  amenities.walkUp = hasToken(tokens, ["WALK_UP", "WALKUP", "WALK-UP"]);
  amenities.petFriendly =
    Boolean(pets?.catsAllowed || pets?.dogsAllowed) ||
    hasToken(tokens, ["PETS_ALLOWED", "PETS", "CATS_ALLOWED", "DOGS_ALLOWED"]);
  amenities.dishwasher = hasToken(tokens, ["DISHWASHER"]);
  amenities.washerDryer = hasToken(tokens, ["WASHER_DRYER"]);
  amenities.laundryInBuilding = hasToken(tokens, ["LAUNDRY"]);
  amenities.outdoorSpace = hasToken(tokens, [
    "SHARED_OUTDOOR_SPACE",
    "PRIVATE_OUTDOOR_SPACE",
    "PATIO",
    "ROOF_DECK",
    "TERRACE",
    "BALCONY",
    "GARDEN",
    "BACKYARD",
  ]);
  return amenities;
}

function photoUrl(key: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(key)) return null;
  return `https://${PHOTO_HOST}/fp/${key}-se_large_800_400.jpg`;
}

function mapRental(payload: RentalPayload): StreetEasyFields {
  const rental = payload.rentalByListingId;
  if (!rental) fail("Couldn't find that rental on StreetEasy.");
  const address = rental.propertyDetails?.address;
  if (!address) fail("Couldn't find an address on that listing.");
  const price = money(rental.pricing?.price);
  if (!price) fail("That listing doesn't include a monthly rent.");
  const photoUrls = (rental.media?.photos || [])
    .map((photo) => (photo?.key ? photoUrl(photo.key) : null))
    .filter((url): url is string => Boolean(url))
    .slice(0, MAX_PHOTOS);
  const bedrooms = rental.propertyDetails?.bedroomCount;
  return {
    address: listingAddress(address),
    unit: (address.unit || "").replace(/^#/, "").trim().slice(0, 40),
    price,
    neighborhood: placeName(payload.buildingByRentalListingId?.area?.name || "").slice(0, 120),
    sqft: whole(rental.propertyDetails?.livingAreaSize),
    bedrooms: typeof bedrooms === "number" && Number.isFinite(bedrooms) && bedrooms >= 0 ? String(Math.round(bedrooms)) : "",
    bathrooms: bathrooms(rental.propertyDetails?.fullBathroomCount, rental.propertyDetails?.halfBathroomCount),
    description: plainDescription(rental.description || ""),
    status: rentalStatus(rental.status, rental.offMarketAt),
    amenities: rentalAmenities(payload),
    photoUrls,
  };
}

function blockedResponse(status: number, body: string) {
  return status === 403 || status === 429 || body.includes("px-captcha") || body.includes("PerimeterX");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function findGraphqlPayload(value: unknown, depth = 0): { data?: unknown; errors?: Array<{ message?: string }> } | null {
  if (!value || depth > 5) return null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return findGraphqlPayload(JSON.parse(trimmed), depth + 1);
    } catch {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return findGraphqlPayload(JSON.parse(trimmed.slice(start, end + 1)), depth + 1);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
  const record = asRecord(value);
  if (!record) return null;
  if ("data" in record || "errors" in record) return record as { data?: unknown; errors?: Array<{ message?: string }> };
  if ("body" in record) return findGraphqlPayload(record.body, depth + 1);
  if ("content" in record) return findGraphqlPayload(record.content, depth + 1);
  return null;
}

function readGraphql<T>(status: number, body: string): T {
  if (blockedResponse(status, body)) {
    console.error("StreetEasy challenged the import.", status);
    fail("StreetEasy blocked the import. Try again in a moment.");
  }
  if (status < 200 || status >= 300) fail("Couldn't open that StreetEasy listing.");
  const payload = findGraphqlPayload(body);
  if (!payload) {
    console.error("StreetEasy unlocker body was not GraphQL.", {
      status,
      kind: body.trim().startsWith("<") ? "html" : body.trim().slice(0, 1),
      length: body.length,
    });
    fail("Couldn't read that StreetEasy listing.");
  }
  if (!payload.data) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join(" ") || "";
    fail(message || "Couldn't read that StreetEasy listing.");
  }
  return payload.data as T;
}

async function graphqlFetch<T>(query: string, variables: Record<string, string>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: BROWSER_HEADERS,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  return readGraphql<T>(response.status, await response.text());
}

// StreetEasy's bot check rejects Node's TLS fingerprint and allows Python's.
const PYTHON_GRAPHQL = `
import sys, urllib.request, urllib.error
raw = sys.stdin.buffer.read()
req = urllib.request.Request("https://api-v6.streeteasy.com/", data=raw, headers={
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://streeteasy.com",
    "Referer": "https://streeteasy.com/",
    "Apollographql-Client-Name": "srp-frontend-service",
    "Os": "web",
})
try:
    with urllib.request.urlopen(req, timeout=20) as res:
        sys.stdout.buffer.write(res.read())
except urllib.error.HTTPError as exc:
    sys.stderr.write(str(exc.code))
    sys.stdout.buffer.write(exc.read())
    sys.exit(1)
except Exception:
    sys.stderr.write("0")
    sys.exit(1)
`;

async function graphqlWithPython<T>(query: string, variables: Record<string, string>): Promise<T | null> {
  let spawn: typeof import("node:child_process").spawn;
  try {
    ({ spawn } = await import("node:child_process"));
  } catch {
    return null;
  }
  const payload = Buffer.from(JSON.stringify({ query, variables }));
  const bins = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3", "python3"];
  for (const bin of bins) {
    const downloaded = await new Promise<{ status: number; body: string } | null>((resolve) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(/*turbopackIgnore: true*/ bin, ["-c", PYTHON_GRAPHQL], { stdio: ["pipe", "pipe", "pipe"] });
      } catch {
        resolve(null);
        return;
      }
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let settled = false;
      const finish = (value: { status: number; body: string } | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(null);
      }, 20000);
      child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => err.push(chunk));
      child.on("error", () => finish(null));
      child.on("close", (code) => {
        const body = Buffer.concat(out).toString("utf8");
        const statusText = Buffer.concat(err).toString("utf8").trim();
        const status = code === 0 ? 200 : Number(statusText) || 0;
        finish(body ? { status, body } : null);
      });
      child.stdin?.end(payload);
    });
    if (!downloaded) continue;
    return readGraphql<T>(downloaded.status, downloaded.body);
  }
  return null;
}

async function graphqlInBrowser<T>(query: string, variables: Record<string, string>): Promise<T | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.BROWSER) return null;
    const { default: puppeteer } = await import("@cloudflare/puppeteer");
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(20000);
      await page.goto("https://streeteasy.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
      const result = await page.evaluate(
        async (payload: { query: string; variables: Record<string, string> }) => {
          const response = await fetch("https://api-v6.streeteasy.com/", {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          return { status: response.status, text: await response.text() };
        },
        { query, variables },
      );
      if (!result || blockedResponse(result.status, result.text) || result.status !== 200) return null;
      const payload = JSON.parse(result.text) as { data?: T };
      return payload.data ?? null;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Could not read the StreetEasy listing in a browser.", error);
    return null;
  }
}

function blockedImport(error: unknown) {
  return error instanceof StreetEasyImportError && error.message.includes("blocked");
}

function unlockerFail(kind: "credentials" | "config" | "network"): never {
  if (kind === "credentials") {
    fail("StreetEasy import credentials were rejected. Check the Bright Data or Oxylabs secret on the Worker.");
  }
  if (kind === "config") {
    fail("StreetEasy import isn't configured correctly. Check the residential proxy zone and plan.");
  }
  fail("Couldn't open that StreetEasy listing.");
}

async function graphqlWithUnlocker<T>(query: string, variables: Record<string, string>): Promise<T | null> {
  const downloaded = await fetchGraphqlViaUnlocker(
    ENDPOINT,
    JSON.stringify({ query, variables }),
    BROWSER_HEADERS,
  );
  if (!downloaded) return null;
  if (isUnlockerFailure(downloaded)) unlockerFail(downloaded.error);
  return readGraphql<T>(downloaded.status, downloaded.body);
}

async function graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
  try {
    const viaPython = await graphqlWithPython<T>(query, variables);
    if (viaPython) return viaPython;
  } catch (error) {
    if (!blockedImport(error)) throw error;
  }
  try {
    const viaUnlocker = await graphqlWithUnlocker<T>(query, variables);
    if (viaUnlocker) return viaUnlocker;
  } catch (error) {
    if (!blockedImport(error)) throw error;
  }
  try {
    return await graphqlFetch<T>(query, variables);
  } catch (error) {
    if (!blockedImport(error)) throw error;
    const viaBrowser = await graphqlInBrowser<T>(query, variables);
    if (viaBrowser) return viaBrowser;
    if (!(await unlockerConfigured())) {
      fail("StreetEasy import isn't configured on this site yet. Add a Bright Data or Oxylabs secret to the Worker.");
    }
    throw error;
  }
}

async function downloadPhoto(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "image/jpeg,image/webp,image/*;q=0.8",
        "User-Agent": BROWSER_HEADERS["User-Agent"],
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== PHOTO_HOST) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const advertised = Number(response.headers.get("content-length") || 0);
    if (advertised > MAX_PHOTO_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

async function downloadPhotos(urls: string[]) {
  const images: Uint8Array[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      const bytes = await downloadPhoto(urls[index]);
      if (bytes) images[index] = bytes;
    }
  }
  const workers = Math.min(4, urls.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return images.filter((image): image is Uint8Array => image instanceof Uint8Array);
}

function jsonLdNodes(html: string) {
  const nodes: Record<string, unknown>[] = [];
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1] || "null") as unknown;
      const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
      for (const item of list) {
        const record = asRecord(item);
        if (!record) continue;
        if (Array.isArray(record["@graph"])) {
          for (const node of record["@graph"]) {
            const inner = asRecord(node);
            if (inner) nodes.push(inner);
          }
        } else if (Array.isArray(record.itemListElement)) {
          for (const entry of record.itemListElement) {
            const inner = asRecord(asRecord(entry)?.item) || asRecord(entry);
            if (inner) nodes.push(inner);
          }
        } else {
          nodes.push(record);
        }
      }
    } catch {
      continue;
    }
  }
  return nodes;
}

function jsonLdText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.value === "string" || typeof record.value === "number") return jsonLdText(record.value);
  if (typeof record.name === "string") return record.name.trim();
  return "";
}

function jsonLdImages(value: unknown) {
  const urls: string[] = [];
  const items = Array.isArray(value) ? value : value ? [value] : [];
  for (const item of items) {
    const url = typeof item === "string" ? item : jsonLdText(asRecord(item)?.url || asRecord(item)?.contentUrl);
    const photo = url.match(/https:\/\/photos\.zillowstatic\.com\/fp\/([a-f0-9]{16,64})/i);
    if (photo) {
      const mapped = photoUrl(photo[1]);
      if (mapped) urls.push(mapped);
    }
  }
  return urls;
}

function numberFromHtml(html: string, key: string) {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function fieldsFromPage(html: string, target: ListingRef): StreetEasyFields {
  if (blockedResponse(200, html)) fail("StreetEasy blocked the import. Try again in a moment.");
  const nodes = jsonLdNodes(html);
  const listing =
    nodes.find((node) => {
      const type = jsonLdText(node["@type"]).toLowerCase();
      return type.includes("apartment") || type.includes("residence") || type.includes("product") || type.includes("offer");
    }) || nodes[0];
  const addressNode = asRecord(listing?.address);
  const street = jsonLdText(addressNode?.streetAddress) || jsonLdText(listing?.name).replace(/#.*$/, "").trim();
  const city = jsonLdText(addressNode?.addressLocality) || "New York";
  const state = jsonLdText(addressNode?.addressRegion) || "NY";
  const zip = jsonLdText(addressNode?.postalCode);
  const extras = Array.isArray(listing?.additionalProperty) ? listing.additionalProperty : [];
  const extraPrice = extras
    .map((item) => asRecord(item))
    .find((item) => jsonLdText(item?.name).toLowerCase() === "price");
  const offer = asRecord(listing?.offers);
  const priceRaw =
    jsonLdText(extraPrice?.value) ||
    jsonLdText(offer?.price) ||
    jsonLdText(listing?.price) ||
    (numberFromHtml(html, "price") ? String(numberFromHtml(html, "price")) : "");
  const price = money(Number(String(priceRaw).replace(/[^0-9.]/g, "")));
  if (!street || !price) fail("Couldn't read that StreetEasy listing.");
  const unitFromName = jsonLdText(listing?.name).split("#").pop()?.trim() || "";
  const bedrooms = numberFromHtml(html, "bedroomCount") ?? Number(jsonLdText(listing?.numberOfBedrooms) || 0);
  const fullBaths = numberFromHtml(html, "fullBathroomCount") ?? Number(jsonLdText(listing?.numberOfFullBathrooms) || 0);
  const halfBaths = numberFromHtml(html, "halfBathroomCount") ?? Number(jsonLdText(listing?.numberOfPartialBathrooms) || 0);
  const bathsFallback = Number(jsonLdText(listing?.numberOfBathroomsTotal) || 0);
  const sqft =
    whole(numberFromHtml(html, "livingAreaSize")) ||
    whole(Number(jsonLdText(asRecord(listing?.floorSize)?.value) || 0));
  const photoUrls = [
    ...jsonLdImages(listing?.image),
    ...[...html.matchAll(/https:\/\/photos\.zillowstatic\.com\/fp\/([a-f0-9]{16,64})/gi)].map((match) => photoUrl(match[1])),
  ]
    .filter((url): url is string => Boolean(url))
    .filter((url, index, list) => list.indexOf(url) === index)
    .slice(0, MAX_PHOTOS);
  const amenityTokens = [...html.matchAll(/"(ELEVATOR|DOORMAN|FULL_TIME|PART_TIME|WALK_UP|WALKUP|DISHWASHER|WASHER_DRYER|LAUNDRY|PETS_ALLOWED|PETS|CATS_ALLOWED|DOGS_ALLOWED|SHARED_OUTDOOR_SPACE|PRIVATE_OUTDOOR_SPACE|PATIO|ROOF_DECK|TERRACE|BALCONY|GARDEN|BACKYARD)"/g)].map(
    (match) => match[1],
  );
  const payload: RentalPayload = {
    rentalByListingId: {
      propertyDetails: {
        amenities: { list: amenityTokens },
        features: { list: amenityTokens },
      },
    },
    buildingByRentalListingId: {
      type: jsonLdText(extras.map((item) => asRecord(item)).find((item) => jsonLdText(item?.name).toLowerCase().includes("building"))?.value),
      policies: {
        list: amenityTokens,
        petPolicy: {
          catsAllowed: amenityTokens.includes("CATS_ALLOWED") || amenityTokens.includes("PETS_ALLOWED"),
          dogsAllowed: amenityTokens.includes("DOGS_ALLOWED") || amenityTokens.includes("PETS_ALLOWED"),
        },
      },
    },
  };
  return {
    address: listingAddress({ street, city, state, zipCode: zip }),
    unit: (target.kind === "building" ? target.unit : unitFromName).replace(/^#/, "").trim().slice(0, 40),
    price,
    neighborhood: placeName(jsonLdText(addressNode?.addressLocality) || "").slice(0, 120),
    sqft,
    bedrooms: typeof bedrooms === "number" && Number.isFinite(bedrooms) && bedrooms >= 0 ? String(Math.round(bedrooms)) : "",
    bathrooms: bathrooms(fullBaths || (bathsFallback && !halfBaths ? bathsFallback : 0), halfBaths),
    description: plainDescription(jsonLdText(listing?.description) || ""),
    status: "active",
    amenities: rentalAmenities(payload),
    photoUrls,
  };
}

async function fieldsFromUnlockerPage(rawUrl: string, target: ListingRef): Promise<StreetEasyFields | null> {
  const downloaded = await fetchPageViaUnlocker(rawUrl.trim());
  if (!downloaded) return null;
  if (isUnlockerFailure(downloaded)) unlockerFail(downloaded.error);
  return fieldsFromPage(downloaded.body, target);
}

export async function loadStreetEasyFields(rawUrl: string): Promise<StreetEasyFields> {
  const target = parseStreetEasyLink(rawUrl);
  try {
    let listingId = target.kind === "rental" ? target.id : "";
    if (target.kind === "building") {
      const building = await graphql<BuildingPayload>(BUILDING_QUERY, { slug: target.slug });
      const digests = building.buildingBySlug?.rentalInventorySummary?.availableListingDigests || [];
      if (!building.buildingBySlug) fail("Couldn't find that building on StreetEasy.");
      listingId = listingIdForUnit(target.unit, digests);
    }
    const rental = await graphql<RentalPayload>(RENTAL_QUERY, { listingID: listingId });
    return mapRental(rental);
  } catch (error) {
    const viaPage = await fieldsFromUnlockerPage(rawUrl, target).catch(() => null);
    if (viaPage) return viaPage;
    throw error;
  }
}

export async function loadStreetEasyRental(rawUrl: string): Promise<StreetEasyDraft> {
  const { photoUrls, ...draft } = await loadStreetEasyFields(rawUrl);
  return { ...draft, images: await downloadPhotos(photoUrls) };
}
