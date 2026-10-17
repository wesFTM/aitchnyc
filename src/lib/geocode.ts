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

async function nominatimGeocode(address: string): Promise<Coordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

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
  try {
    return (await censusGeocode(address)) ?? (await nominatimGeocode(address));
  } catch {
    return null;
  }
}
