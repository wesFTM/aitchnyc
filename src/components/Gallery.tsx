"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { PropertyMedia } from "@/lib/types";

export function Gallery({ media }: { media: PropertyMedia[] }) {
  const images = media.filter((item) => item.kind === "image");
  const video = media.find((item) => item.kind === "video");
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="space-y-4">
      {current ? (
        <>
          <img
            src={`/api/media/${current.id}`}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
          {images.length > 1 && (
            <div className="flex gap-2 overflow-auto">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border ${
                    index === active ? "border-black" : "border-transparent"
                  }`}
                >
                  <img src={`/api/media/${image.id}`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-400">
          No photos yet
        </div>
      )}
      {video && <video src={`/api/media/${video.id}`} controls className="aspect-video w-full rounded-2xl bg-black" />}
    </div>
  );
}
