"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, ClipboardList, Clock3, Coins, Handshake, SearchCheck } from "lucide-react";

import { listMyOrders } from "@/lib/api";
import type { DemandOrderOut } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending_review: "待審核",
  review_rejected: "審核駁回",
  opportunity_pool: "機會池",
  claimed: "已確認承接方",
  requirement_following: "需求跟進中",
  quoted: "已報價",
  pending_payment: "待支付",
  paid: "已支付",
  pending_acceptance: "待驗收",
  accepted: "已驗收",
  settled: "已結算",
  rated: "已評價",
};

const STATUS_META: Record<string, { tone: string; stage: string }> = {
  draft: { tone: "bg-slate-100 text-slate-600", stage: "準備中" },
  pending_review: { tone: "bg-amber-50 text-amber-700 ring-1 ring-amber-100", stage: "平台審核" },
  review_rejected: { tone: "bg-red-50 text-red-700 ring-1 ring-red-100", stage: "需補充" },
  opportunity_pool: { tone: "bg-sky-50 text-sky-700 ring-1 ring-sky-100", stage: "招募承接方" },
  claimed: { tone: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100", stage: "承接確認" },
  requirement_following: { tone: "bg-violet-50 text-violet-700 ring-1 ring-violet-100", stage: "需求跟進" },
  quoted: { tone: "bg-blue-50 text-blue-700 ring-1 ring-blue-100", stage: "報價確認" },
  pending_payment: { tone: "bg-orange-50 text-orange-700 ring-1 ring-orange-100", stage: "待支付" },
  paid: { tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", stage: "交付中" },
  pending_acceptance: { tone: "bg-purple-50 text-purple-700 ring-1 ring-purple-100", stage: "待驗收" },
  accepted: { tone: "bg-teal-50 text-teal-700 ring-1 ring-teal-100", stage: "待結算" },
  settled: { tone: "bg-slate-900 text-white", stage: "已完成" },
  rated: { tone: "bg-brand-50 text-brand-700 ring-1 ring-brand-100", stage: "已評價" },
};

function formatDate(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("zh-Hant", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatBudget(value: number) {
  if (!value) return "待議";
  return new Intl.NumberFormat("zh-Hant").format(value);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<DemandOrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyOrders({ page_size: 50 })
      .then((data) => setOrders(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = orders.filter((order) => !["settled", "rated", "review_rejected"].includes(order.status)).length;
  const waitingCount = orders.filter((order) => ["pending_review", "pending_payment", "pending_acceptance"].includes(order.status)).length;
  const completedCount = orders.filter((order) => ["settled", "rated"].includes(order.status)).length;

  return (
    <main className="bg-slate-50/60 pb-16">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">
              <ClipboardList size={16} strokeWidth={2} />
              企業需求工作台
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">把需求交給 FDE 社區推進</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              從提交、審核、承接、報價到交付驗收，所有企業需求都在這裡看狀態和下一步。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>進行中</span>
              <Clock3 size={16} strokeWidth={2} />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{activeCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>待你處理</span>
              <SearchCheck size={16} strokeWidth={2} />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{waitingCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>已完成</span>
              <ClipboardList size={16} strokeWidth={2} />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{completedCount}</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">需求列表</h2>
            <span className="text-xs font-medium text-slate-400">{orders.length} 個需求</span>
          </div>

          {loading && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">載入需求狀態...</div>
          )}
          {error && <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

          {!loading && !error && (
            <section className="grid gap-4">
              {orders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10">
                  <div className="mx-auto max-w-xl text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <ClipboardList size={20} strokeWidth={2.4} />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">還沒有企業需求</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      企業需求進入流程後，會在這裡同步顯示審核、承接、報價和交付狀態。
                    </p>
                  </div>
                </div>
              ) : (
                orders.map((order) => {
                  const meta = STATUS_META[order.status] ?? { tone: "bg-slate-100 text-slate-600", stage: "流程中" };
                  return (
                    <article
                      key={order.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                              {STATUS_LABEL[order.status] ?? order.status}
                            </span>
                            <span className="text-xs font-medium text-slate-400">{meta.stage}</span>
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-slate-950">{order.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {order.description || order.business_background || "尚未補充需求說明"}
                          </p>
                          <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                            <span className="inline-flex items-center gap-2">
                              <ClipboardList size={15} strokeWidth={2} />
                              {order.enterprise_name}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Coins size={15} strokeWidth={2} />
                              {formatBudget(order.budget_amount)}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <CalendarClock size={15} strokeWidth={2} />
                              {formatDate(order.expected_delivery_at)}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <Handshake size={15} strokeWidth={2} />
                              <span className="truncate">
                                {order.claimed_company_id
                                  ? order.claimed_company_name || `咨詢公司 #${order.claimed_company_id}`
                                  : "尚未被承接"}
                              </span>
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`/orders/${order.id}`}
                          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                        >
                          查看詳情
                          <ArrowRight size={15} strokeWidth={2.4} />
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
