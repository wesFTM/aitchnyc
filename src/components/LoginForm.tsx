"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "@/lib/client-api";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

const ERRORS: Record<string, string> = {
  invite: "That Google account hasn't been invited.",
  google: "Google sign-in didn't finish. Check the OAuth client and redirect URI.",
  state: "That sign-in expired. Try again.",
};

export function LoginForm({
  devAuth,
  googleEnabled,
  nextPath,
  errorCode,
}: {
  devAuth: boolean;
  googleEnabled: boolean;
  nextPath: string;
  errorCode?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERRORS[errorCode] || "Sign-in failed." : null);
  const [pending, setPending] = useState(false);
  const googleHref = `/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  async function onDev(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await sendJson<{ next: string }>("/api/auth/dev", "POST", { email, next: nextPath });
      router.push(result.next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="text-sm text-neutral-600">
          Super admins and invited clients sign in with Google. Everyone else is turned away.
        </p>
      </div>

      {googleEnabled ? (
        <a href={googleHref} className={`${buttonClass} w-full`}>
          Continue with Google
        </a>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
          Google sign-in is waiting on a client ID and secret. Add <code>GOOGLE_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CLIENT_SECRET</code> to <code>.env.local</code>, and set the redirect URI to{" "}
          <code>http://localhost:3000/api/auth/google/callback</code>.
        </div>
      )}

      {devAuth && (
        <form onSubmit={onDev} className="space-y-3 border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-600">
            Local sign-in is on until Google is connected. Use a super admin email from{" "}
            <code>SUPER_ADMIN_EMAILS</code>, or a client you already invited.
          </p>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="wfulghum@gmail.com"
              required
            />
          </label>
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
