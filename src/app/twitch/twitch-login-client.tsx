"use client";

import { useCallback, useMemo, useState, useEffect, type ChangeEvent } from "react";

const ALL_SCOPES = [
  "analytics:read:extensions",
  "analytics:read:games",
  "bits:read",
  "channel:bot",
  "channel:manage:ads",
  "channel:read:ads",
  "channel:manage:broadcast",
  "channel:read:charity",
  "channel:manage:clips",
  "channel:edit:commercial",
  "channel:read:editors",
  "channel:manage:extensions",
  "channel:read:goals",
  "channel:read:guest_star",
  "channel:manage:guest_star",
  "channel:read:hype_train",
  "channel:manage:moderators",
  "channel:read:polls",
  "channel:manage:polls",
  "channel:read:predictions",
  "channel:manage:predictions",
  "channel:manage:raids",
  "channel:read:redemptions",
  "channel:manage:redemptions",
  "channel:manage:schedule",
  "channel:read:stream_key",
  "channel:read:subscriptions",
  "channel:manage:videos",
  "channel:read:vips",
  "channel:manage:vips",
  "channel:moderate",
  "clips:edit",
  "editor:manage:clips",
  "moderation:read",
  "moderator:manage:announcements",
  "moderator:manage:automod",
  "moderator:read:automod_settings",
  "moderator:manage:automod_settings",
  "moderator:read:banned_users",
  "moderator:manage:banned_users",
  "moderator:read:blocked_terms",
  "moderator:read:chat_messages",
  "moderator:manage:blocked_terms",
  "moderator:manage:chat_messages",
  "moderator:read:chat_settings",
  "moderator:manage:chat_settings",
  "moderator:read:chatters",
  "moderator:read:followers",
  "moderator:read:guest_star",
  "moderator:manage:guest_star",
  "moderator:read:moderators",
  "moderator:read:shield_mode",
  "moderator:manage:shield_mode",
  "moderator:read:shoutouts",
  "moderator:manage:shoutouts",
  "moderator:read:suspicious_users",
  "moderator:manage:suspicious_users",
  "moderator:read:unban_requests",
  "moderator:manage:unban_requests",
  "moderator:read:vips",
  "moderator:read:warnings",
  "moderator:manage:warnings",
  "user:bot",
  "user:edit",
  "user:edit:broadcast",
  "user:read:blocked_users",
  "user:manage:blocked_users",
  "user:read:broadcast",
  "user:read:chat",
  "user:manage:chat_color",
  "user:read:email",
  "user:read:emotes",
  "user:read:follows",
  "user:read:moderated_channels",
  "user:read:subscriptions",
  "user:read:whispers",
  "user:manage:whispers",
  "user:write:chat",
  "chat:edit",
  "chat:read",
  "whispers:read",
];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string[];
  token_type: string;
};

type AuthStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success" }
  | { type: "error"; message: string };

type BackendStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type TwitchLoginClientProps = {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string | undefined;
};

const SESSION_STATE_KEY = "twitch-oauth-state";

export function TwitchLoginClient({ clientId, clientSecret, redirectUri }: TwitchLoginClientProps) {
  const [backendUrl, setBackendUrl] = useState("");
  const [backendAuthToken, setBackendAuthToken] = useState("");

  const [authStatus, setAuthStatus] = useState<AuthStatus>({ type: "idle" });
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ type: "idle" });
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [authorizedScopes, setAuthorizedScopes] = useState<string[]>([]);

  const scopeParam = useMemo(() => ALL_SCOPES.join(" "), []);

  const sendTokensToBackend = useCallback(
    async (payload: { accessToken: string; refreshToken: string }) => {
      if (!backendUrl) {
        setBackendStatus({ type: "error", message: "백엔드 URL이 비어 있어 토큰을 전송하지 못했습니다." });
        return;
      }

      setBackendStatus({ type: "loading" });
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (backendAuthToken) {
          headers.Authorization = `Bearer ${backendAuthToken}`;
        }

        const response = await fetch(backendUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            provider: "TWITCH",
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          }),
        });

        const text = await response.text().catch(() => "");
        const message = text || `HTTP ${response.status}`;
        if (!response.ok) {
          setBackendStatus({ type: "error", message });
          return;
        }
        setBackendStatus({ type: "success", message });
      } catch (error) {
        const message = error instanceof Error ? error.message : "토큰 전송 중 알 수 없는 오류";
        setBackendStatus({ type: "error", message });
      }
    },
    [backendUrl, backendAuthToken]
  );

  const exchangeCodeForToken = useCallback(
    async (code: string, returnedState: string | null) => {
      const expectedState = sessionStorage.getItem(SESSION_STATE_KEY);
      if (expectedState && returnedState && expectedState !== returnedState) {
        setAuthStatus({ type: "error", message: "OAuth state 값이 일치하지 않습니다." });
        return;
      }
      if (!clientId || !clientSecret || !redirectUri) {
        setAuthStatus({ type: "error", message: "환경 변수에서 Twitch 설정을 읽지 못했습니다." });
        return;
      }

      setAuthStatus({ type: "loading" });
      try {
        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        });

        const response = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });

        const payload = (await response.json()) as TokenResponse & { message?: string; status?: number };
        if (!response.ok) {
          throw new Error(payload.message ?? `토큰 발급 실패 (status ${payload.status ?? response.status})`);
        }

        const expiresAt = Date.now() + payload.expires_in * 1000;
        setAccessToken(payload.access_token);
        setRefreshToken(payload.refresh_token ?? "");
        setTokenExpiresAt(expiresAt);
        setAuthorizedScopes(payload.scope ?? []);
        setAuthStatus({ type: "success" });

        await sendTokensToBackend({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token ?? "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "토큰 발급 중 알 수 없는 오류";
        setAuthStatus({ type: "error", message });
      }
    },
    [clientId, clientSecret, redirectUri, sendTokensToBackend]
  );

  const handleLogin = useCallback(() => {
    if (!clientId || !redirectUri) {
      setAuthStatus({ type: "error", message: "환경 변수에서 Twitch 설정을 읽지 못했습니다." });
      return;
    }

    const stateBytes = new Uint8Array(16);
    window.crypto.getRandomValues(stateBytes);
    const stateValue = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(SESSION_STATE_KEY, stateValue);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopeParam,
      state: stateValue,
    });
    window.location.href = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }, [clientId, redirectUri, scopeParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const returnedState = url.searchParams.get("state");

    if (error) {
      setAuthStatus({ type: "error", message: errorDescription ?? error });
    }

    if (code) {
      void exchangeCodeForToken(code, returnedState);
    }

    if (code || error) {
      url.searchParams.delete("code");
      url.searchParams.delete("scope");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      window.history.replaceState({}, "", url.toString());
    }
  }, [exchangeCodeForToken]);

  const expiresIn = tokenExpiresAt
    ? Math.max(0, Math.round((tokenExpiresAt - Date.now()) / 1000))
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Twitch 소셜 로그인</h1>
        <p className="text-sm text-foreground/80">
          모든 권한을 요청하여 access_token, refresh_token을 받은 뒤 백엔드로 전송합니다.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-sm">
        <div className="grid gap-4 text-sm text-foreground">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-foreground/80">Client ID</span>
            <input
              value={clientId}
              readOnly
              type="text"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-foreground/80">Client Secret</span>
            <input
              value={clientSecret}
              readOnly
              type="password"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase text-foreground/80">Redirect URI</span>
            <input
              value={redirectUri}
              readOnly
              type="url"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            />
          </label>
          <div className="text-xs text-foreground/60">요청 스코프: {ALL_SCOPES.length}개</div>
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex w-fit items-center justify-center rounded-lg bg-[#9146FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6c2ddc]"
          >
            Twitch로 로그인
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">토큰 상태</h2>
        {authStatus.type === "loading" ? (
          <p className="text-sm text-[#9146FF]">토큰을 확인 중입니다...</p>
        ) : null}
        {authStatus.type === "error" ? (
          <p className="text-sm text-red-500">{authStatus.message}</p>
        ) : null}
        {authStatus.type === "success" ? (
          <div className="space-y-2 text-sm text-foreground">
            <p className="font-semibold text-green-700">토큰 발급 완료</p>
            <p>access_token: {accessToken ? "받음" : "없음"}</p>
            <p>refresh_token: {refreshToken ? "받음" : "없음"}</p>
            <p>scope: {authorizedScopes.join(", ") || "(없음)"}</p>
            {expiresIn !== null ? (
              <p className={expiresIn <= 0 ? "text-red-600" : undefined}>
                {expiresIn <= 0 ? "토큰이 만료되었습니다." : `만료까지 약 ${expiresIn}초`}
              </p>
            ) : null}
          </div>
        ) : null}
        {authStatus.type === "idle" ? (
          <p className="text-sm text-foreground/70">Twitch 로그인을 진행하세요.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">백엔드 전송</h2>
        <div className="grid gap-3 text-sm text-foreground">
          <input
            value={backendUrl}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBackendUrl(event.target.value)}
            type="url"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            placeholder="백엔드 수신 URL"
          />
          <input
            value={backendAuthToken}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBackendAuthToken(event.target.value)}
            type="text"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            placeholder="Authorization에 넣을 액세스 토큰 (선택)"
          />
          <button
            type="button"
            onClick={() => sendTokensToBackend({ accessToken, refreshToken })}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-[#9146FF] px-4 py-2 text-sm font-semibold text-[#9146FF] transition hover:bg-[#f3ebff]"
          >
            토큰 다시 전송
          </button>
          {backendStatus.type === "loading" ? (
            <p className="text-xs text-[#9146FF]">백엔드로 전송 중...</p>
          ) : null}
          {backendStatus.type === "success" ? (
            <p className="text-xs text-green-700">전송 성공: {backendStatus.message}</p>
          ) : null}
          {backendStatus.type === "error" ? (
            <p className="text-xs text-red-500">전송 실패: {backendStatus.message}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
