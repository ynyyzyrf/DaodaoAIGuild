"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock3, ExternalLink, FilePenLine, RotateCcw, XCircle } from "lucide-react";

import {
  type AdminCompanyStatus,
  listAdminCompanies,
  reviewAdminCompany,
} from "@/lib/admin-api";
import type { CompanyOut } from "@/lib/types";

const STATUS_TABS: { key: AdminCompanyStatus | "all"; label: string }[] = [
  { key: "pending", label: "待審核" },
  { key: "requires_changes", label: "需修改" },
  { key: "approved", label: "已通過" },
  { key: "rejected", label: "已拒絕" },
  { key: "draft", label: "草稿" },
  { key: "all", label: "全部" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending: "待審核",
  requires_changes: "需修改",
  approved: "已通過",
  rejected: "已拒絕",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-700",
  requires_changes: "bg-orange-50 text-orange-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

export default function AdminCompaniesPage() {
  const [status, setStatus] = useState<AdminCompanyStatus | "all">("pending");
  const [items, setItems] = useState<CompanyOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminCompanies({
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

  async function handleReview(company: CompanyOut, nextStatus: "requires_changes" | "approved" | "rejected") {
    const reason =
      nextStatus === "approved"
        ? "資料完整，平台審核通過"
        : nextStatus === "requires_changes"
          ? "資料需要補充後重新提交"
          : "公司入駐申請未通過";
    setBusyKey(`${company.id}-${nextStatus}`);
    setError("");
    setMessage("");
    try {
      await reviewAdminCompany(company.id, nextStatus, reason);
      await load();
      setMessage(`「${company.name}」已更新為：${STATUS_LABEL[nextStatus]}`);
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
          <h1 className="text-2xl font-bold text-slate-900">咨詢公司管理</h1>
          <p className="mt-1 text-sm text-slate-500">處理公司入駐、審核狀態與公司資料管理。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/companies" className="btn btn-secondary btn-sm">
            <Building2 size={14} strokeWidth={2} />
            公司名錄
          </Link>
          <Link href="/companies/new" className="btn btn-primary btn-sm">
            <FilePenLine size={14} strokeWidth={2} />
            入駐資料
          </Link>
        </div>
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
            審核隊列
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{total}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">載入中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">暫無公司資料</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((company) => (
              <article key={company.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{company.name}</h2>
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_CLASS[company.status] ?? STATUS_CLASS.draft}`}>
                      {STATUS_LABEL[company.status] ?? company.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {company.description || company.strengths || "暫未填寫公司介紹。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>申請人 ID：{company.applicant_id}</span>
                    <span>聯絡人：{company.contact_name || "未填寫"}</span>
                    <span>郵箱：{company.contact_email || "未填寫"}</span>
                    {company.review_note && <span>審核備註：{company.review_note}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {company.status === "approved" && (
                    <Link href={`/companies/${company.id}`} className="btn btn-secondary btn-sm">
                      <ExternalLink size={14} strokeWidth={2} />
                      公開頁
                    </Link>
                  )}
                  {(company.status === "pending" || company.status === "requires_changes") && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReview(company, "approved")}
                        disabled={busyKey === `${company.id}-approved`}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 size={14} strokeWidth={2.2} />
                        通過
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(company, "requires_changes")}
                        disabled={busyKey === `${company.id}-requires_changes`}
                        className="btn btn-secondary btn-sm"
                      >
                        <RotateCcw size={14} strokeWidth={2.2} />
                        打回修改
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(company, "rejected")}
                        disabled={busyKey === `${company.id}-rejected`}
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
