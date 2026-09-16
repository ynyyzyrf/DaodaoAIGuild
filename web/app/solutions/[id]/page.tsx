"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  Coins,
  Layers3,
  Loader2,
  PackageCheck,
  Tags,
} from "lucide-react";

import { getSolution } from "@/lib/api";
import { formatSolutionCoinPrice } from "@/lib/solution-price";
import type { EnterpriseSolutionOut } from "@/lib/types";

const fallbackImages = [
  "/banners/banner-1.png?v=20260828",
  "/banners/banner-2.png?v=20260828",
  "/banners/banner-3.png?v=20260828",
];

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-black text-slate-900">{value || "待補充"}</span>
    </div>
  );
}

function FieldCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="flex items-center gap-2 text-sm font-black text-slate-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon size={16} strokeWidth={2.3} />
        </span>
        {label}
      </div>
      <div className="mt-4 text-xl font-black text-slate-950">{value || "待補充"}</div>
    </div>
  );
}

export default function SolutionDetailPage() {
  const params = useParams<{ id: string }>();
  const solutionId = Number(params.id);
  const [solution, setSolution] = useState<EnterpriseSolutionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!solutionId) {
      setError("方案不存在");
      setLoading(false);
      return;
    }
    let cancelled = false;
    getSolution(solutionId)
      .then((data) => {
        if (!cancelled) setSolution(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "方案載入失敗");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [solutionId]);

  const image = useMemo(() => {
    if (!solution) return fallbackImages[0];
    return solution.cover_image_url || fallbackImages[solution.id % fallbackImages.length];
  }, [solution]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f8fb] px-4 py-16">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-bold text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          正在載入方案...
        </div>
      </main>
    );
  }

  if (error || !solution) {
    return (
      <main className="min-h-screen bg-[#f6f8fb] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <h1 className="text-xl font-black text-slate-950">找不到這個方案</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{error || "方案可能尚未通過審核，或已被下架。"}</p>
          <Link href="/fde" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-black text-white">
            返回企業方案
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] pb-14">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 opacity-80">
          <img src={image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.86)_48%,rgba(255,255,255,0.55)_100%)]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
          <Link href="/fde" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-brand-600">
            <ArrowLeft size={16} strokeWidth={2.4} />
            返回企業方案
          </Link>
          <div className="mt-8 max-w-3xl">
            <div className="flex flex-wrap gap-2">
              {[solution.category, solution.industry, solution.scenario].filter(Boolean).map((item) => (
                <span key={item} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700 ring-1 ring-brand-100">
                  {item}
                </span>
              ))}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{solution.title}</h1>
            <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-slate-600">
              {solution.subtitle || "這是咨詢公司提交並通過 Daostore 審核的企業 AI 方案。"}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 text-sm font-black text-white transition hover:bg-brand-600"
              >
                基於此方案提交需求
                <ArrowRight size={16} strokeWidth={2.6} />
              </Link>
              <span className="text-sm font-bold text-slate-500">服務方：{solution.company_name || "待補充"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-10">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <FieldCard icon={CalendarClock} label="交付週期" value={solution.delivery_cycle} />
            <FieldCard icon={Coins} label="方案價格" value={formatSolutionCoinPrice(solution.budget_range)} />
            <FieldCard icon={ClipboardCheck} label="案例數" value={`${formatCount(solution.case_count)} 個`} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
              <PackageCheck size={20} strokeWidth={2.4} className="text-brand-600" />
              方案內容
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-base font-medium leading-8 text-slate-600">
              {solution.subtitle || "咨詢公司暫未補充更詳細的方案描述。"}
            </p>
          </section>

          {solution.tags.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <Tags size={20} strokeWidth={2.4} className="text-brand-600" />
                方案標籤
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {solution.tags.map((tag) => (
                  <span key={tag} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <h2 className="text-lg font-black text-slate-950">上架字段</h2>
          <div className="mt-3">
            <InfoRow label="方案名稱" value={solution.title} />
            <InfoRow label="分類" value={solution.category} />
            <InfoRow label="行業" value={solution.industry} />
            <InfoRow label="場景" value={solution.scenario} />
            <InfoRow label="交付週期" value={solution.delivery_cycle} />
            <InfoRow label="價格/預算" value={formatSolutionCoinPrice(solution.budget_range)} />
            <InfoRow label="服務公司" value={solution.company_name} />
            <InfoRow label="案例數" value={`${formatCount(solution.case_count)} 個`} />
          </div>
          <div className="mt-6 rounded-2xl bg-brand-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-brand-700">
              <BriefcaseBusiness size={16} strokeWidth={2.4} />
              方案由咨詢公司提交
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">這裡展示的是已審核上架的方案字段；服務公司只是承接方信息，不作為主跳轉目標。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
