"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CalendarClock, Coins, Send, Sparkles, UsersRound } from "lucide-react";

import { createOrderClaim, getMyCompanyState, listOpportunities } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { CompanyOut, DemandOrderOut } from "@/lib/types";

function formatDate(value: string | null) {
  if (!value) return "時間可協商";
  return new Intl.DateTimeFormat("zh-Hant", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatBudget(value: number) {
  if (!value) return "預算待議";
  return `預算 ${new Intl.NumberFormat("zh-Hant").format(value)}`;
}

export default function OpportunitiesPage() {
  const [mounted, setMounted] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [items, setItems] = useState<DemandOrderOut[]>([]);
  const [managedCompanies, setManagedCompanies] = useState<CompanyOut[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [opportunities, state] = await Promise.all([listOpportunities({ page_size: 50 }), getMyCompanyState()]);
      setItems(opportunities.items);
      setManagedCompanies(state.managed_companies);
      setSelectedCompanyId(state.managed_companies[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const user = getCurrentUser();
    setHasUser(Boolean(user));
    if (!user) {
      setLoading(false);
      return;
    }
    load();
    // load is only needed on first authenticated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClaim(order: DemandOrderOut) {
    if (!selectedCompanyId) return;
    setBusyOrderId(order.id);
    setError("");
    setMessage("");
    try {
      await createOrderClaim(order.id, selectedCompanyId, "");
      setMessage(`已代表 ${selectedCompany?.name ?? "咨詢公司"} 接單成功：「${order.title}」。`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyOrderId(null);
    }
  }

  if (!mounted) {
    return (
      <main className="bg-slate-50/60 pb-16">
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">載入機會池...</div>
        </section>
      </main>
    );
  }

  if (!hasUser) {
    return (
      <main className="bg-slate-50/60 pb-16">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6 lg:px-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles size={22} strokeWidth={2.4} />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">FDE 機會池</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              登入後可查看通過平台審核的企業需求，代表已入駐咨詢公司直接接單。
            </p>
            <Link href="/login" className="btn btn-primary mt-6">
              登入查看機會
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const selectedCompany = managedCompanies.find((company) => company.id === selectedCompanyId);

  return (
    <main className="bg-slate-50/60 pb-16">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">
              <Sparkles size={16} strokeWidth={2} />
              FDE 機會池
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">挑選值得投入的企業需求</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              這裡只展示已通過平台審核的需求。咨詢公司點擊接單後，需求會直接進入已承接狀態。
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">當前代表</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200">
                <Building2 size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-950">{selectedCompany?.name ?? "尚無可代表公司"}</div>
                <div className="mt-0.5 text-xs text-slate-500">{managedCompanies.length} 家可操作咨詢公司</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        {managedCompanies.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {managedCompanies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => setSelectedCompanyId(company.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  selectedCompanyId === company.id
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {company.name}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        {message && <div className="mb-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-950">可承接需求</h2>
          <span className="text-xs font-medium text-slate-400">{items.length} 個開放機會</span>
        </div>

        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">同步最新機會...</div>
        )}

        {!loading && managedCompanies.length === 0 && (
          <div className="mb-6 rounded-lg border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <UsersRound className="mt-0.5 text-amber-700" size={18} strokeWidth={2.2} />
              <div>
                <h3 className="text-sm font-bold text-amber-900">你目前還不能接單</h3>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  需要先成為已入駐咨詢公司的 Owner / Admin，才能代表公司承接機會池需求。
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <section className="grid gap-4">
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Sparkles size={20} strokeWidth={2.4} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">暫無開放機會</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    當企業需求完成平台審核後，會出現在這裡。你可以先完善公司 Profile，讓後續承接更有說服力。
                  </p>
                </div>
              </div>
            ) : (
              items.map((order) => (
                <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                          開放承接
                        </span>
                        <span className="text-xs font-medium text-slate-400">{order.product_name || "未標產品"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-slate-950">{order.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                        {order.description || order.business_background || "企業尚未補充詳細描述"}
                      </p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
                        <span className="inline-flex items-center gap-2">
                          <Building2 size={15} strokeWidth={2} />
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
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedCompanyId || busyOrderId === order.id}
                      onClick={() => handleClaim(order)}
                      className="btn btn-primary h-10 shrink-0 px-4"
                    >
                      {selectedCompanyId ? <Send size={14} strokeWidth={2.3} /> : <Building2 size={14} strokeWidth={2.3} />}
                      {busyOrderId === order.id ? "接單中..." : "直接接單"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </section>
    </main>
  );
}
