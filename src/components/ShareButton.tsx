"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";

export function ShareButton({ title, text }: { title: string; text?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onShare() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={copied ? t("listings.copiedLink", { name: title }) : t("listings.shareTitle", { name: title })}
      className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:border-black"
    >
      <Share2 className="h-4 w-4" aria-hidden />
      {copied ? t("listings.copied") : t("listings.share")}
    </button>
  );
}
