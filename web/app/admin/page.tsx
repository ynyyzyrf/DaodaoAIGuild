"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSearch,
  Handshake,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDashboard } from "@/lib/admin-api";
import type { DashboardData } from "@/lib/admin-api";

const ORDER_STAGES = [
  { key: "pending_review", label: "待審核", tone: "bg-brand-500", href: "/admin/orders?status=pending_review" },
  { key: "opportunity_pool", label: "機會池", tone: "bg-teal-600", href: "/admin/orders?status=opportunity_pool" },
  { key: "claimed", label: "已承接", tone: "bg-violet-500", href: "/admin/orders?status=claimed" },
  { key: "requirement_following", label: "跟進中", tone: "bg-blue-600", href: "/admin/orders?status=requirement_following" },
  { key: "quoted", label: "已報價", tone: "bg-amber-600", href: "/admin/orders?status=quoted" },
  { key: "paid", label: "已支付", tone: "bg-emerald-600", href: "/admin/orders?status=paid" },
  { key: "delivering", label: "交付中", tone: "bg-cyan-600", href: "/admin/orders?status=delivering" },
  { key: "pending_acceptance", label: "待驗收", tone: "bg-pink-500", href: "/admin/orders?status=pending_acceptance" },
  { key: "accepted", label: "待結算", tone: "bg-orange-600", href: "/admin/orders?status=accepted" },
  { key: "settled", label: "已結算", tone: "bg-slate-600", href: "/admin/orders?status=settled" },
  { key: "rated", label: "已評價", tone: "bg-slate-400", href: "/admin/orders?status=rated" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  href: string;
  tone?: "brand" | "teal" | "violet" | "amber";
}) {
  const toneClass = {
    brand: "border-brand-200 bg-brand-50/50 text-brand-600",
    teal: "border-teal-200 bg-teal-50/60 text-teal-700",
    violet: "border-violet-200 bg-violet-50/60 text-violet-700",
    amber: "border-amber-200 bg-amber-50/60 text-amber-700",
  }[tone];

  return (
    <Link href={href} className="card card-hover block min-w-0 p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
          <Icon size={20} strokeWidth={2} />
        </span>
        <span className="text-xs font-semibold text-blue-600">查看</span>
      </div>
      <div className="mt-4">
        <div className="truncate text-sm font-semibold text-slate-500">{label}</div>
        <div className="mt-1 text-3xl font-bold text-slate-950">{value}</div>
        <div className="mt-2 truncate text-xs font-medium text-slate-500">{hint}</div>
      </div>
    </Link>
  );
}

function OrderFunnel({ pipeline }: { pipeline: DashboardData["order_pipeline"] }) {
  const maxValue = Math.max(1, ...ORDER_STAGES.map((stage) => pipeline[stage.key] ?? 0));

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp size={16} strokeWidth={2} />
            訂單狀態漏斗
          </div>
          <p className="mt-1 text-sm text-slate-500">看清每個階段的存量、瓶頸與下一步責任方。</p>
        </div>
        <Link href="/admin/orders" className="btn btn-secondary btn-sm">
          <ClipboardList size={14} strokeWidth={2} />
          全部訂單
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex h-64 min-w-[860px] items-end gap-3">
          {ORDER_STAGES.map((stage) => {
            const value = pipeline[stage.key] ?? 0;
            const height = 28 + (value / maxValue) * 156;
            return (
              <Link key={stage.key} href={stage.href} className="group flex h-full flex-1 flex-col justify-end">
                <div className="mb-2 text-center text-xs font-bold text-slate-700">{value}</div>
                <div
                  className={`w-full rounded-md ${stage.tone} transition-all group-hover:opacity-85`}
                  style={{ height }}
                  title={`${stage.label}: ${value}`}
                />
                <div className="mt-2 h-8 text-center text-xs font-medium leading-4 text-slate-500">{stage.label}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PlatformActions({ actions }: { actions: DashboardData["platform_actions"] }) {
  const rows = [
    {
      label: "審核新需求",
      value: actions.requirement_reviews,
      href: "/admin/orders?status=pending_review",
      icon: FileSearch,
      tone: "text-brand-600",
    },
    {
      label: "查看待接單",
      value: actions.claim_confirmations,
      href: "/admin/orders?status=opportunity_pool",
      icon: Handshake,
      tone: "text-violet-600",
    },
    {
      label: "標記模擬支付",
      value: actions.simulated_payments,
      href: "/admin/orders?status=pending_payment",
      icon: CreditCard,
      tone: "text-teal-700",
    },
    {
      label: "驗收後結算",
      value: actions.settlements,
      href: "/admin/orders?status=accepted",
      icon: ClipboardCheck,
      tone: "text-orange-600",
    },
  ];

  return (
    <section className="card p-5">
      <div className="text-sm font-semibold text-slate-800">今日平台動作</div>
      <div className="mt-3 space-y-2">
        {rows.map(({ label, value, href, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50"
          >
            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-600">
              <Icon className={tone} size={15} strokeWidth={2} />
              <span className="truncate">{label}</span>
            </span>
            <span className={`font-bold ${tone}`}>{value}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FulfillmentAlerts({ alerts }: { alerts: DashboardData["fulfillment_alerts"] }) {
  const rows = [
    ["待審核需求超 24h", alerts.pending_reviews_over_24h ?? 0, "/admin/orders?status=pending_review"],
    ["機會池 48h 未接單", alerts.opportunities_without_claim_48h ?? 0, "/admin/orders?status=opportunity_pool"],
    ["已承接 3d 未分配 FDE", alerts.claimed_without_fde_3d ?? 0, "/admin/orders?status=claimed"],
    ["已報價 48h 未確認", alerts.quoted_unconfirmed_48h ?? 0, "/admin/orders?status=quoted"],
    ["已驗收 24h 未結算", alerts.accepted_unsettled_24h ?? 0, "/admin/orders?status=accepted"],
  ] as const;
  const total = rows.reduce((sum, [, value]) => sum + value, 0);

  return (
    <section className="card border-orange-200 bg-orange-50/35 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
          <AlertTriangle size={16} strokeWidth={2} />
          履約異常預警
        </div>
        <span className="badge badge-orange">{total}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value, href]) => (
          <Link key={label} href={href} className="flex items-center justify-between rounded-lg px-1 py-1 hover:bg-orange-100/50">
            <span className="text-slate-700">{label}</span>
            <span className="font-bold text-orange-600">{value}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SupplyReadiness({ supply }: { supply: DashboardData["supply_readiness"] }) {
  const rows = [
    { label: "已通過咨詢公司", value: supply.approved_companies, href: "/admin/companies?status=approved", icon: Building2 },
    { label: "有 FDE 的公司", value: supply.companies_with_lobster_knights, href: "/admin/companies?status=approved", icon: Users },
    { label: "待處理加入申請", value: supply.pending_join_requests, href: "/admin/companies", icon: ClipboardCheck },
  ];

  return (
    <section className="card p-5">
      <div className="text-sm font-semibold text-slate-800">供給側準備度</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Icon size={15} strokeWidth={2} />
              {label}
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CommunityHealth({ data }: { data: DashboardData }) {
  const totalNew = data.today_new_questions + data.today_new_answers + data.today_new_tutorials;

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <MessageSquare size={16} strokeWidth={2} />
        社區健康度
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">今日內容新增</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{totalNew}</div>
        </div>
        <Link href="/admin/moderation?target_type=tutorial" className="rounded-lg bg-slate-50 p-4 hover:bg-slate-100">
          <div className="text-xs font-semibold text-slate-500">待審核教程</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{data.pending_tutorials}</div>
        </Link>
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">近 7 日活躍騎士</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{data.active_knights_7d}</div>
        </div>
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const topStats = useMemo(() => {
    if (!data) return [];
    return [
      {
        icon: FileSearch,
        label: "待審核需求",
        value: data.order_pipeline.pending_review ?? 0,
        hint: `超 24h ${data.fulfillment_alerts.pending_reviews_over_24h ?? 0} 個`,
        href: "/admin/orders?status=pending_review",
        tone: "brand" as const,
      },
      {
        icon: Handshake,
        label: "機會池待承接",
        value: data.order_pipeline.opportunity_pool ?? 0,
        hint: "等待咨詢公司接單",
        href: "/admin/orders?status=opportunity_pool",
        tone: "teal" as const,
      },
      {
        icon: ClipboardCheck,
        label: "已接單待跟進",
        value: data.order_pipeline.claimed ?? 0,
        hint: "等待公司分配龍蝦騎士",
        href: "/admin/orders?status=claimed",
        tone: "violet" as const,
      },
      {
        icon: CreditCard,
        label: "待支付 / 待結算",
        value: data.platform_actions.simulated_payments + data.platform_actions.settlements,
        hint: `待支付 ${data.platform_actions.simulated_payments} · 待結算 ${data.platform_actions.settlements}`,
        href: "/admin/orders?status=pending_payment",
        tone: "amber" as const,
      },
    ];
  }, [data]);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400">加载中...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">履約運營總覽</h1>
          <p className="mt-1 text-sm text-slate-500">企業需求到交付評價的閉環監控。</p>
        </div>
        <Link href="/admin/orders" className="btn btn-primary">
          <ClipboardList size={16} strokeWidth={2} />
          處理需求訂單
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-3">
        <div className="min-w-0 2xl:col-span-2">
          <OrderFunnel pipeline={data.order_pipeline} />
        </div>
        <div className="min-w-0 space-y-4">
          <PlatformActions actions={data.platform_actions} />
          <FulfillmentAlerts alerts={data.fulfillment_alerts} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SupplyReadiness supply={data.supply_readiness} />
        <CommunityHealth data={data} />
      </div>

      <section className="card border-teal-200 bg-teal-50/35 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 text-teal-700" size={18} strokeWidth={2} />
          <div>
            <div className="text-sm font-semibold text-teal-900">判斷標準</div>
            <p className="mt-1 text-sm leading-6 text-teal-800">
              首頁優先看需求是否被審核、是否進入機會池、是否被咨詢公司承接，以及 FDE 交付、驗收、結算、評價是否順利沉澱。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
