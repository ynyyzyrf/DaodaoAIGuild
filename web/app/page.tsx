"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileCheck2,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import ProtectedEntryLink from "@/components/ProtectedEntryLink";

function PrimaryPathCard({
  href,
  eyebrow,
  title,
  description,
  action,
  icon,
  primary = false,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <ProtectedEntryLink
      href={href}
      className={`group flex min-h-[220px] flex-col justify-between rounded-lg border p-6 transition-all hover:-translate-y-0.5 ${
        primary
          ? "border-brand-200 bg-brand-500 text-white shadow-[0_18px_42px_rgba(177,82,56,0.24)]"
          : "border-slate-200 bg-white text-slate-950 hover:border-brand-200 hover:shadow-[0_12px_30px_rgba(16,24,40,0.08)]"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
              primary ? "bg-white/14 text-white" : "bg-brand-50 text-brand-600"
            }`}
          >
            {icon}
          </span>
          <span className={`text-xs font-semibold ${primary ? "text-white/70" : "text-slate-400"}`}>{eyebrow}</span>
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">{title}</h2>
        <p className={`mt-3 text-sm leading-6 ${primary ? "text-white/82" : "text-slate-600"}`}>{description}</p>
      </div>
      <span className={`mt-6 inline-flex items-center gap-2 text-sm font-bold ${primary ? "text-white" : "text-brand-600"}`}>
        {action}
        <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
      </span>
    </ProtectedEntryLink>
  );
}

function CapabilityCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}

const capabilities = [
  {
    title: "需求被整理成可評估的項目",
    description: "把業務背景、交付目標、預算和時間線放進同一套結構，降低反覆溝通成本。",
    icon: <FileCheck2 size={22} strokeWidth={2.2} />,
  },
  {
    title: "合作夥伴按能力進入供給側",
    description: "諮詢公司提交服務方向與案例，通過平台審核後再承接需求，讓對接更有邊界。",
    icon: <ShieldCheck size={22} strokeWidth={2.2} />,
  },
  {
    title: "從承接到交付保留完整狀態",
    description: "需求審核、接單、報價、模擬支付、交付與驗收，都能在平台內追蹤。",
    icon: <SearchCheck size={22} strokeWidth={2.2} />,
  },
];

export default function HomePage() {
  return (
    <main className="bg-slate-50/70">
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 -z-10">
          <img src="/banners/banner-2.png?v=20260828" alt="" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.86)_42%,rgba(15,23,42,0.30)_100%)]" />
        </div>
        <div className="mx-auto grid min-h-[500px] max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/82">
              <Sparkles size={16} strokeWidth={2.2} />
              Daostore AI Guild
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              企業提出需求，FDE 社區負責落地
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
              把 AI 落地場景從口頭想法變成可審核、可承接、可報價、可驗收的正式需求訂單。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ProtectedEntryLink href="/orders/new" className="btn h-12 bg-brand-500 px-6 text-white hover:bg-brand-600">
                <ClipboardList size={17} strokeWidth={2.5} />
                提交需求
              </ProtectedEntryLink>
              <ProtectedEntryLink href="/companies/new" className="btn h-12 border border-white/18 bg-white/10 px-6 text-white hover:bg-white/16">
                <Building2 size={17} strokeWidth={2.4} />
                申請入駐
              </ProtectedEntryLink>
            </div>
          </div>

          <div className="rounded-lg border border-white/12 bg-white/10 p-5 backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/55">履約流程</div>
            <div className="mt-5 grid gap-3">
              {[
                { label: "需求審核", text: "平台先確認場景、資料和交付邊界。", icon: <ShieldCheck size={18} strokeWidth={2.3} /> },
                { label: "機會池撮合", text: "合適的咨詢公司/FDE 直接接單。", icon: <SearchCheck size={18} strokeWidth={2.3} /> },
                { label: "報價與交付", text: "接單後進入報價、支付和驗收。", icon: <ClipboardList size={18} strokeWidth={2.3} /> },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/12 text-brand-100">{item.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{item.label}</div>
                      <div className="mt-1 text-sm leading-5 text-slate-300">{item.text}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <PrimaryPathCard
            href="/orders/new"
            eyebrow="企業方"
            title="提交一個可被承接的需求"
            description="描述業務背景、交付物和時間預期，讓平台能審核，讓承接方能估工作量。"
            action="開始提交"
            icon={<ClipboardList size={24} strokeWidth={2.2} />}
            primary
          />
          <PrimaryPathCard
            href="/companies/new"
            eyebrow="服務方"
            title="讓咨詢公司進入供給側"
            description="提交公司資料、能力方向和案例，通過審核後即可承接機會池需求。"
            action="申請入駐"
            icon={<Building2 size={24} strokeWidth={2.2} />}
          />
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-10">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">Platform</div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              為 AI 項目落地設計的協作基礎設施
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Daostore AI Guild 將需求方、諮詢公司與實戰者放在同一條交付鏈路上，讓每一次合作都有清楚的入口、責任與進度。
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {capabilities.map((item) => (
              <CapabilityCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-10">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-200">Next Step</div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">讓下一個 AI 需求進入可交付狀態</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-300">
            企業可以先提交需求，服務方可以先完成入駐。平台會圍繞審核、承接與交付，把合作推進到下一步。
          </p>
        </div>
      </section>
    </main>
  );
}
