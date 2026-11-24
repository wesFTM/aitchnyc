"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { fieldClass, secondaryButtonClass } from "@/lib/styles";

type Kind = "listing" | "client";

export function HideRecordButton({ kind, id, hidden }: { kind: Kind; id: string; hidden: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const path = kind === "listing" ? `/api/properties/${id}/visibility` : `/api/clients/${id}/visibility`;
    try {
      await sendJson(path, "PATCH", { hidden: !hidden });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button className={secondaryButtonClass} type="button" onClick={toggle} disabled={pending}>
        {pending ? "Saving…" : hidden ? "Restore" : "Hide from master list"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RemoveFromMyListButton({ kind, id }: { kind: Kind; id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/my-list/${kind}/${id}`, "DELETE");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not take that off your list.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button className={secondaryButtonClass} type="button" onClick={remove} disabled={pending}>
        {pending ? "Removing…" : "Remove from my list"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ClientFlagControl({ id, flagged, note }: { id: string; flagged: boolean; note: string }) {
  const router = useRouter();
  const [text, setText] = useState(note);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextFlagged: boolean) {
    setPending(true);
    setError(null);
    try {
      await sendJson(`/api/clients/${id}/flag`, "PATCH", { flagged: nextFlagged, note: text });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the flag.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">Flag note</span>
        <input
          className={fieldClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Why this client is flagged"
          maxLength={280}
        />
      </label>
      <button className={secondaryButtonClass} type="button" onClick={() => save(!flagged)} disabled={pending}>
        {pending ? "Saving…" : flagged ? "Clear flag" : "Flag client"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
