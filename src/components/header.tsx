"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "테스트 도구" },
  { href: "https://dev.twitch.tv/docs/api", label: "공식 문서", external: true },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/5 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="rounded bg-[#9146FF] px-2 py-1 text-sm font-bold text-white">
            Twitch
          </span>
          <span>API 테스트</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-foreground/80">
          {NAV_ITEMS.map((item) => {
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              );
            }

            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-2 py-1 transition-colors ${
                  isActive ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#9146FF]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

