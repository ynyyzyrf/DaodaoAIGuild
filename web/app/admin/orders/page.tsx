"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, CreditCard, RotateCcw, Search, XCircle } from "lucide-react";

import { listAdminOrders, reviewAdminOrder, settleAdminOrder, simulateAdminOrderPayment } from "@/lib/admin-api";
import type { DemandOrderOut } from "@/lib/types";

const STATUS_TABS = [
  { key: "pending_review", label: "待審核" },
  { key: "opportunity_pool", label: "機會池" },
  { key: "claimed", label: "已承接" },
  { key: "pending_payment", label: "待支付" },
  { key: "accepted", label: "待結算" },
  { key: "settled", label: "已結算" },
  { key: "all", label: "全部" },
];

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

export default function AdminOrdersPage() {
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState<DemandOrderOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminOrders({
        page_size: 50,
        status: nextStatus === "all" ? undefined : nextStatus,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // load closes over status intentionally through this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">需求訂單</h1>
        <p className="mt-1 text-sm text-slate-500">審核企業需求、查看機會池狀態、處理模擬支付與 MVP 結算。</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              status === tab.key
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {message && <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ClipboardList size={17} strokeWidth={2} />
            訂單隊列
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{total}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">載入中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">暫無需求訂單</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((order) => (
              <article key={order.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{order.title}</h2>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {order.description || order.business_background || "暫無需求描述。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>企業：{order.enterprise_name}</span>
                    <span>產品：{order.product_name || "未填寫"}</span>
                    <span>預算：{order.budget_amount || 0}</span>
                    {order.claimed_company_id && <span>承接公司 ID：{order.claimed_company_id}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {order.status === "pending_review" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            `${order.id}-approve`,
                            () => reviewAdminOrder(order.id, "approved", "需求完整，进入机会池"),
                            "需求已进入机会池。",
                          )
                        }
                        disabled={busyKey === `${order.id}-approve`}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 size={14} strokeWidth={2.2} />
                        通過
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            `${order.id}-reject`,
                            () => reviewAdminOrder(order.id, "rejected", "需求需要补充后重新提交"),
                            "需求已駁回。",
                          )
                        }
                        disabled={busyKey === `${order.id}-reject`}
                        className="btn btn-secondary btn-sm text-red-600 hover:border-red-200 hover:bg-red-50"
                      >
                        <XCircle size={14} strokeWidth={2.2} />
                        駁回
                      </button>
                    </>
                  )}
                  {order.status === "pending_payment" && (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          `${order.id}-pay`,
                          () => simulateAdminOrderPayment(order.id, "模拟支付确认"),
                          "已標記模擬支付成功。",
                        )
                      }
                      disabled={busyKey === `${order.id}-pay`}
                      className="btn btn-primary btn-sm"
                    >
                      <CreditCard size={14} strokeWidth={2.2} />
                      標記支付
                    </button>
                  )}
                  {order.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          `${order.id}-settle`,
                          () => settleAdminOrder(order.id, "MVP 结算完成，不做分账"),
                          "已標記結算。",
                        )
                      }
                      disabled={busyKey === `${order.id}-settle`}
                      className="btn btn-primary btn-sm"
                    >
                      <RotateCcw size={14} strokeWidth={2.2} />
                      標記結算
                    </button>
                  )}
                  {order.status === "opportunity_pool" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      <Search size={13} strokeWidth={2} />
                      等待咨詢公司申請
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
