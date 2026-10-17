"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { buttonClass, secondaryButtonClass } from "@/lib/styles";
import type { PropertyMedia } from "@/lib/types";

export function MediaManager({ propertyId, media }: { propertyId: string; media: PropertyMedia[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const images = media.filter((item) => item.kind === "image");
  const video = media.find((item) => item.kind === "video");

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/properties/${propertyId}/media`, { method: "POST", body: data });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this file?")) return;
    setError(null);
    try {
      await sendJson(`/api/media/${id}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that file.");
    }
  }

  async function cover(id: string) {
    setError(null);
    try {
      await sendJson(`/api/media/${id}/cover`, "POST");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set the cover.");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Photos and video</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add photos and one video. The first photo is the cover until you choose another.
        </p>
      </div>
      <form onSubmit={onUpload} className="flex flex-wrap items-center gap-3">
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          required
          className="text-sm"
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-neutral-200">
              <img src={`/api/media/${image.id}`} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2">
                <span className="text-xs text-neutral-500">{index === 0 ? "Cover" : "Photo"}</span>
                <div className="flex gap-2">
                  {index !== 0 && (
                    <button className={secondaryButtonClass} type="button" onClick={() => cover(image.id)}>
                      Make cover
                    </button>
                  )}
                  <button className={secondaryButtonClass} type="button" onClick={() => remove(image.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {video && (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <video src={`/api/media/${video.id}`} controls className="aspect-video w-full bg-black" />
          <div className="flex items-center justify-between p-2">
            <span className="text-xs text-neutral-500">Video</span>
            <button className={secondaryButtonClass} type="button" onClick={() => remove(video.id)}>
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
