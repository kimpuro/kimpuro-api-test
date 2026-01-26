
import { TwitchLoginClient } from "@/app/twitch/twitch-login-client";

export default function TwitchPage() {
  const clientId = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_TWITCH_CLIENT_SECRET;
  const callbackUri = process.env.NEXT_PUBLIC_TWITCH_CALLBACK_URI;
  return <TwitchLoginClient clientId={clientId} clientSecret={clientSecret} redirectUri={callbackUri} />;
}

