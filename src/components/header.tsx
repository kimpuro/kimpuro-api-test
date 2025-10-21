"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "플랫폼 선택" },
  { href: "/twitch", label: "Twitch" },
  { href: "/tiktok", label: "TikTok" },
  { href: "https://dev.twitch.tv/docs/api", label: "Twitch 문서", external: true },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/5 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
          <span className="relative h-9 w-9 overflow-hidden rounded-full border border-[var(--color-border)]">
            <Image src="/puro.JPG" alt="플랫폼 아이콘" fill sizes="36px" className="object-cover" />
          </span>
          <span>
            <span className="block text-sm text-foreground/70">API 테스트</span>
            <span className="block text-base font-semibold text-foreground">플랫폼 선택</span>
          </span>
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

