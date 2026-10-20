import "server-only";

export type Coordinates = { lat: number; lng: number };

async function censusGeocode(address: string): Promise<Coordinates | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] };
  };
  const coordinates = data.result?.addressMatches?.[0]?.coordinates;
  if (typeof coordinates?.x !== "number" || typeof coordinates?.y !== "number") return null;
  return { lng: coordinates.x, lat: coordinates.y };
}

function inNewYorkCity(coords: Coordinates) {
  return coords.lat >= 40.477 && coords.lat <= 40.917 && coords.lng >= -74.259 && coords.lng <= -73.7;
}

async function nominatimGeocode(address: string, expectNyc: boolean): Promise<Coordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  if (expectNyc) {
    url.searchParams.set("viewbox", "-74.259,40.917,-73.700,40.477");
    url.searchParams.set("bounded", "1");
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AitchNYC/1.0 (property listings)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { lat?: string; lon?: string }[];
  const hit = data[0];
  if (!hit?.lat || !hit.lon) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = address.trim();
  const expectNyc = /new york,\s*ny\b/i.test(query);
  try {
    const census = await censusGeocode(query);
    if (census && (!expectNyc || inNewYorkCity(census))) return census;
    const nominatim = await nominatimGeocode(query, expectNyc);
    if (nominatim && (!expectNyc || inNewYorkCity(nominatim))) return nominatim;
    return null;
  } catch {
    return null;
  }
}
