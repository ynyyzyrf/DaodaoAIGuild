"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Clock3,
  Flame,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

import ProtectedEntryLink from "@/components/ProtectedEntryLink";
import { getMyCompanyState, listHomeSolutions } from "@/lib/api";
import { getCurrentUser, getToken } from "@/lib/auth";
import { formatSolutionCoinPrice } from "@/lib/solution-price";
import type { EnterpriseSolutionOut } from "@/lib/types";

const fallbackImages = [
  "/banners/banner-1.png?v=20260828",
  "/banners/banner-2.png?v=20260828",
  "/banners/banner-3.png?v=20260828",
];

function TrustBar() {
  return (
    <div className="mx-auto mt-6 flex min-h-16 max-w-[1120px] items-center rounded-[18px] border border-white/70 bg-white/58 px-5 py-3 shadow-[0_16px_42px_rgba(46,25,14,0.10)] backdrop-blur-xl sm:px-8 lg:px-10">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0df] text-brand-600 shadow-[0_10px_22px_rgba(197,87,60,0.14)]">
          <Zap size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-black leading-5 text-slate-800 sm:text-base">某製造企業 剛剛下單了</span>
            <span className="text-base font-black leading-6 text-brand-600 sm:text-lg">「經銷商評估 Agent」</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">新的企業服務需求已進入評估流程</div>
        </div>
        <Link
          href="/opportunities"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-slate-500 transition hover:text-brand-600"
        >
          查看詳情
          <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}

function HeroChatEntry() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [showCompanyApply, setShowCompanyApply] = useState(true);

  useEffect(() => {
    if (!getToken() || !getCurrentUser()) {
      setShowCompanyApply(true);
      return;
    }

    let cancelled = false;
    getMyCompanyState()
      .then((state) => {
        if (cancelled) return;
        const hasCompanyIdentity = Boolean(state.active_company) || state.managed_companies.length > 0;
        setShowCompanyApply(!hasCompanyIdentity);
      })
      .catch(() => {
        if (!cancelled) setShowCompanyApply(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;
    router.push(`/chat?message=${encodeURIComponent(query)}`);
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-[940px] rounded-[20px] border border-white/80 bg-white/88 p-4 shadow-[0_24px_70px_rgba(46,25,14,0.18)] backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="flex h-14 min-w-0 items-center gap-3 rounded-[14px] border border-slate-100 bg-white/75 px-4">
          <Search size={21} strokeWidth={2.2} className="shrink-0 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
            placeholder="例如：我想把經銷商開發流程交給 FDE 重做......"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <button
            type="submit"
            disabled={!input.trim()}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-[15px] bg-brand-500 px-7 text-base font-black text-white shadow-[0_16px_32px_rgba(197,87,60,0.28)] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <Sparkles size={18} strokeWidth={2.4} />
            看看誰能搞定
            <ArrowRight size={18} strokeWidth={2.6} />
          </button>
          {showCompanyApply && (
            <ProtectedEntryLink
              href="/companies/new"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[15px] border border-slate-200 bg-white px-7 text-base font-black text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition hover:border-brand-200 hover:text-brand-600 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)]"
            >
              <Building2 size={19} strokeWidth={2.4} />
              申請入駐
            </ProtectedEntryLink>
          )}
        </div>
      </form>
    </div>
  );
}

function SolutionCard({ item, rank }: { item: EnterpriseSolutionOut; rank: number }) {
  const image = item.cover_image_url || fallbackImages[(rank - 1) % fallbackImages.length];
  return (
    <article className="group overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
      <div className="relative h-44 overflow-hidden">
        <img src={image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <span className="absolute left-4 top-4 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(197,87,60,0.24)]">
          TOP {rank}
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
        <p className="mt-2 line-clamp-2 min-h-12 text-sm font-medium leading-6 text-slate-600">
          {item.subtitle || "標準化企業 AI 方案，通過 Daostore 審核後上架。"}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-slate-500">
          {item.delivery_cycle && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={16} strokeWidth={2.2} className="text-slate-400" />
              {item.delivery_cycle}
            </span>
          )}
        </div>
        <div className="mt-6 flex items-end justify-between gap-3">
          <div className="text-2xl font-black text-brand-600">{formatSolutionCoinPrice(item.budget_range)}</div>
          <Link
            href={`/solutions/${item.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-black text-white transition hover:bg-brand-600"
          >
            查看方案
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [solutions, setSolutions] = useState<EnterpriseSolutionOut[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(true);

  useEffect(() => {
    listHomeSolutions(3)
      .then(setSolutions)
      .catch(() => setSolutions([]))
      .finally(() => setSolutionsLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <section className="relative isolate overflow-hidden pb-9 pt-12">
        <div className="absolute inset-0 -z-10 bg-[#f6f8fb]">
          <img
            src="/banners/home-hero-fde-marketplace-v3.png?v=20260915"
            alt=""
            className="absolute inset-x-0 top-0 h-[520px] w-full object-cover object-center"
          />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(90deg,rgba(255,249,242,0.68)_0%,rgba(255,255,255,0.46)_34%,rgba(255,255,255,0.18)_68%,rgba(255,246,235,0.40)_100%)]" />
          <div className="absolute inset-x-0 top-[380px] h-56 bg-gradient-to-t from-[#f6f8fb] via-[#f6f8fb]/82 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.70)] sm:text-6xl lg:text-[72px]">
              企業有難題，<span className="text-brand-600">FDE 有解法。</span>
            </h1>
            <p className="mt-5 text-lg font-black leading-8 text-slate-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.70)] sm:text-2xl">
              說出需求，匹配合適 FDE，從方案到交付，一站完成。
            </p>
          </div>

          <HeroChatEntry />
          <TrustBar />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-2 sm:px-6 lg:px-10">
        <div className="rounded-[24px] border border-slate-200 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Flame size={28} strokeWidth={2.2} className="text-brand-500" />
              <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">本週熱門・企業都在找這些 FDE</h2>
              <span className="text-sm font-black text-slate-400">真實需求・快速匹配・專業交付</span>
            </div>
            <Link href="/fde" className="inline-flex items-center gap-1.5 text-sm font-black text-slate-500 hover:text-brand-600">
              查看全部方案
              <ArrowRight size={15} strokeWidth={2.4} />
            </Link>
          </div>

          {solutionsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-400">正在同步已審核方案...</div>
          ) : solutions.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {solutions.map((item, index) => (
                <SolutionCard key={item.id} item={item} rank={index + 1} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <div className="text-base font-bold text-slate-900">暫無已上架企業方案</div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
