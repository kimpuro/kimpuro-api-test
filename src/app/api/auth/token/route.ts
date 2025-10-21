import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ExchangeRequest = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ExchangeRequest>;
    const { clientId, clientSecret, redirectUri, code } = body;

    if (!clientId || !clientSecret || !redirectUri || !code) {
      return NextResponse.json(
        { message: "clientId, clientSecret, redirectUri, code 값이 모두 필요합니다." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const twitchResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const payload = await twitchResponse.json();

    return NextResponse.json(payload, { status: twitchResponse.status });
  } catch (error) {
    console.error("/api/auth/token", error);
    return NextResponse.json(
      { message: "토큰 교환 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

