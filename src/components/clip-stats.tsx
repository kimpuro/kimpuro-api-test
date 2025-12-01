"use client";

import { useState } from "react";

type ClipData = {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
};

type ClipStatsResult = {
  totalClips: number;
  totalViews: number;
  totalFollowers: number;
  totalSubscribers: number | null; // null = 조회 불가 (본인 채널이 아님)
  clips: ClipData[];
  broadcasterName: string;
  broadcasterId: string;
};

type ClipStatsProps = {
  accessToken: string;
  clientId: string;
};

export function ClipStats({ accessToken, clientId }: ClipStatsProps) {
  const [streamerName, setStreamerName] = useState("");
  const [months, setMonths] = useState(24); // 기본값: 24개월 (2년)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClipStatsResult | null>(null);
  const [progress, setProgress] = useState<string>("");

  const handleSearch = async () => {
    if (!streamerName.trim()) {
      setError("스트리머 이름을 입력해주세요.");
      return;
    }

    if (!accessToken || !clientId) {
      setError("먼저 Twitch 인증을 완료해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress("사용자 정보 조회 중...");

    try {
      // 1단계: 스트리머 이름으로 사용자 ID 가져오기
      const userResponse = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(streamerName.trim())}`,
        {
          headers: {
            "Client-Id": clientId,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!userResponse.ok) {
        throw new Error(`사용자 정보 조회 실패 (${userResponse.status})`);
      }

      const userData = await userResponse.json();
      if (!userData.data || userData.data.length === 0) {
        throw new Error("해당 스트리머를 찾을 수 없습니다.");
      }

      const broadcasterId = userData.data[0].id;
      const broadcasterName = userData.data[0].display_name;

      // 2단계: 팔로워 수 가져오기
      setProgress("팔로워 수 조회 중...");
      let totalFollowers = 0;
      try {
        const followersResponse = await fetch(
          `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`,
          {
            headers: {
              "Client-Id": clientId,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          totalFollowers = followersData.total || 0;
        }
      } catch (error) {
        console.warn("팔로워 수 조회 실패:", error);
      }

      // 3단계: 구독자 수 가져오기 (본인 채널만 가능)
      setProgress("구독자 수 조회 중...");
      let totalSubscribers: number | null = null;
      try {
        const subscribersResponse = await fetch(
          `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`,
          {
            headers: {
              "Client-Id": clientId,
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (subscribersResponse.ok) {
          const subscribersData = await subscribersResponse.json();
          totalSubscribers = subscribersData.total || 0;
        } else if (subscribersResponse.status === 401 || subscribersResponse.status === 403) {
          // 권한 없음 - 본인 채널이 아님
          totalSubscribers = null;
        }
      } catch (error) {
        console.warn("구독자 수 조회 실패:", error);
      }

      // 4단계: 모든 클립 가져오기 (시간 범위별로 분할 조회)
      setProgress("클립 수집 중... (0개)");
      let allClips: ClipData[] = [];
      
      // 시간 범위를 7일 단위로 나눠서 조회 (Twitch API 제한 우회)
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - months); // 입력받은 개월 수만큼 과거로
      
      let currentEndDate = new Date(now);
      let currentStartDate = new Date(currentEndDate);
      currentStartDate.setDate(currentStartDate.getDate() - 7); // 7일 단위
      
      const clipIds = new Set<string>(); // 중복 제거용

      while (currentEndDate > startDate) {
        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const clipsUrl = new URL("https://api.twitch.tv/helix/clips");
          clipsUrl.searchParams.set("broadcaster_id", broadcasterId);
          clipsUrl.searchParams.set("first", "100");
          clipsUrl.searchParams.set("started_at", currentStartDate.toISOString());
          clipsUrl.searchParams.set("ended_at", currentEndDate.toISOString());

          if (cursor) {
            clipsUrl.searchParams.set("after", cursor);
          }

          const clipsResponse = await fetch(clipsUrl.toString(), {
            headers: {
              "Client-Id": clientId,
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!clipsResponse.ok) {
            throw new Error(`클립 조회 실패 (${clipsResponse.status})`);
          }

          const clipsData = await clipsResponse.json();
          
          if (clipsData.data && clipsData.data.length > 0) {
            // 중복 제거하며 추가
            for (const clip of clipsData.data) {
              if (!clipIds.has(clip.id)) {
                clipIds.add(clip.id);
                allClips.push(clip);
              }
            }
            setProgress(`클립 수집 중... (${allClips.length.toLocaleString()}개) - ${currentStartDate.toLocaleDateString()} ~ ${currentEndDate.toLocaleDateString()}`);
          }

          // 다음 페이지가 있는지 확인
          if (clipsData.pagination && clipsData.pagination.cursor) {
            cursor = clipsData.pagination.cursor;
          } else {
            hasMore = false;
          }
        }

        // 다음 7일 구간으로 이동
        currentEndDate = new Date(currentStartDate);
        currentStartDate = new Date(currentEndDate);
        currentStartDate.setDate(currentStartDate.getDate() - 7);
      }

      // 5단계: 통계 계산
      setProgress("통계 계산 중...");
      const totalViews = allClips.reduce((sum, clip) => sum + clip.view_count, 0);

      setResult({
        totalClips: allClips.length,
        totalViews,
        totalFollowers,
        totalSubscribers,
        clips: allClips,
        broadcasterName,
        broadcasterId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-semibold text-foreground">스트리머 클립 통계</h2>
      <p className="mb-6 text-sm text-foreground/90">
        스트리머 이름과 조회 기간을 입력하면 해당 기간의 클립 개수와 총 조회수를 확인할 수 있습니다.
      </p>

      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={streamerName}
            onChange={(e) => setStreamerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleSearch();
              }
            }}
            placeholder="스트리머 이름 (예: fps_shaka)"
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3 text-sm text-foreground placeholder:text-foreground/50 focus:border-[#9146FF] focus:outline-none"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !accessToken || !clientId}
            className="rounded-lg bg-[#9146FF] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#6c2ddc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground/90">
            <span>조회 기간:</span>
            <input
              type="number"
              min="1"
              max="120"
              value={months}
              onChange={(e) => setMonths(Math.max(1, Math.min(120, parseInt(e.target.value) || 24)))}
              className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-foreground text-center focus:border-[#9146FF] focus:outline-none"
              disabled={loading}
            />
            <span>개월</span>
          </label>
          <span className="text-xs text-foreground/60">
            (1~120개월, 기본: 24개월)
          </span>
        </div>
      </div>

      {loading && progress && (
        <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent"></div>
            <p className="font-semibold">{progress}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">오류 발생</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-300 bg-green-50 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-green-900">{result.broadcasterName}</h3>
              <p className="text-sm text-green-700">ID: {result.broadcasterId}</p>
              <p className="text-xs text-green-600 mt-1">📅 최근 {months}개월 데이터</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-foreground/70">전체 클립 개수</p>
                <p className="mt-1 text-3xl font-bold text-[#9146FF]">
                  {result.totalClips.toLocaleString()}개
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-foreground/70">전체 조회수</p>
                <p className="mt-1 text-3xl font-bold text-[#14ad5f]">
                  {result.totalViews.toLocaleString()}회
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-foreground/70">팔로워 수</p>
                <p className="mt-1 text-3xl font-bold text-[#FF6B6B]">
                  {result.totalFollowers.toLocaleString()}명
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-foreground/70">구독자 수</p>
                {result.totalSubscribers !== null ? (
                  <p className="mt-1 text-3xl font-bold text-[#FFB800]">
                    {result.totalSubscribers.toLocaleString()}명
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-foreground/50">
                    조회 불가<br />
                    <span className="text-xs">(본인 채널만 가능)</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer list-none rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-sm font-semibold text-foreground transition hover:bg-[var(--color-border)]/20">
              클립 상세 정보 ({result.clips.length}개)
            </summary>
            <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
              <div className="space-y-3">
                {result.clips.slice(0, 50).map((clip) => (
                  <div
                    key={clip.id}
                    className="rounded-lg border border-black/10 bg-white p-3 text-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <a
                        href={clip.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#9146FF] hover:underline"
                      >
                        {clip.title}
                      </a>
                      <span className="shrink-0 text-xs text-foreground/60">
                        {clip.view_count.toLocaleString()}회
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
                      <span>제작자: {clip.creator_name}</span>
                      <span>•</span>
                      <span>{new Date(clip.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{clip.duration.toFixed(1)}초</span>
                    </div>
                  </div>
                ))}
                {result.clips.length > 50 && (
                  <p className="text-center text-sm text-foreground/60">
                    ... 그 외 {result.clips.length - 50}개의 클립
                  </p>
                )}
              </div>
            </div>
          </details>
        </div>
      )}

      {!accessToken || !clientId ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">인증 필요</p>
          <p>위의 Twitch API 테스트 도구에서 먼저 인증을 완료해주세요.</p>
        </div>
      ) : null}
    </div>
  );
}

