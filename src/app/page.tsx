export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 shadow-sm">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">플랫폼 선택</h1>
          <p className="mt-2 text-sm text-foreground/75">
            테스트하려는 플랫폼을 선택하세요. 현재 Twitch와 TikTok 인터페이스를 제공합니다.
            TikTok은 추후 확장을 위한 자리로 아직 구현되어 있지 않습니다.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <PlatformCard
            name="Twitch"
            description="OAuth 토큰 발급과 Helix API 호출을 빠르게 테스트할 수 있는 도구입니다."
            href="/twitch"
            highlight
          />
          <PlatformCard
            name="TikTok"
            description="향후 TikTok API 테스트 도구가 추가될 예정입니다."
            href="/tiktok"
            disabled
          />
        </div>
      </section>
    </div>
  );
}

function PlatformCard({
  name,
  description,
  href,
  highlight = false,
  disabled = false,
}: {
  name: string;
  description: string;
  href: string;
  highlight?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="relative flex h-full flex-col justify-between rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-foreground/60">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs uppercase">
            <span>준비 중</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground/70">{name}</h2>
          <p className="text-sm">{description}</p>
        </div>
        <p className="mt-6 text-xs text-foreground/50">곧 제공 예정입니다.</p>
      </div>
    );
  }

  return (
    <a
      href={href}
      className={`flex h-full flex-col justify-between rounded-2xl border p-6 transition-shadow hover:shadow-md ${
        highlight
          ? "border-[#9146FF] bg-[#f3ebff]/60 text-foreground"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-foreground"
      }`}
    >
      <div className="space-y-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase ${
            highlight
              ? "bg-[#9146FF] text-white"
              : "border border-[var(--color-border)] text-foreground/70"
          }`}
        >
          <span>{highlight ? "추천" : "미리보기"}</span>
        </div>
        <h2 className="text-2xl font-semibold">{name}</h2>
        <p className="text-sm text-foreground/75">{description}</p>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#9146FF]">
        바로가기
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
        </svg>
      </span>
    </a>
  );
}
