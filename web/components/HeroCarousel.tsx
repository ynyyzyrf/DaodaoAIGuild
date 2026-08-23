"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 首頁 Hero Banner 自動輪播（docs/UI-STYLE.md §X）。
 *
 * - Full-width，置於 Header 正下方，獨立於 Sidebar + Main 的 max-width
 * - 3 張設計稿 Banner 圖（文字 + CTA 已內嵌於圖內）
 * - 自動播放 5.5s / fade 500ms
 * - 鼠标 hover 暫停 + 顯示左右切換
 * - 底部圓點 pagination
 * - 整張 Banner 可點擊跳轉
 */

const ROTATE_MS = 5500;
const FADE_MS = 500;

interface HeroSlide {
  src: string;
  alt: string;
  href: string;
}

const SLIDES: HeroSlide[] = [
  {
    src: "/banners/banner-1.png",
    alt: "本週精選：讓 AI Agent 自己修復失敗，點擊查看教程",
    href: "/tutorials",
  },
  {
    src: "/banners/banner-2.png",
    alt: "龍蝦學院：AI Agent 從 Demo 到真正落地，點擊進入學院",
    href: "/tutorials",
  },
  {
    src: "/banners/banner-3.png",
    alt: "騎士社區：加入龍蝦騎士，一起解決 AI 落地問題，點擊看看騎士們",
    href: "/questions",
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused]);

  function go(i: number) {
    setCurrent(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }

  return (
    <section
      className="group/hero relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="社區重點內容"
    >
      <div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-6">
        {/* 3:1 與 Banner 原圖同比例，object-cover 不裁切 */}
        <div className="relative aspect-[3/1] overflow-hidden rounded-3xl border shadow-[0_8px_30px_rgba(16,24,40,0.06)]">
          {SLIDES.map((slide, i) => {
            const active = i === current;
            return (
              <div
                key={slide.src}
                className={`absolute inset-0 transition-opacity ease-out ${
                  active ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{ transitionDuration: `${FADE_MS}ms` }}
                aria-hidden={!active}
              >
                <Link href={slide.href} className="relative block h-full w-full">
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    sizes="(max-width: 1500px) 100vw, 1500px"
                    priority={i === 0}
                    className="object-cover"
                  />
                </Link>
              </div>
            );
          })}

          {/* 左右切換（hover 才顯示） */}
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="上一张"
            className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-white md:flex md:opacity-0 md:group-hover/hero:opacity-100"
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="下一张"
            className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-white md:flex md:opacity-0 md:group-hover/hero:opacity-100"
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>

          {/* 圆点 pagination */}
          <div
            className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2"
            role="tablist"
            aria-label="幻灯片导航"
          >
            {SLIDES.map((s, i) => (
              <button
                key={s.src + i}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`第 ${i + 1} 张：${s.alt}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full shadow-sm transition-all ${
                  i === current
                    ? "w-7 bg-brand-500"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                style={{ transitionDuration: `${FADE_MS}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
