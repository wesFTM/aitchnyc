const PLACE_RE =
  /\b(new york|nyc|brooklyn|queens|bronx|manhattan|staten island|jersey city|hoboken|newark)\b/i;
const STATE_RE =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/;

function hasExplicitPlace(address: string) {
  return address.includes(",") || PLACE_RE.test(address) || STATE_RE.test(address);
}

export function withDefaultCity(address: string) {
  const trimmed = address.trim().replace(/\s+/g, " ");
  if (!trimmed || hasExplicitPlace(trimmed)) return trimmed;
  return `${trimmed}, New York, NY`;
}

const STREET_NUMBER = /^\d+(?:-\d+)?[A-Za-z]?[\s,]+/;

export function splitListingAddress(address: string) {
  const trimmed = address.trim().replace(/\s+/g, " ");
  const match = /^(.*?),\s*([^,]+),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/.exec(trimmed);
  if (!match) return { street: trimmed, city: "", state: "", zip: "" };
  const street = match[1].trim();
  if (!street) return { street: trimmed, city: "", state: "", zip: "" };
  return {
    street,
    city: match[2].trim(),
    state: match[3].toUpperCase(),
    zip: match[4] ?? "",
  };
}

export function hideStreetNumber(address: string) {
  const trimmed = address.trim().replace(/\s+/g, " ");
  const match = STREET_NUMBER.exec(trimmed);
  if (!match) return trimmed;
  const rest = trimmed.slice(match[0].length).trim();
  return rest || trimmed;
}
