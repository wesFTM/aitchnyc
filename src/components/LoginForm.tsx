"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { sendJson } from "@/lib/client-api";
import type { MessageKey } from "@/lib/messages";
import { buttonClass, fieldClass, labelClass } from "@/lib/styles";

const ERRORS: Record<string, MessageKey> = {
  invite: "login.errorInvite",
  google: "login.errorGoogle",
  state: "login.errorState",
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
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? t(ERRORS[errorCode] || "login.failed") : null);
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
      setError(caught instanceof Error ? caught.message : t("login.failed"));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t("login.title")}</h1>
        <p className="text-sm text-neutral-600">{t("login.body")}</p>
      </div>

      {googleEnabled ? (
        <a href={googleHref} className={`${buttonClass} w-full`}>
          {t("login.google")}
        </a>
      ) : (
        <div className="min-w-0 max-w-full break-all rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
          {locale === "ko"
            ? "Google 로그인은 클라이언트 ID와 시크릿이 필요합니다. "
            : "Google sign-in is waiting on a client ID and secret. Add "}
          <code>GOOGLE_CLIENT_ID</code>
          {locale === "ko" ? "와 " : " and "}
          <code>GOOGLE_CLIENT_SECRET</code>
          {locale === "ko" ? "을 " : " to "}
          <code>.env.local</code>
          {locale === "ko" ? "에 추가하고, 리디렉션 URI를 " : ", and set the redirect URI to "}
          <code>http://localhost:3000/api/auth/google/callback</code>
          {locale === "ko" ? "으로 설정하세요." : "."}
        </div>
      )}

      {devAuth && (
        <form onSubmit={onDev} className="space-y-3 border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-600">
            {locale === "ko" ? (
              <>
                Google을 연결하기 전까지 로컬 로그인이 켜져 있습니다. <code>SUPER_ADMIN_EMAILS</code>의 최고 관리자
                이메일, 대시보드에 추가한 관리자 이메일, 또는 이미 초대한 고객을 사용하세요.
              </>
            ) : (
              <>
                Local sign-in is on until Google is connected. Use a super admin email from{" "}
                <code>SUPER_ADMIN_EMAILS</code>, an admin email added in the dashboard, or a client you already invited.
              </>
            )}
          </p>
          <label className="block">
            <span className={labelClass}>{t("login.email")}</span>
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
            {pending ? t("login.signingIn") : t("login.continue")}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
