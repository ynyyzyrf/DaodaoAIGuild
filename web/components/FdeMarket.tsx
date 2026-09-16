"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";

import { ChannelHero, ChannelSearch, ChannelToolbar } from "@/components/ChannelShell";
import { getLeaderboardByMetric, listSolutions } from "@/lib/api";
import { formatSolutionCoinPrice } from "@/lib/solution-price";
import type { EnterpriseSolutionOut, LeaderboardOut } from "@/lib/types";

const fallbackImages = [
  "/banners/banner-1.png?v=20260828",
  "/banners/banner-2.png?v=20260828",
  "/banners/banner-3.png?v=20260828",
];

function uniqueCount(values: string[]) {
  return new Set(values.map((value) => value.trim()).filter(Boolean)).size;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function SolutionCard({ solution, index }: { solution: EnterpriseSolutionOut; index: number }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="relative h-36 overflow-hidden">
        <img
          src={solution.cover_image_url || fallbackImages[index % fallbackImages.length]}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-md bg-white/92 px-2.5 py-1 text-xs font-black text-brand-600 shadow-sm">
          {solution.category || "企業方案"}
        </span>
      </div>
      <div className="p-5">
        <h2 className="line-clamp-2 text-lg font-black leading-7 text-slate-950">{solution.title}</h2>
        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600">
          {solution.subtitle || "已通過平台審核的企業 AI 方案。"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            solution.industry,
            solution.scenario,
            ...solution.tags,
          ]
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {tag}
              </span>
            ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">服務公司</span>
            <span className="truncate font-bold text-slate-800">{solution.company_name || "待補充"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">交付週期</span>
            <span className="font-bold text-slate-800">{solution.delivery_cycle || "待溝通"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">案例數</span>
            <span className="font-bold text-slate-800">{formatCount(solution.case_count)} 個</span>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-lg font-black text-brand-600">{formatSolutionCoinPrice(solution.budget_range)}</div>
          <Link
            href={`/solutions/${solution.id}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-black text-white transition hover:bg-brand-600"
          >
            查看方案
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CompactFdeRanking() {
  const [items, setItems] = useState<LeaderboardOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLeaderboardByMetric("reputation", 5)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-white/70 bg-white/88 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} strokeWidth={2.2} className="text-brand-500" />
          <h2 className="text-lg font-black text-slate-950">FDE 排行榜</h2>
        </div>
        <Link href="/questions" className="text-xs font-bold text-slate-500 hover:text-brand-600">
          查看更多
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((user, index) => (
          <Link key={user.id} href={`/users/${user.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-brand-50">
            <span className="w-5 text-sm font-black text-brand-500">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-slate-900">{user.display_name || user.username}</span>
              <span className="block truncate text-xs text-slate-500">聲望 {formatCount(user.metric_value)}</span>
            </span>
          </Link>
        ))}
      </div>
      {!loading && items.length === 0 && <p className="mt-4 text-sm leading-6 text-slate-500">暫無可展示的 FDE 排行資料。</p>}
      {loading && <p className="mt-4 text-sm text-slate-400">正在同步最新榜單...</p>}
    </section>
  );
}

export function FdeDirectory() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [sort, setSort] = useState<"recommended" | "cases">("recommended");
  const [solutions, setSolutions] = useState<EnterpriseSolutionOut[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSolutionsLoading(true);
    listSolutions({ q: query, page_size: 60, sort })
      .then((data) => {
        if (!cancelled) setSolutions(data.items);
      })
      .catch(() => {
        if (!cancelled) setSolutions([]);
      })
      .finally(() => {
        if (!cancelled) setSolutionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, sort]);

  const categories = useMemo(
    () => Array.from(new Set(solutions.map((solution) => solution.category).filter(Boolean))),
    [solutions],
  );

  const filtered = useMemo(() => {
    if (!activeCategory) return solutions;
    return solutions.filter((solution) => solution.category === activeCategory);
  }, [solutions, activeCategory]);

  const metrics = [
    { label: "已上架方案", value: formatCount(solutions.length), icon: FileText },
    { label: "服務公司", value: formatCount(uniqueCount(solutions.map((item) => item.company_name))), icon: BriefcaseBusiness },
    { label: "交付案例", value: formatCount(solutions.reduce((sum, item) => sum + item.case_count, 0)), icon: ClipboardCheck },
    { label: "方案分類", value: formatCount(categories.length), icon: Layers3 },
  ];

  return (
    <main className="min-h-screen bg-[#f6f8fb] pb-12">
      <ChannelHero
        title="企業方案"
        subtitle="來自已入駐服務公司的 AI 落地方案。能看到的數據，都來自已審核上架內容。"
        image="/banners/banner-2.png?v=20260828"
        metrics={metrics}
        note={
          <>
            <p className="text-sm font-black text-[#35120d]">真實方案，先看能力再溝通。</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">沒有上架數據時，頁面會保持空狀態，不用假案例撐場。</p>
          </>
        }
      >
        <ChannelSearch
          icon={Search}
          value={query}
          onChange={setQuery}
          placeholder="搜尋方案名稱、公司、行業、場景或關鍵字..."
        />
      </ChannelHero>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <ChannelToolbar>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">方案列表</h2>
            <span className="text-sm font-medium text-slate-400">{formatCount(filtered.length)} 個結果</span>
            {categories.length > 0 && (
              <div className="ml-0 flex flex-wrap gap-1.5 lg:ml-3">
                <button onClick={() => setActiveCategory("")} className={`chip ${activeCategory === "" ? "chip-active" : "chip-idle"}`}>
                  全部
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`chip ${activeCategory === category ? "chip-active" : "chip-idle"}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSort((current) => (current === "recommended" ? "cases" : "recommended"))}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-brand-200 hover:text-brand-600"
          >
            {sort === "recommended" ? "綜合排序" : "案例優先"}
            <ChevronDown size={14} strokeWidth={2.2} />
          </button>
        </ChannelToolbar>

        {solutionsLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">正在同步已審核方案...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="text-base font-bold text-slate-900">暫無已上架企業方案</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">咨詢公司提交方案並通過審核後，會顯示在這裡。</p>
          </div>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((solution, index) => (
              <SolutionCard key={solution.id} solution={solution} index={index} />
            ))}
          </section>
        )}
      </section>
    </main>
  );
}

export function TrustStrip() {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {[
        { label: "真實項目", icon: ClipboardCheck },
        { label: "專業服務", icon: BriefcaseBusiness },
        { label: "平台審核", icon: CheckCircle2 },
        { label: "方案沉澱", icon: Sparkles },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex h-16 items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon size={18} strokeWidth={2.2} />
            </span>
            <span className="font-bold text-slate-800">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
