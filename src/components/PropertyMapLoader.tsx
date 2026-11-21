"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "@/components/PropertyMap";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" />,
});

export function PropertyMapLoader({ pins, filters = true }: { pins: MapPin[]; filters?: boolean }) {
  return <PropertyMap pins={pins} filters={filters} />;
}
