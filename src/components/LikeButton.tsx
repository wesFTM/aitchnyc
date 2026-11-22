"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { sendJson } from "@/lib/client-api";

export function LikeButton({
  propertyId,
  name,
  liked,
  endpoint,
  variant = "icon",
  onChange,
}: {
  propertyId: string;
  name: string;
  liked: boolean;
  endpoint: string;
  variant?: "icon" | "label";
  onChange?: (liked: boolean) => void;
}) {
  const [on, setOn] = useState(liked);
  const [pending, setPending] = useState(false);
  const label = on ? `Unlike ${name}` : `Like ${name}`;

  async function toggle() {
    if (pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    try {
      await sendJson(endpoint, "PUT", { propertyId, liked: next });
      onChange?.(next);
    } catch {
      setOn(!next);
    } finally {
      setPending(false);
    }
  }

  if (variant === "label") {
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        disabled={pending}
        onClick={toggle}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
          on ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black hover:border-black"
        }`}
      >
        <Heart className="h-4 w-4" fill={on ? "currentColor" : "none"} />
        {on ? "Liked" : "Like"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={pending}
      onClick={toggle}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-sm disabled:opacity-50 ${
        on ? "border-black bg-black text-white" : "border-white bg-white text-black hover:border-neutral-300"
      }`}
    >
      <Heart className="h-5 w-5" fill={on ? "currentColor" : "none"} />
    </button>
  );
}
