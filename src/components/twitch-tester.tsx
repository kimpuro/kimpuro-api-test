"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const SCOPES = [
  "channel:manage:broadcast",
  "channel:manage:polls",
  "user:read:email",
  "user:read:follows",
  "user:read:subscriptions",
  "moderation:read",
  "chat:read",
  "chat:edit",
  "analytics:read:games",
  "analytics:read:extensions",
];

type EnvSummary = Array<{ key: string; configured: boolean }>;

type AccessTokenInfo = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string[];
  token_type: string;
};

type ApiResponse = {
  endpoint: string;
  status: number;
  ok: boolean;
  durationMs: number;
  request: {
    method: string;
    url: string;
    body?: unknown;
  };
  response: {
    headers: Record<string, string>;
    body: unknown;
  };
};

type TwitchTesterProps = {
  envSummary: EnvSummary;
};

const storageKey = "twitch-api-tester-state";

type PersistedState = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  customScopes: string;
  lastEndpoint: string;
  lastMethod: string;
  lastBody: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number | null;
};

const defaultState: PersistedState = {
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  scopes: [SCOPES[0], SCOPES[2], SCOPES[5]],
  customScopes: "",
  lastEndpoint: "https://api.twitch.tv/helix/users",
  lastMethod: "GET",
  lastBody: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiresAt: null,
};

function loadPersistedState(): PersistedState {
  if (typeof window === "undefined") {
    return defaultState;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed } satisfies PersistedState;
  } catch (error) {
    console.warn("저장된 상태를 읽지 못했습니다.", error);
    return defaultState;
  }
}

function persistState(next: PersistedState) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch (error) {
    console.warn("상태 저장 실패", error);
  }
}

function buildOAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  forceVerify: boolean
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    force_verify: String(forceVerify),
  });

  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export function TwitchTester({ envSummary }: TwitchTesterProps) {
  const [state, setState] = useState<PersistedState>(() => loadPersistedState());
  const [forceVerify, setForceVerify] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "success"; token: AccessTokenInfo }
    | { type: "error"; error: string }
  >({ type: "idle" });
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const scopes = useMemo(() => {
    const merged = new Set(state.scopes);
    state.customScopes
      .split(/[ ,\n\r]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((scope) => merged.add(scope));
    return Array.from(merged);
  }, [state.scopes, state.customScopes]);

  useEffect(() => {
    persistState(state);
  }, [state]);

  const updateState = useCallback(<K extends keyof PersistedState>(key: K, value: PersistedState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTokenExchange = useCallback(
    async ({ code }: { code: string }) => {
      if (!state.clientId || !state.clientSecret || !state.redirectUri) {
        setAuthStatus({ type: "error", error: "먼저 Client ID, Secret, Redirect URI를 모두 입력하세요." });
        return;
      }

      setAuthStatus({ type: "loading" });
      try {
        const params = new URLSearchParams({
          client_id: state.clientId,
          client_secret: state.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: state.redirectUri,
        });

        const response = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        });
        const payload = (await response.json()) as AccessTokenInfo & { message?: string; status?: number };
        if (!response.ok) {
          throw new Error(payload.message ?? `토큰 발급 실패 (status ${payload.status ?? response.status})`);
        }

        const expiresAt = Date.now() + payload.expires_in * 1000;

        setAuthStatus({ type: "success", token: payload });
        updateState("accessToken", payload.access_token);
        updateState("refreshToken", payload.refresh_token ?? "");
        updateState("tokenExpiresAt", expiresAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : "토큰 발급 중 알 수 없는 오류";
        setAuthStatus({ type: "error", error: message });
      }
    },
    [state.clientId, state.clientSecret, state.redirectUri, updateState]
  );

  const handleRefreshToken = useCallback(async () => {
    if (!state.refreshToken) {
      setAuthStatus({ type: "error", error: "저장된 refresh_token 이 없습니다." });
      return;
    }

    setAuthStatus({ type: "loading" });
    try {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: state.refreshToken,
        client_id: state.clientId,
        client_secret: state.clientSecret,
      });

      const response = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const payload = (await response.json()) as AccessTokenInfo & { message?: string; status?: number };
      if (!response.ok) {
        throw new Error(payload.message ?? `토큰 갱신 실패 (status ${payload.status ?? response.status})`);
      }

      const expiresAt = Date.now() + payload.expires_in * 1000;

      setAuthStatus({ type: "success", token: payload });
      updateState("accessToken", payload.access_token);
      updateState("refreshToken", payload.refresh_token ?? state.refreshToken);
      updateState("tokenExpiresAt", expiresAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "토큰 갱신 중 알 수 없는 오류";
      setAuthStatus({ type: "error", error: message });
    }
  }, [state.clientId, state.clientSecret, state.refreshToken, updateState]);

  const handleApiCall = useCallback(async () => {
    if (!state.accessToken) {
      setApiError("액세스 토큰이 필요합니다. 먼저 인증을 완료하세요.");
      return;
    }

    setApiError(null);
    setApiResponse(null);

    const start = performance.now();
    try {
      let parsedBody: unknown;
      if (state.lastBody) {
        try {
          parsedBody = JSON.parse(state.lastBody);
        } catch (error) {
          setApiError("요청 본문이 올바른 JSON 형식이 아닙니다.");
          return;
        }
      }

      const headers: Record<string, string> = {
        "Client-Id": state.clientId,
        Authorization: `Bearer ${state.accessToken}`,
      };
      if (state.lastBody) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(state.lastEndpoint, {
        method: state.lastMethod,
        headers,
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
      });

      const durationMs = Math.round(performance.now() - start);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      const body = await response.json().catch(() => "(JSON 파싱 실패)" as const);

      setApiResponse({
        endpoint: state.lastEndpoint,
        status: response.status,
        ok: response.ok,
        durationMs,
        request: {
          method: state.lastMethod,
          url: state.lastEndpoint,
          body: parsedBody,
        },
        response: { headers: responseHeaders, body },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청 실패";
      setApiError(message);
    }
  }, [state.accessToken, state.clientId, state.lastBody, state.lastEndpoint, state.lastMethod]);

  const handleLogout = useCallback(() => {
    setAuthStatus({ type: "idle" });
    setApiResponse(null);
    setApiError(null);
    setState((prev) => ({
      ...prev,
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: null,
    }));
  }, []);

  const oauthUrl = useMemo(() => {
    if (!state.clientId || !state.redirectUri) return "";
    return buildOAuthUrl(state.clientId, state.redirectUri, scopes, forceVerify);
  }, [state.clientId, state.redirectUri, scopes, forceVerify]);

  const canExchangeToken = Boolean(state.clientId && state.clientSecret && state.redirectUri);

  useEffect(() => {
    if (typeof window === "undefined" || !canExchangeToken) return;
    const storedCode = window.sessionStorage.getItem("twitch-auth-code");
    if (!storedCode) return;
    window.sessionStorage.removeItem("twitch-auth-code");
    void handleTokenExchange({ code: storedCode });
  }, [canExchangeToken, handleTokenExchange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (typeof event.data !== "object" || event.data === null) return;
      if (event.data.type === "twitch-auth-code" && typeof event.data.code === "string") {
        if (!canExchangeToken) {
          window.sessionStorage.setItem("twitch-auth-code", event.data.code);
          setAuthStatus({ type: "error", error: "클라이언트 설정을 완료한 뒤 다시 시도하세요." });
          return;
        }
        void handleTokenExchange({ code: event.data.code });
        window.focus();
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [canExchangeToken, handleTokenExchange]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-sm">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Twitch API 테스트 도구</h1>
            <p className="text-sm text-foreground/90">
              OAuth 토큰 발급과 Helix/익스텐션 엔드포인트 요청을 한 곳에서 시도할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground">
            {envSummary.map((env) => (
              <div key={env.key} className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1">
                <span className={`h-2 w-2 rounded-full ${env.configured ? "bg-green-500" : "bg-amber-500"}`} />
                <span>{env.key}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-medium">앱 자격 증명</h2>
            <div className="grid gap-4 text-foreground">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-foreground/90">Client ID</span>
                <input
                  value={state.clientId}
                  onChange={(event) => updateState("clientId", event.target.value.trim())}
                  type="text"
                  placeholder="Twitch Developer Console에서 발급받은 Client ID"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-foreground/90">Client Secret</span>
                <input
                  value={state.clientSecret}
                  onChange={(event) => updateState("clientSecret", event.target.value.trim())}
                  type="password"
                  placeholder="Client Secret"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-foreground/90">Redirect URI</span>
                <input
                  value={state.redirectUri}
                  onChange={(event) => updateState("redirectUri", event.target.value.trim())}
                  type="url"
                  placeholder="https://api-test.kimpuro.com/auth/callback"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                />
              </label>
            </div>

            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
              <header className="mb-3 flex items-center justify-between text-foreground">
                <span className="font-medium">OAuth 스코프 선택</span>
                <label className="flex items-center gap-2 text-xs text-foreground/90">
                  <input
                    type="checkbox"
                    checked={forceVerify}
                    onChange={(event) => setForceVerify(event.target.checked)}
                  />
                  force_verify
                </label>
              </header>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((scope) => {
                  const isSelected = state.scopes.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => {
                        updateState(
                          "scopes",
                          isSelected
                            ? state.scopes.filter((item) => item !== scope)
                            : [...state.scopes, scope]
                        );
                      }}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        isSelected
                          ? "border-[#9146FF] bg-[#9146FF] text-white"
                          : "border-[var(--color-border)] bg-[var(--color-panel)] text-foreground hover:border-[#9146FF]/40"
                      }`}
                    >
                      {scope}
                    </button>
                  );
                })}
              </div>
              <label className="mt-4 block space-y-2 text-foreground">
                <span className="text-xs font-semibold uppercase text-foreground/90">커스텀 스코프</span>
                <textarea
                  value={state.customScopes}
                  onChange={(event) => updateState("customScopes", event.target.value)}
                  placeholder="쉼표 또는 줄바꿈으로 구분하여 입력"
                  className="h-24 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground">
                <span>총 {scopes.length}개 스코프</span>
                {oauthUrl ? (
                  <a
                    href={oauthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#9146FF] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6c2ddc]"
                  >
                    OAuth 승인 페이지 열기
                  </a>
                ) : (
                  <span className="text-xs text-foreground/50">Client ID와 Redirect URI가 필요합니다.</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">인증 응답 관리</h2>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
              <details className="group" open>
                <summary className="cursor-pointer list-none font-medium text-foreground">
                  1. Authorization Code 입력
                </summary>
                <div className="mt-3 space-y-3 text-sm text-foreground">
                  <p>
                    Redirect URI로 전달된 `code` 쿼리 파라미터를 아래에 붙여 넣으면,
                    access_token을 교환합니다.
                  </p>
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const code = String(formData.get("code") ?? "").trim();
                      if (!code) {
                        setAuthStatus({ type: "error", error: "code 값을 입력하세요." });
                        return;
                      }
                      await handleTokenExchange({ code });
                      event.currentTarget.reset();
                    }}
                  >
                    <input
                      name="code"
                      type="text"
                      placeholder="Authorization Code"
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#9146FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6c2ddc]"
                    >
                      토큰 받기
                    </button>
                  </form>
                </div>
              </details>

              <details className="group" open>
                <summary className="cursor-pointer list-none font-medium text-foreground">
                  2. 결과 상태
                </summary>
                <div className="mt-3 space-y-3 text-sm text-foreground">
                  <AuthStatus status={authStatus} tokenExpiresAt={state.tokenExpiresAt} />
                  {state.accessToken ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                      <CopyButton label="Access Token" value={state.accessToken} />
                      {state.refreshToken ? (
                        <CopyButton label="Refresh Token" value={state.refreshToken} />
                      ) : null}
                      <button
                        type="button"
                        onClick={handleRefreshToken}
                        className="rounded-full border border-[#9146FF] px-3 py-1 text-xs font-semibold text-[#9146FF] transition hover:bg-[#f3ebff]"
                      >
                        토큰 갱신
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs text-foreground/70 transition hover:border-red-400 hover:text-red-500"
                      >
                        토큰 비우기
                      </button>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-medium">API 요청 테스트</h3>
              <div className="space-y-3 text-foreground">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={state.lastMethod}
                    onChange={(event) => updateState("lastMethod", event.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none sm:w-28"
                  >
                    {"GET POST PATCH PUT DELETE".split(" ").map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                  <input
                    value={state.lastEndpoint}
                    onChange={(event) => updateState("lastEndpoint", event.target.value)}
                    type="url"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground focus:border-[#9146FF] focus:outline-none"
                    placeholder="https://api.twitch.tv/helix/users"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(state.lastEndpoint)
                        .catch(() => alert("URL 복사 실패"));
                    }}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs text-foreground/70 transition hover:border-[#9146FF]/40"
                  >
                    URL 복사
                  </button>
                </div>
                <textarea
                  value={state.lastBody}
                  onChange={(event) => updateState("lastBody", event.target.value)}
                  className="h-32 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 font-mono text-xs text-foreground focus:border-[#9146FF] focus:outline-none"
                  placeholder="JSON 요청 본문 (선택)"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/85">
                  <span>Client-Id와 Authorization 헤더는 자동으로 포함됩니다.</span>
                  <button
                    type="button"
                    onClick={handleApiCall}
                    className="rounded-lg bg-[#14ad5f] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f8c4c]"
                  >
                    요청 보내기
                  </button>
                </div>
                {apiError ? <p className="text-xs text-red-500">{apiError}</p> : null}
              </div>

              {apiResponse ? <ApiResponseViewer response={apiResponse} /> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthStatus({
  status,
  tokenExpiresAt,
}: {
  status: { type: "idle" | "loading" | "success" | "error"; token?: AccessTokenInfo; error?: string };
  tokenExpiresAt: number | null;
}) {
  if (status.type === "loading") {
    return <p className="text-[#9146FF]">토큰을 확인 중입니다...</p>;
  }

  if (status.type === "error") {
    return <p className="text-red-500">{status.error}</p>;
  }

  if (status.type === "success" && status.token) {
    const expiresIn = tokenExpiresAt ? Math.max(0, Math.round((tokenExpiresAt - Date.now()) / 1000)) : null;
    const isExpired = expiresIn !== null && expiresIn <= 0;

    return (
      <div className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
        <p className="font-semibold">토큰 발급 완료</p>
        <p>scope: {status.token.scope.join(", ") || "(없음)"}</p>
        <p>token_type: {status.token.token_type}</p>
        {expiresIn !== null ? (
          <p className={isExpired ? "text-red-600" : undefined}>
            {isExpired ? "토큰이 만료되었습니다. 갱신을 실행하세요." : `만료까지 약 ${expiresIn}초`}
          </p>
        ) : null}
      </div>
    );
  }

  return <p className="text-sm text-foreground/70">Authorization Code를 입력하여 토큰을 발급받으세요.</p>;
}

function ApiResponseViewer({ response }: { response: ApiResponse }) {
  return (
    <div className="mt-5 space-y-4 rounded-xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
          response.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}
        >
          {response.status}
        </span>
        <span className="text-xs text-foreground/60">{response.durationMs} ms</span>
        <span className="truncate text-xs text-foreground/70">{response.endpoint}</span>
      </div>

      <details className="group" open>
        <summary className="cursor-pointer list-none text-sm font-semibold">요청</summary>
        <div className="mt-2 space-y-2 rounded-lg bg-black/5 p-3 text-xs font-mono text-foreground/80">
          <div>
            <span className="font-semibold">{response.request.method}</span> {response.request.url}
          </div>
          {response.request.body ? (
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(response.request.body, null, 2)}</pre>
          ) : (
            <p className="text-foreground/50">본문 없음</p>
          )}
        </div>
      </details>

      <details className="group" open>
        <summary className="cursor-pointer list-none text-sm font-semibold">응답</summary>
        <div className="mt-2 space-y-3">
          <div className="rounded-lg bg-black/5 p-3 text-xs font-mono text-foreground/70">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(response.response.headers, null, 2)}
            </pre>
          </div>
          <div className="rounded-lg bg-black/5 p-3 text-xs font-mono text-foreground/80">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(response.response.body, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(value).catch(() => alert(`${label} 복사 실패`))}
      className="rounded-full border border-black/10 px-3 py-1 text-xs transition hover:border-[#9146FF]/40 hover:text-foreground"
    >
      {label} 복사
    </button>
  );
}

