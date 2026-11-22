"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LIKED_PIN_COLOR, LISTING_COLORS, LISTING_TYPE_OPTIONS, listingTypeLabel } from "@/lib/format";
import type { ListingType } from "@/lib/types";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  detail: string;
  href: string;
  listingType: ListingType;
  color?: string;
  liked?: boolean;
};

export type MapFilterSet = "type" | "liked";

type MapFilter = "all" | "liked" | ListingType;

const TYPE_FILTERS: { id: MapFilter; label: string; color?: string }[] = [
  { id: "all", label: "Show All" },
  ...LISTING_TYPE_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    color: LISTING_COLORS[option.id],
  })),
];

const LIKED_FILTERS: { id: MapFilter; label: string; color?: string }[] = [
  { id: "all", label: "All" },
  { id: "liked", label: "Liked", color: LIKED_PIN_COLOR },
];

const MANHATTAN: [number, number] = [40.7831, -73.9712];

function spreadPins(pins: MapPin[]) {
  const seen = new Map<string, number>();
  return pins.map((pin) => {
    const key = `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return pin;
    const angle = count * 0.9;
    const radius = 0.00028 * count;
    return {
      ...pin,
      lat: pin.lat + Math.sin(angle) * radius,
      lng: pin.lng + Math.cos(angle) * radius,
    };
  });
}

function FitPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (pins.length === 0) {
      map.setView(MANHATTAN, 12);
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 15);
      return;
    }
    map.fitBounds(
      pins.map((pin) => [pin.lat, pin.lng] as [number, number]),
      { padding: [36, 36] },
    );
  }, [map, pins]);
  return null;
}

export default function PropertyMap({
  pins,
  filters = true,
  filterSet = "type",
}: {
  pins: MapPin[];
  filters?: boolean;
  filterSet?: MapFilterSet;
}) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const options = filterSet === "liked" ? LIKED_FILTERS : TYPE_FILTERS;
  const visible = useMemo(() => {
    if (!filters || filter === "all") return pins;
    if (filter === "liked") return pins.filter((pin) => pin.liked);
    return pins.filter((pin) => pin.listingType === filter);
  }, [filter, filters, pins]);
  const placed = useMemo(() => spreadPins(visible), [visible]);

  return (
    <div className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-white">
      {filters && (
        <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-2">
          {options.map((option) => {
            const selected = filter === option.id;
            const color = option.color;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(option.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  selected ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black"
                }`}
              >
                {color && (
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-white"
                    style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.45)" }}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <MapContainer center={MANHATTAN} zoom={12} scrollWheelZoom className="h-full w-full max-w-full text-black">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitPins pins={placed} />
          {placed.map((pin) => (
            <CircleMarker
              key={`${pin.id}:${pin.color ?? pin.listingType}`}
              center={[pin.lat, pin.lng]}
              radius={8}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: pin.color ?? LISTING_COLORS[pin.listingType],
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div className="text-sm text-black">
                  <p className="font-semibold">{pin.title}</p>
                  <p className="mt-1 text-neutral-600">
                    {listingTypeLabel(pin.listingType)} · {pin.detail}
                  </p>
                  <a href={pin.href} className="mt-2 inline-block font-semibold underline">
                    Open
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        {filter === "liked" && visible.length === 0 && (
          <p className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow">
            No liked listings yet.
          </p>
        )}
      </div>
    </div>
  );
}
