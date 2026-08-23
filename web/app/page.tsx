"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
} from "lucide-react";

import CommunityFeed from "@/components/CommunityFeed";
import HeroCarousel from "@/components/HeroCarousel";
import KnightLeaderboard from "@/components/KnightLeaderboard";
import SidebarNav from "@/components/SidebarNav";

export default function HomePage() {
  return (
    <>
      {/* —— Full-width Hero Carousel（独立於下方 max-w 容器）—— */}
      <HeroCarousel />

      {/* —— Sidebar + Main：max-w 1500px，Sidebar 收起時 Main 自動擴展 —— */}
      <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <SidebarNav />
        <main className="min-w-0 flex-1">
          {/* —— 社區板塊（两卡）—— */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              社區板塊
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link href="/questions" className="card card-hover group relative flex gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <MessageSquare size={22} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-slate-900">问题广场</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
                    提出 AI 落地中的坑，向騎士求助，採納最佳方案。
                  </p>
                </span>
                <ArrowRight
                  size={18}
                  strokeWidth={2}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-hover:translate-x-1 group-hover:text-brand-500"
                />
              </Link>
              <Link href="/tutorials" className="card card-hover group relative flex gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <BookOpen size={22} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-slate-900">龍蝦学院</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
                    沉澱 FDE、AI Agent 實戰教程，從零到一。
                  </p>
                </span>
                <ArrowRight
                  size={18}
                  strokeWidth={2}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-hover:translate-x-1 group-hover:text-brand-500"
                />
              </Link>
            </div>
          </section>

          {/* —— 社區正在發生 —— */}
          <div className="mt-12">
            <CommunityFeed />
          </div>

          {/* —— 騎士排行榜（id=rankings 供侧栏錨點跳轉）—— */}
          <div className="mt-12">
            <KnightLeaderboard />
          </div>

          {/* —— CTA 召喚 —— */}
          <section className="mt-16 flex flex-col items-center gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/30 p-10 text-center">
            <span className="text-3xl">🦞</span>
            <h3 className="text-xl font-bold text-slate-900">召喚你的第一位騎士</h3>
            <p className="max-w-md text-[15px] leading-relaxed text-slate-600">
              遇到 AI 落地的具體場景？把問題拋出來，讓社區的 FDE、開發者、AI 工程師一起幫你想清楚。
            </p>
            <Link href="/questions/new" className="btn btn-primary">
              <MessageSquare size={16} strokeWidth={2.5} />
              去提问
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}
