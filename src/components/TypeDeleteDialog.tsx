"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/LanguageProvider";
import { fieldClass, secondaryButtonClass } from "@/lib/styles";

export function TypeDeleteDialog({
  title,
  description,
  pending = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const ready = typed === "DELETE";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, pending]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-white p-5 text-black shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !pending) onConfirm();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("dialog.typeDelete")}
          </span>
          <input
            className={fieldClass}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label={t("dialog.typeDelete")}
            disabled={pending}
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <button className={secondaryButtonClass} type="button" onClick={onCancel} disabled={pending}>
            {t("listings.cancel")}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            type="submit"
            disabled={!ready || pending}
          >
            {pending ? t("dialog.deleting") : t("dialog.delete")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
