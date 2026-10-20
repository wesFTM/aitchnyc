"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LISTING_COLORS, LISTING_TYPE_OPTIONS, listingTypeLabel } from "@/lib/format";
import type { ListingType } from "@/lib/types";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  detail: string;
  href: string;
  listingType: ListingType;
};

type MapFilter = "all" | ListingType;

const FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "Show All" },
  ...LISTING_TYPE_OPTIONS,
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

export default function PropertyMap({ pins }: { pins: MapPin[] }) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const visible = useMemo(
    () => (filter === "all" ? pins : pins.filter((pin) => pin.listingType === filter)),
    [filter, pins],
  );
  const placed = useMemo(() => spreadPins(visible), [visible]);

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-2">
        {FILTERS.map((option) => {
          const selected = filter === option.id;
          const color = option.id === "all" ? null : LISTING_COLORS[option.id];
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
      <div className="min-h-0 flex-1">
        <MapContainer center={MANHATTAN} zoom={12} scrollWheelZoom className="h-full w-full text-black">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitPins pins={placed} />
          {placed.map((pin) => (
            <CircleMarker
              key={pin.id}
              center={[pin.lat, pin.lng]}
              radius={8}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: LISTING_COLORS[pin.listingType],
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
      </div>
    </div>
  );
}
