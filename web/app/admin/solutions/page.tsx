"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, XCircle } from "lucide-react";

import {
  type AdminSolutionStatus,
  listAdminSolutions,
  reviewAdminSolution,
} from "@/lib/admin-api";
import { formatSolutionCoinPrice } from "@/lib/solution-price";
import type { EnterpriseSolutionOut } from "@/lib/types";

const STATUS_TABS: { key: AdminSolutionStatus | "all"; label: string }[] = [
  { key: "pending", label: "待審核" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已拒絕" },
  { key: "draft", label: "草稿" },
  { key: "all", label: "全部" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending: "待審核",
  approved: "已通過",
  rejected: "已拒絕",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

export default function AdminSolutionsPage() {
  const [status, setStatus] = useState<AdminSolutionStatus | "all">("pending");
  const [items, setItems] = useState<EnterpriseSolutionOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminSolutions({
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

  async function handleReview(solution: EnterpriseSolutionOut, nextStatus: "approved" | "rejected") {
    const reason = nextStatus === "approved" ? "方案案例完整，允许上架首页" : "方案信息不足，暂不展示";
    setBusyKey(`${solution.id}-${nextStatus}`);
    setError("");
    setMessage("");
    try {
      await reviewAdminSolution(solution.id, nextStatus, reason);
      await load();
      setMessage(`「${solution.title}」已更新為：${STATUS_LABEL[nextStatus]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">企業方案審核</h1>
          <p className="mt-1 text-sm text-slate-500">審核咨詢公司提交的標準方案，通過後展示到首頁與企業方案頁。</p>
        </div>
        <a href="/fde" className="btn btn-secondary btn-sm">
          <ExternalLink size={14} strokeWidth={2} />
          前台方案頁
        </a>
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
            <Clock3 size={17} strokeWidth={2} />
            方案隊列
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{total}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">載入中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">暫無企業方案</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((solution) => (
              <article key={solution.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{solution.title}</h2>
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_CLASS[solution.status] ?? STATUS_CLASS.draft}`}>
                      {STATUS_LABEL[solution.status] ?? solution.status}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                      {solution.company_name || `公司 #${solution.company_id}`}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {solution.subtitle || "暫未填寫方案描述。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>分類：{solution.category || "未填寫"}</span>
                    <span>行業：{solution.industry || "未填寫"}</span>
                    <span>場景：{solution.scenario || "未填寫"}</span>
                    <span>Coin 價格：{formatSolutionCoinPrice(solution.budget_range)}</span>
                    {solution.review_note && <span>審核備註：{solution.review_note}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {solution.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReview(solution, "approved")}
                        disabled={busyKey === `${solution.id}-approved`}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 size={14} strokeWidth={2.2} />
                        通過上架
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(solution, "rejected")}
                        disabled={busyKey === `${solution.id}-rejected`}
                        className="btn btn-secondary btn-sm text-red-600 hover:border-red-200 hover:bg-red-50"
                      >
                        <XCircle size={14} strokeWidth={2.2} />
                        拒絕
                      </button>
                    </>
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
