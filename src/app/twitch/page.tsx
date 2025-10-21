import { TwitchTester } from "@/components/twitch-tester";
import { getConfiguredEnvSummary } from "@/lib/env";

export default function TwitchPage() {
  const envSummary = getConfiguredEnvSummary();

  return <TwitchTester envSummary={envSummary} />;
}

