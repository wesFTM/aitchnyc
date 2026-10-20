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
