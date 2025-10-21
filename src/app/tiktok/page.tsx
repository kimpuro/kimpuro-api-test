export default function TikTokPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-foreground/70">
        <header className="mb-4">
          <h1 className="text-3xl font-semibold text-foreground">TikTok API 테스트</h1>
          <p className="mt-2 text-sm">
            TikTok 지원은 준비 중입니다. 필요한 요구 사항이나 기대하는 기능이 있다면 알려주세요.
          </p>
        </header>
        <p className="text-sm">
          이 페이지는 추후 TikTok OAuth 인증, API 호출 프리셋, 미디어 업로드 테스트 등을 제공하기 위한 자리입니다.
        </p>
      </section>
    </div>
  );
}