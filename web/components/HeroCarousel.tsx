"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 首頁 Hero Banner 自動輪播（docs/UI-STYLE.md §X）。
 *
 * - Full-width，置於 Header 正下方，獨立於 Sidebar + Main 的 max-width
 * - 3 張設計稿 Banner 圖 + 可訪問文字層
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
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
}

const SLIDES: HeroSlide[] = [
  {
    src: "/banners/banner-1.png?v=20260828",
    alt: "本週精選：讓 AI Agent 自己修復失敗，點擊查看教程",
    href: "/tutorials",
    eyebrow: "本週精選",
    title: "讓 AI Agent 自己修復失敗",
    description: "從真實錯誤、追蹤到復盤，學會把一次排錯變成可復用能力。",
    cta: "查看教程",
  },
  {
    src: "/banners/banner-2.png?v=20260828",
    alt: "龍蝦學院：AI Agent 從 Demo 到真正落地，點擊進入學院",
    href: "/tutorials",
    eyebrow: "龍蝦學院",
    title: "AI Agent 從 Demo 到真正落地",
    description: "沉澱交付方法、案例和工具鏈，讓方案可以被驗收、維護和複用。",
    cta: "進入學院",
  },
  {
    src: "/banners/banner-3.png?v=20260828",
    alt: "騎士社區：加入龍蝦騎士，一起解決 AI 落地問題，點擊看看騎士們",
    href: "/questions",
    eyebrow: "騎士社區",
    title: "一起解決 AI 落地問題",
    description: "提問、討論、採納方案，讓龍蝦騎士在真實問題中升級。",
    cta: "看看問題",
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
        {/* 控制首屏注意力：保留 Banner，但用固定响应高度避免宽屏过高。 */}
        <div className="relative h-[190px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_18px_40px_rgba(16,24,40,0.10)] sm:h-[230px] lg:h-[286px]">
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
                <Link href={slide.href} className="relative block h-full w-full bg-slate-950">
                  <span className="absolute inset-y-0 right-0 w-full md:w-[72%]">
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 1080px"
                      priority={i === 0}
                      className="object-cover opacity-55 md:opacity-90"
                    />
                    <span className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/24 to-transparent md:from-slate-950/70 md:via-slate-950/10" />
                  </span>
                  <span className="absolute inset-y-0 left-0 z-10 flex w-full flex-col justify-center bg-gradient-to-r from-slate-950 via-slate-950/96 to-slate-950/58 px-6 py-5 text-white sm:px-9 md:w-[52%] md:to-slate-950/0 lg:px-12">
                    <span className="text-xs font-bold uppercase text-brand-200 sm:text-sm">
                      {slide.eyebrow}
                    </span>
                    <span className="mt-2 max-w-[14em] text-[28px] font-extrabold leading-[1.08] sm:text-4xl lg:text-[40px]">
                      {slide.title}
                    </span>
                    <span className="mt-3 hidden max-w-[32rem] text-sm font-medium leading-6 text-slate-200 sm:block lg:text-base">
                      {slide.description}
                    </span>
                    <span className="mt-4 inline-flex h-10 w-fit items-center rounded-lg bg-white px-4 text-sm font-bold text-slate-950 shadow-sm transition-transform group-hover/hero:translate-x-0.5 sm:mt-5 sm:h-11 sm:px-5">
                      {slide.cta}
                    </span>
                  </span>
                </Link>
              </div>
            );
          })}

          {/* 左右切換（hover 才顯示） */}
          <button
            type="button"
            onClick={() => go(current - 1)}
            aria-label="上一张"
            className="absolute bottom-5 right-16 z-20 hidden h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 ring-inset ring-white/70 transition hover:bg-white md:flex md:opacity-0 md:group-hover/hero:opacity-100"
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            aria-label="下一张"
            className="absolute bottom-5 right-5 z-20 hidden h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm ring-1 ring-inset ring-white/70 transition hover:bg-white md:flex md:opacity-0 md:group-hover/hero:opacity-100"
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>

          {/* 圆点 pagination */}
          <div
            className="absolute bottom-5 right-6 z-20 flex items-center gap-2 md:right-28"
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
                    ? "w-7 bg-white"
                    : "w-2 bg-white/45 hover:bg-white/75"
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
