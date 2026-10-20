"use client";

/* eslint-disable @next/next/no-img-element */
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { pillButtonClass, secondaryButtonClass } from "@/lib/styles";
import type { PropertyMedia } from "@/lib/types";

export function MediaManager({ propertyId, media }: { propertyId: string; media: PropertyMedia[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const images = media.filter((item) => item.kind === "image");
  const video = media.find((item) => item.kind === "video");

  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    let stream: MediaStream | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Use Choose Photos instead.");
        setCameraOpen(false);
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const preview = videoRef.current;
        if (preview) {
          preview.srcObject = stream;
          await preview.play();
        }
      } catch {
        if (!active) return;
        setError("Could not open the camera. Allow camera access, or choose photos from this device.");
        setCameraOpen(false);
      }
    }

    void start();
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [cameraOpen]);

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setPending(true);
    setError(null);
    try {
      for (const file of files) {
        const data = new FormData();
        data.set("file", file);
        const response = await fetch(`/api/properties/${propertyId}/media`, { method: "POST", body: data });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Upload failed.");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  async function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    await uploadFiles(files);
  }

  async function capture() {
    const preview = videoRef.current;
    if (!preview || !preview.videoWidth) {
      setError("The camera isn't ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not take that photo.");
      return;
    }
    context.drawImage(preview, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Could not take that photo.");
      return;
    }
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    await uploadFiles([file]);
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
          Take photos with the camera, or choose photos from this device. The first photo is the cover until you
          choose another. One video can be added from Choose Photos.
        </p>
      </div>

      <div className="space-y-3">
        {cameraOpen ? (
          <div className="space-y-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
            />
            <button className={pillButtonClass} type="button" onClick={capture} disabled={pending}>
              <Camera className="h-4 w-4" aria-hidden />
              {pending ? "Saving…" : "Take Photos"}
            </button>
          </div>
        ) : (
          <button className={pillButtonClass} type="button" onClick={() => setCameraOpen(true)} disabled={pending}>
            <Camera className="h-4 w-4" aria-hidden />
            Take Photos
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={onChoose}
        />
        <button
          className={pillButtonClass}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
        >
          {pending ? "Uploading…" : "Choose Photos"}
        </button>
        {cameraOpen && (
          <button
            className="inline-flex w-full items-center justify-center rounded-full border border-black bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-neutral-100 disabled:opacity-50"
            type="button"
            onClick={closeCamera}
            disabled={pending}
          >
            Done
          </button>
        )}
      </div>

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
