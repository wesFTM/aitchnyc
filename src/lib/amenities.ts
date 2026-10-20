export const AMENITY_FIELDS = [
  { key: "elevator", label: "Elevator" },
  { key: "doorman", label: "Doorman" },
  { key: "walkUp", label: "Walk-Up" },
  { key: "petFriendly", label: "Pet Friendly" },
  { key: "dishwasher", label: "Dishwasher" },
  { key: "washerDryer", label: "Washer & Dryer" },
  { key: "laundryInBuilding", label: "Laundry in Building" },
  { key: "outdoorSpace", label: "Outdoor Space" },
] as const;

export type AmenityKey = (typeof AMENITY_FIELDS)[number]["key"];
export type Amenities = Record<AmenityKey, boolean>;

export function emptyAmenities(): Amenities {
  return {
    elevator: false,
    doorman: false,
    walkUp: false,
    petFriendly: false,
    dishwasher: false,
    washerDryer: false,
    laundryInBuilding: false,
    outdoorSpace: false,
  };
}

export function parseAmenities(raw: unknown): Amenities {
  const amenities = emptyAmenities();
  let value = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return amenities;
    }
  }
  if (!value || typeof value !== "object") return amenities;
  const record = value as Record<string, unknown>;
  for (const field of AMENITY_FIELDS) {
    amenities[field.key] = record[field.key] === true || record[field.key] === 1;
  }
  return amenities;
}

export function serializeAmenities(amenities: Amenities) {
  const selected: Partial<Amenities> = {};
  for (const field of AMENITY_FIELDS) {
    if (amenities[field.key]) selected[field.key] = true;
  }
  return JSON.stringify(selected);
}

export function amenityLabels(amenities: Amenities) {
  return AMENITY_FIELDS.filter((field) => amenities[field.key]).map((field) => field.label);
}
