"use client";

import { useEffect, useMemo, useState } from "react";

export default function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [status, setStatus] = useState<"pending" | "sent" | "copied">("pending");
  const code = useMemo(() => {
    const value = searchParams["code"];
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }, [searchParams]);
  const scope = useMemo(() => {
    const value = searchParams["scope"];
    if (Array.isArray(value)) return value.join(" ");
    return value ?? "";
  }, [searchParams]);
  const error = useMemo(() => {
    const value = searchParams["error"];
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  }, [searchParams]);

  useEffect(() => {
    if (!code) return;
    if (typeof window === "undefined") return;
    try {
      window.opener?.postMessage({ type: "twitch-auth-code", code, scope }, window.location.origin);
      window.sessionStorage.setItem("twitch-auth-code", code);
      setStatus("sent");
    } catch (err) {
      console.error("postMessage 실패", err);
    }
  }, [code, scope]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold text-red-600">OAuth 오류 발생</h1>
        <p className="text-sm text-foreground/80">
          Twitch 인증 과정에서 `{error}` 오류가 발생했습니다. 다시 시도하거나, 관련 권한을 확인해 주세요.
        </p>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg bg-[#9146FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6c2ddc]"
        >
          창 닫기
        </button>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">Authorization Code 없음</h1>
        <p className="text-sm text-foreground/80">
          이 페이지는 Twitch 인증 후 자동으로 열립니다. 브라우저 주소창에 `code` 쿼리 파라미터가 포함되지 않았습니다.
        </p>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-foreground transition hover:border-[#9146FF]/40"
        >
          창 닫기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-6 px-6 text-center text-foreground">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Authorization Code 수신 완료</h1>
        <p className="text-sm text-foreground/80">
          이 창은 자동으로 닫아도 됩니다. 기본 창에 코드가 전달되어 있다면 잠시 후 토큰 교환이 시도됩니다.
          자동으로 넘어가지 않는다면 아래 버튼으로 직접 복사해 붙여 넣을 수 있습니다.
        </p>
      </div>

      <div className="w-full space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase text-foreground/70">Authorization Code</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code).then(() => setStatus("copied"));
            }}
            className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-foreground transition hover:border-[#9146FF]/40"
          >
            코드 복사
          </button>
        </div>
        <code className="block w-full truncate rounded-lg bg-black/5 px-3 py-2 font-mono text-xs text-foreground">
          {code}
        </code>
        {scope ? (
          <p className="text-xs text-foreground/70">scope: {scope}</p>
        ) : null}
      </div>

      <p className="text-xs text-foreground/60">
        상태: {status === "pending" ? "코드 전달 중..." : status === "sent" ? "기본 창으로 전달됨" : "클립보드에 복사됨"}
      </p>

      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-foreground transition hover:border-[#9146FF]/40"
      >
        창 닫기
      </button>
    </div>
  );
}

