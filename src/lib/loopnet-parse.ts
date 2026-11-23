import type { ListingStatus } from "@/lib/types";

const MAX_PHOTOS = 12;

const NEIGHBORHOODS = [
  "Battery Park City",
  "Bowery",
  "Brooklyn Heights",
  "Carnegie Hill",
  "Carroll Gardens",
  "Chelsea",
  "Chinatown",
  "Civic Center",
  "Clinton Hill",
  "Cobble Hill",
  "Downtown Brooklyn",
  "DUMBO",
  "East Harlem",
  "East Village",
  "Financial District",
  "Flatiron",
  "Forest Hills",
  "Fort Greene",
  "Gramercy",
  "Greenpoint",
  "Greenwich Village",
  "Harlem",
  "Hell's Kitchen",
  "Hudson Square",
  "Hudson Yards",
  "Inwood",
  "Kips Bay",
  "Lenox Hill",
  "Little Italy",
  "Long Island City",
  "Lower East Side",
  "Meatpacking District",
  "Midtown East",
  "Midtown West",
  "Midtown",
  "Murray Hill",
  "NoHo",
  "Nolita",
  "Park Slope",
  "SoHo",
  "Times Square",
  "Tribeca",
  "Turtle Bay",
  "Two Bridges",
  "Union Square",
  "Upper East Side",
  "Upper West Side",
  "Washington Heights",
  "West Village",
  "Williamsburg",
  "Yorkville",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
].sort((left, right) => right.length - left.length);

const GENERIC_PLACES = new Set([
  "united states",
  "usa",
  "us",
  "new york",
  "new york city",
  "nyc",
  "ny",
  "manhattan",
  "the bronx",
]);

const IMAGE_HOST =
  /^(?:images\d*|images)\.loopnet\.(?:com|co\.uk)$/i;

export class LoopNetImportError extends Error {}

export type LoopNetFields = {
  address: string;
  unit: string;
  price: string;
  listingType: "sale" | "commercial";
  neighborhood: string;
  sqft: string;
  sqftOptional: string;
  description: string;
  status: ListingStatus;
  keyMoney: string;
  possession: string;
  terms: string;
  frontage: string;
  ceilingHeight: string;
  neighboringTenants: string;
  photoUrls: string[];
};

export function failLoopNet(message: string): never {
  throw new LoopNetImportError(message);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const number = Number(code);
      return number > 0 && number < 0x110000 ? String.fromCodePoint(number) : "";
    });
}

function plain(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function clip(value: string, max: number) {
  const text = plain(value);
  return text.length > max ? text.slice(0, max).trim() : text;
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return plain(match?.[1] || "");
}

function typesOf(value: unknown) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function jsonLdNodes(html: string) {
  const nodes: Record<string, unknown>[] = [];
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const raw = decodeEntities(match[1] || "").trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const record = asRecord(item);
      if (!record) continue;
      nodes.push(record);
      const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [];
      for (const node of graph) {
        const inner = asRecord(node);
        if (inner) nodes.push(inner);
      }
    }
  }
  return nodes;
}

function listingNode(nodes: Record<string, unknown>[]) {
  return (
    nodes.find((node) => typesOf(node["@type"]).some((type) => type.toLowerCase() === "realestatelisting")) || null
  );
}

function textValue(value: unknown): string {
  if (typeof value === "string") return plain(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map((item) => textValue(item)).filter(Boolean).join(", ");
  const record = asRecord(value);
  if (!record) return "";
  if ("value" in record) return textValue(record.value);
  if (typeof record.name === "string") return plain(record.name);
  return "";
}

function detailMap(listing: Record<string, unknown>) {
  const details = new Map<string, string>();
  const props = Array.isArray(listing.additionalProperty) ? listing.additionalProperty : [];
  for (const prop of props) {
    const record = asRecord(prop);
    if (!record) continue;
    const name = textValue(record.name).toLowerCase();
    const value = textValue(record.value);
    if (name && value) details.set(name, value);
  }
  return details;
}

function detail(details: Map<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = details.get(name.toLowerCase());
    if (value) return value;
  }
  return "";
}

function detailLike(details: Map<string, string>, pattern: RegExp) {
  for (const [name, value] of details) {
    if (pattern.test(name)) return value;
  }
  return "";
}

function isRate(value: string) {
  return /(?:\/\s*sf|per\s+(?:sf|sq(?:uare)?\.?\s*ft)|psf|\bsf\s*\/|\bper\s+(?:square\s+foot|annum)\b)/i.test(value);
}

function moneyAmount(value: string) {
  const text = value.trim();
  if (!text || isRate(text)) return "";
  if (/upon request|call for|contact|negotiable/i.test(text) && !/\$\s*[\d,]/.test(text)) return "";
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return "";
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function offerPrice(listing: Record<string, unknown>) {
  const offers = listing.offers;
  const offer = Array.isArray(offers) ? asRecord(offers[0]) : asRecord(offers);
  return textValue(offer?.price);
}

function headingKind(html: string): "sale" | "lease" | "" {
  const title = pageTitle(html).toLowerCase();
  const badge = (html.match(/data-automation-listing-type=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
  const marked = `${title}\n${badge}`;
  if (/\bfor lease\b|\bsublease\b/.test(marked) || badge.includes("lease")) return "lease";
  if (/\bfor sale\b|\bauction\b/.test(marked) || badge.includes("sale") || badge.includes("auction")) return "sale";
  if (/>\s*for lease\s*</i.test(html)) return "lease";
  if (/>\s*for sale\s*</i.test(html)) return "sale";
  return "";
}

function listingKind(html: string, details: Map<string, string>, priceText: string): "sale" | "lease" {
  const heading = headingKind(html);
  const keys = [...details.keys()].join(" | ");
  const leaseKey = /lease|rental rate|space available|available space|min divisible|max contiguous/.test(keys);
  const saleKey = /sale type|cap rate|price per /.test(keys);
  const rate =
    isRate(priceText) ||
    isRate(detail(details, "lease rate", "rental rate", "rent")) ||
    /\/\s*mo\b|per month|monthly rent/i.test(priceText);
  if (heading === "lease" || ((leaseKey || rate) && heading !== "sale" && !saleKey)) return "lease";
  if (heading === "sale" || saleKey) return "sale";
  if (leaseKey || rate) return "lease";
  if (moneyAmount(priceText)) return "sale";
  return "lease";
}

function squareNumbers(value: string) {
  const numbers: number[] = [];
  const acres = value.matchAll(/([\d,.]+)\s*ac\b/gi);
  let sawAcres = false;
  for (const match of acres) {
    sawAcres = true;
    const amount = Number(match[1].replace(/,/g, ""));
    if (amount > 0 && amount < 100000) numbers.push(Math.round(amount * 43560));
  }
  if (sawAcres) return numbers;
  const labeled = value.matchAll(/([\d,.]+)\s*(?:sf|sq\.?\s*ft\.?|square feet)\b/gi);
  for (const match of labeled) {
    const amount = Number(match[1].replace(/,/g, ""));
    if (amount > 0 && amount < 100000000) numbers.push(Math.round(amount));
  }
  if (numbers.length) return numbers;
  if (/^[\d,.\s\-–]+$/.test(value.trim())) {
    for (const part of value.split(/[-–]/)) {
      const amount = Number(part.replace(/[,\s]/g, ""));
      if (amount > 0 && amount < 100000000) numbers.push(Math.round(amount));
    }
  }
  return numbers;
}

function firstSize(details: Map<string, string>, pattern: RegExp) {
  for (const [name, value] of details) {
    if (!pattern.test(name)) continue;
    const numbers = squareNumbers(value);
    if (numbers.length) return numbers;
  }
  return [];
}

function sizesFor(details: Map<string, string>, kind: "sale" | "lease") {
  const ground = firstSize(details, /ground|street level|first floor|retail (?:sf|size|area)/);
  const total = firstSize(details, /building size|gross|rentable building|total (?:building|available|size|sq)/);
  const space = firstSize(details, /available space|space available|square footage|floor size|rentable area|^size$/);
  if (kind === "sale") {
    const sqft = total[0] || space[0] || ground[0] || 0;
    return { sqft: sqft ? String(sqft) : "", sqftOptional: "" };
  }
  const primary = ground[0] || space[0] || total[0] || 0;
  const building = total[0] && total[0] !== primary ? total[0] : 0;
  const range = space.length > 1 ? Math.max(...space) : 0;
  const optional = building || (range > primary ? range : 0);
  return {
    sqft: primary ? String(primary) : "",
    sqftOptional: optional ? String(optional) : "",
  };
}

function neighborhoodFrom(crumbs: string[], city: string, blob: string) {
  const haystack = [...crumbs, city, blob].join("\n");
  for (const name of NEIGHBORHOODS) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^A-Za-z])${escaped}(?:[^A-Za-z]|$)`, "i").test(haystack)) return name;
  }
  const specific = [...crumbs].reverse().find((crumb) => {
    const key = crumb.toLowerCase();
    return crumb.length > 1 && crumb.length <= 40 && !GENERIC_PLACES.has(key) && key !== "home" && !/^\d/.test(crumb);
  });
  if (specific) return specific;
  const cityName = city.trim();
  if (cityName && !GENERIC_PLACES.has(cityName.toLowerCase())) return cityName;
  return "";
}

function breadcrumbs(nodes: Record<string, unknown>[]) {
  const list = nodes.find((node) => typesOf(node["@type"]).some((type) => type.toLowerCase() === "breadcrumblist"));
  const items = Array.isArray(list?.itemListElement) ? list.itemListElement : [];
  const names: string[] = [];
  for (const item of items) {
    const record = asRecord(item);
    const name = textValue(record?.name || asRecord(record?.item)?.name);
    if (name) names.push(name);
  }
  return names;
}

function stateCode(value: string) {
  const text = value.trim();
  if (/^new york$/i.test(text)) return "NY";
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  return text.slice(0, 20);
}

function addressLine(street: string, city: string, state: string, zip: string) {
  const place = [city, state].filter(Boolean).join(", ");
  const line = place ? `${street}, ${place}` : street;
  return zip ? `${line} ${zip}` : line;
}

function unitFrom(street: string, name: string, details: Map<string, string>) {
  const explicit = detail(details, "suite", "unit", "unit number");
  const source = explicit || `${street} ${name}`;
  const match = source.match(/\b(?:suite|unit|ste|#)\s*#?\s*([A-Za-z0-9-]{1,12})\b/i);
  return (match?.[1] || "").replace(/^#/, "").slice(0, 40);
}

function streetLine(street: string) {
  return street.replace(/\s*(?:,|#).*$/, "").replace(/\b(?:suite|unit|ste)\b.*$/i, "").trim();
}

function statusFrom(title: string, details: Map<string, string>): ListingStatus {
  const blob = `${title}\n${detail(details, "listing status", "status")}`.toLowerCase();
  if (/\b(off[- ]market|leased|sold|no longer)\b/.test(blob)) return "leased";
  if (/\b(pending|under contract|in contract)\b/.test(blob)) return "pending";
  return "active";
}

function shiftBack(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += String.fromCharCode((((code - 32 - 3) % 95) + 95) % 95 + 32);
    } else {
      out += char;
    }
  }
  return out;
}

function galleryFromState(html: string) {
  const match = html.match(/window\.gState\s*=\s*"((?:\\.|[^"\\])*)"/);
  if (!match?.[1]) return [];
  let encoded = "";
  try {
    encoded = JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(shiftBack(encoded));
  } catch {
    return [];
  }
  const attachments = asRecord(asRecord(parsed)?.as)?.mainAttachments;
  if (!Array.isArray(attachments)) return [];
  const urls: string[] = [];
  for (const item of attachments) {
    const record = asRecord(item);
    const uri = textValue(record?.uri || record?.url);
    if (uri) urls.push(uri);
  }
  return urls;
}

function imageUrl(raw: string) {
  let value = raw.trim();
  if (value.startsWith("//")) value = `https:${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !IMAGE_HOST.test(url.hostname) || !url.pathname.includes("/i2/")) return null;
  url.hash = "";
  url.search = "";
  return url.toString();
}

function imageKey(url: string) {
  const match = url.match(/\/i2\/([^/]+)\//);
  return match?.[1] || url;
}

function imageRank(url: string) {
  const match = url.match(/\/i2\/[^/]+\/(\d+)\//);
  return match ? Number(match[1]) : 0;
}

function photoUrls(html: string, listing: Record<string, unknown> | null) {
  const found: string[] = [];
  const push = (raw: string) => {
    const url = imageUrl(raw);
    if (url) found.push(url);
  };
  for (const url of galleryFromState(html)) push(url);
  const images = listing?.image;
  const list = Array.isArray(images) ? images : images ? [images] : [];
  for (const item of list) {
    if (typeof item === "string") push(item);
    else push(textValue(asRecord(item)?.url || asRecord(item)?.contentUrl));
  }
  const embedded = html.matchAll(
    /https?:\/\/(?:images\d*|images)\.loopnet\.(?:com|co\.uk)\/i2\/[A-Za-z0-9_-]+\/\d+\/[^"'\s<>\\]+/gi,
  );
  for (const match of embedded) push(match[0].replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
  const best = new Map<string, string>();
  for (const url of found) {
    const key = imageKey(url);
    const current = best.get(key);
    if (!current || imageRank(url) > imageRank(current)) best.set(key, url);
  }
  const ordered: string[] = [];
  for (const url of found) {
    const key = imageKey(url);
    if (best.get(key) === url && !ordered.includes(url)) ordered.push(url);
  }
  return ordered.slice(0, MAX_PHOTOS);
}

function notesFor(details: Map<string, string>, used: Set<string>) {
  const lines: string[] = [];
  for (const [name, value] of details) {
    if (used.has(name)) continue;
    if (name === "price" || name === "lease rate" || name === "rental rate" || name === "walk score") continue;
    const label = name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    lines.push(`${label}: ${value}`);
  }
  return lines;
}

export function parseLoopNetLink(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    failLoopNet("Enter a full LoopNet link, starting with https://.");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "loopnet.com" && host !== "www.loopnet.com") || (url.port && url.port !== "443")) {
    failLoopNet("Paste an https://www.loopnet.com/Listing/ link.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0].toLowerCase() !== "listing" || !/^\d{5,12}$/.test(parts[2])) {
    failLoopNet("Paste a LoopNet listing link, like loopnet.com/Listing/225-Avenue-B-New-York-NY/43252659/.");
  }
  url.hash = "";
  url.search = "";
  return { href: url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`, id: parts[2] };
}

export function parseLoopNetPage(html: string): LoopNetFields {
  if (/access denied/i.test(pageTitle(html)) || html.includes("errors.edgesuite.net")) {
    failLoopNet("LoopNet blocked the import. Try again in a moment.");
  }
  if (/\/listingnotfound\//i.test(html) || /this listing cannot be found/i.test(html)) {
    failLoopNet("That LoopNet listing is no longer available.");
  }
  const nodes = jsonLdNodes(html);
  const listing = listingNode(nodes);
  if (!listing) failLoopNet("Couldn't read that LoopNet listing.");
  const details = detailMap(listing);
  const addressNode = asRecord(asRecord(listing.contentLocation)?.address) || asRecord(listing.address);
  const streetRaw = textValue(addressNode?.streetAddress) || textValue(listing.name).split(" - ")[0].split("|")[0];
  const street = streetLine(streetRaw);
  if (!street || !/^\d/.test(street)) failLoopNet("Couldn't find an address on that listing.");
  const city = textValue(addressNode?.addressLocality) || "New York";
  const state = stateCode(textValue(addressNode?.addressRegion) || "NY");
  const zip = textValue(addressNode?.postalCode);
  const priceText = detail(details, "price") || offerPrice(listing);
  const kind = listingKind(html, details, priceText);
  const rate =
    [priceText, detail(details, "lease rate", "rental rate", "rent")].find((value) => value && isRate(value)) || "";
  const price = kind === "lease" && isRate(priceText) ? "" : moneyAmount(priceText);
  const listingType = kind === "sale" && price ? "sale" : "commercial";
  const sizes = sizesFor(details, listingType === "sale" ? "sale" : "lease");
  const term = detailLike(details, /^(?:lease )?terms?$|lease term/);
  const propertyType = [detail(details, "property type"), detail(details, "property subtype")].filter(Boolean).join(" · ");
  const description = plain(textValue(listing.description));
  const possession = clip(detailLike(details, /possession|date available|available date|^availability$/), 200);
  const terms = clip([term, rate && rate !== term ? rate : ""].filter(Boolean).join(" · "), 200);
  const frontage = clip(detailLike(details, /frontage/), 80);
  const ceilingHeight = clip(detailLike(details, /ceiling|clear height/), 80);
  const neighboringTenants = clip(detailLike(details, /neighbor/), 8000);
  const used = new Set(
    [...details.keys()].filter((name) =>
      /^price$|property type|property subtype|size|sq|floor|space|building|ground|frontage|ceiling|clear height|possession|available|^terms?$|lease term|key money|^suite$|^unit|neighbor/.test(
        name,
      ),
    ),
  );
  const extra = notesFor(details, used);
  const saleFacts =
    listingType === "sale"
      ? [
          frontage ? `Frontage: ${frontage}` : "",
          ceilingHeight ? `Ceiling height: ${ceilingHeight}` : "",
          possession ? `Possession: ${possession}` : "",
          terms ? `Terms: ${terms}` : "",
        ].filter(Boolean)
      : [];
  const descriptionParts = [propertyType, description, extra.length ? extra.join("\n") : "", saleFacts.join("\n")]
    .filter(Boolean);
  const crumbs = breadcrumbs(nodes);
  return {
    address: addressLine(street, city, state, zip).slice(0, 300),
    unit: unitFrom(streetRaw, textValue(listing.name), details),
    price,
    listingType,
    neighborhood: neighborhoodFrom(crumbs, city, `${textValue(listing.name)}\n${description}`).slice(0, 120),
    sqft: sizes.sqft,
    sqftOptional: listingType === "commercial" ? sizes.sqftOptional : "",
    description: descriptionParts.join("\n\n").slice(0, 8000),
    status: statusFrom(pageTitle(html), details),
    keyMoney: moneyAmount(detailLike(details, /key money/)),
    possession: listingType === "commercial" ? possession : "",
    terms: listingType === "commercial" ? terms : "",
    frontage: listingType === "commercial" ? frontage : "",
    ceilingHeight: listingType === "commercial" ? ceilingHeight : "",
    neighboringTenants: listingType === "commercial" ? neighboringTenants : "",
    photoUrls: photoUrls(html, listing),
  };
}
