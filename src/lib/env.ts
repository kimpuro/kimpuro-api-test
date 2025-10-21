const requiredEnv = ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "TWITCH_REDIRECT_URI"] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

function readEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} 환경 변수가 설정되지 않았습니다.`);
  }
  return value;
}

export const twitchEnv = {
  clientId: () => readEnv("TWITCH_CLIENT_ID"),
  clientSecret: () => readEnv("TWITCH_CLIENT_SECRET"),
  redirectUri: () => readEnv("TWITCH_REDIRECT_URI"),
};

export function getConfiguredEnvSummary() {
  return requiredEnv.map((key) => ({ key, configured: Boolean(process.env[key]) }));
}

