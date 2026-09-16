"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ClipboardList,
  Coins,
  FileText,
  Handshake,
  Mail,
  PackageCheck,
  UserRound,
} from "lucide-react";

import RequireAuth from "@/components/RequireAuth";
import { getCompany, getOrder, updateOrderWorkStatus } from "@/lib/api";
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

const STATUS_META: Record<string, { tone: string; stage: string; hint: string }> = {
  draft: {
    tone: "bg-slate-100 text-slate-600",
    stage: "準備中",
    hint: "需求還在草稿狀態，提交後才會進入平台審核。",
  },
  pending_review: {
    tone: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    stage: "平台審核",
    hint: "平台正在確認需求是否足夠清楚，通過後會進入機會池。",
  },
  review_rejected: {
    tone: "bg-red-50 text-red-700 ring-1 ring-red-100",
    stage: "需補充",
    hint: "平台認為需求需要補充，請根據審核備註重新整理。",
  },
  opportunity_pool: {
    tone: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    stage: "招募承接方",
    hint: "需求已進入機會池，等待咨詢公司接單。",
  },
  claimed: {
    tone: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
    stage: "承接確認",
    hint: "平台已確認承接公司，下一步會分配龍蝦騎士跟進。",
  },
  requirement_following: {
    tone: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
    stage: "需求跟進",
    hint: "承接方正在細化方案與交付範圍。",
  },
  quoted: {
    tone: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
    stage: "報價確認",
    hint: "承接方已報價，等待需求方確認。",
  },
  pending_payment: {
    tone: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
    stage: "待支付",
    hint: "報價已確認，等待支付完成後進入交付。",
  },
  paid: {
    tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    stage: "交付中",
    hint: "支付已確認，承接方正在交付。",
  },
  pending_acceptance: {
    tone: "bg-purple-50 text-purple-700 ring-1 ring-purple-100",
    stage: "待驗收",
    hint: "交付物已提交，等待需求方驗收。",
  },
  accepted: {
    tone: "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
    stage: "待結算",
    hint: "需求方已驗收，等待平台結算。",
  },
  settled: {
    tone: "bg-slate-900 text-white",
    stage: "已完成",
    hint: "訂單已完成結算。",
  },
  rated: {
    tone: "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
    stage: "已評價",
    hint: "訂單已完成評價，可沉澱為交付案例。",
  },
};

const COMPLETED_ORDER_STATUSES = new Set(["accepted", "settled", "rated"]);

function orderWorkStatus(status: string): "following" | "completed" {
  return COMPLETED_ORDER_STATUSES.has(status) ? "completed" : "following";
}

function formatDate(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatBudget(value: number) {
  if (!value) return "待議";
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function DetailBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4 text-base font-bold text-slate-950">
        <span className="text-brand-600">{icon}</span>
        {title}
      </div>
      <div className="mt-4 text-sm leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [order, setOrder] = useState<DemandOrderOut | null>(null);
  const [claimedCompanyName, setClaimedCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("需求 ID 不正確");
      setLoading(false);
      return;
    }
    getOrder(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setClaimedCompanyName("");

    if (!order?.claimed_company_id) return;
    if (order.claimed_company_name) {
      setClaimedCompanyName(order.claimed_company_name);
      return;
    }

    getCompany(order.claimed_company_id)
      .then((company) => {
        if (!cancelled) setClaimedCompanyName(company.name);
      })
      .catch(() => {
        if (!cancelled) setClaimedCompanyName("");
      });

    return () => {
      cancelled = true;
    };
  }, [order?.claimed_company_id, order?.claimed_company_name]);

  const meta = order
    ? STATUS_META[order.status] ?? {
        tone: "bg-slate-100 text-slate-600",
        stage: "流程中",
        hint: "需求正在流程中。",
      }
    : null;
  const workStatus = order ? orderWorkStatus(order.status) : "following";

  async function handleWorkStatusChange(value: "following" | "completed") {
    if (!order || value === workStatus || statusBusy) return;
    setStatusBusy(true);
    setStatusError("");
    try {
      const nextOrder = await updateOrderWorkStatus(order.id, value);
      setOrder(nextOrder);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "更新訂單狀態失敗");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <RequireAuth>
      <main className="bg-slate-50/60 pb-16">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
            <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600">
              <ArrowLeft size={16} strokeWidth={2} />
              返回需求工作台
            </Link>

            {loading ? (
              <div className="mt-8 text-sm text-slate-500">載入需求詳情...</div>
            ) : error || !order ? (
              <div className="mt-8 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                {error || "需求不存在"}
              </div>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta?.tone}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <span className="text-xs font-medium text-slate-400">{meta?.stage}</span>
                  </div>
                  <h1 className="mt-4 break-words text-3xl font-bold tracking-tight text-slate-950">
                    {order.title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    {order.description || order.business_background || "尚未補充需求說明"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">當前狀態</div>
                  <div className="mt-2 text-sm font-bold text-slate-950">{meta?.stage}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{meta?.hint}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {!loading && !error && order && (
          <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-10">
            <div className="space-y-5">
              <DetailBlock title="需求說明" icon={<FileText size={18} strokeWidth={2.3} />}>
                {order.description || "尚未補充需求說明"}
              </DetailBlock>

              <DetailBlock title="業務背景" icon={<Building2 size={18} strokeWidth={2.3} />}>
                {order.business_background || "尚未補充業務背景"}
              </DetailBlock>

              <DetailBlock title="交付物期望" icon={<PackageCheck size={18} strokeWidth={2.3} />}>
                {order.deliverable_expectation || "尚未補充交付物期望"}
              </DetailBlock>

              {order.review_note && (
                <DetailBlock title="平台備註" icon={<ClipboardList size={18} strokeWidth={2.3} />}>
                  {order.review_note}
                </DetailBlock>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <Handshake size={17} strokeWidth={2.2} className="text-brand-600" />
                  <h2 className="text-base font-bold text-slate-950">承接方</h2>
                </div>
                {order.claimed_company_id ? (
                  <div className="mt-4 rounded-lg bg-brand-50 p-4">
                    <div className="text-xs font-medium text-brand-600">已接單咨詢公司</div>
                    <div className="mt-1 break-words text-lg font-bold text-slate-950">
                      {claimedCompanyName || `咨詢公司 #${order.claimed_company_id}`}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      該公司已承接此需求，後續報價、交付和驗收會在這個需求流程中推進。
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-950">尚未被承接</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      咨詢公司接單後，這裡會顯示承接的咨詢公司。
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-slate-950">需求信息</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{order.enterprise_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{order.product_name || "未標產品"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coins size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{formatBudget(order.budget_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{formatDate(order.expected_delivery_at)}</span>
                  </div>
                  <div className="space-y-2 pt-2">
                    <label htmlFor="order-work-status" className="block text-xs font-semibold text-slate-400">
                      訂單狀態
                    </label>
                    <select
                      id="order-work-status"
                      value={workStatus}
                      disabled={statusBusy}
                      onChange={(event) => handleWorkStatusChange(event.target.value as "following" | "completed")}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="following">跟進中</option>
                      <option value="completed">已完成</option>
                    </select>
                    {statusError && <p className="text-xs leading-5 text-red-600">{statusError}</p>}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-base font-bold text-slate-950">聯繫方式</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <UserRound size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{order.contact_name || "未填寫"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={16} strokeWidth={2} className="text-slate-400" />
                    <span>{order.contact_email || "未填寫"}</span>
                  </div>
                </div>
              </section>

              <Link href="/orders" className="btn btn-secondary w-full">
                返回需求列表
              </Link>
            </aside>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}
