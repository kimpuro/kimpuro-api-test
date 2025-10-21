export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-foreground/70 sm:flex-row sm:items-center sm:justify-between">
        <p>직접 발급한 클라이언트와 토큰으로 Twitch API를 테스트하세요.</p>
        <p className="text-xs text-foreground/50">
          개인정보와 토큰은 로컬 세션에만 저장됩니다.
        </p>
      </div>
    </footer>
  );
}

