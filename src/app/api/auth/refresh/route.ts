import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RefreshRequest = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RefreshRequest>;
    const { clientId, clientSecret, refreshToken } = body;

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { message: "clientId, clientSecret, refreshToken이 모두 필요합니다." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const twitchResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const payload = await twitchResponse.json();

    return NextResponse.json(payload, { status: twitchResponse.status });
  } catch (error) {
    console.error("/api/auth/refresh", error);
    return NextResponse.json(
      { message: "토큰 갱신 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

