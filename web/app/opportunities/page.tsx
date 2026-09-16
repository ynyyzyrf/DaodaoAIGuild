"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarClock, Coins, FileText, Search, Send, Sparkles, UsersRound } from "lucide-react";

import { ChannelHero, ChannelSearch, ChannelToolbar } from "@/components/ChannelShell";
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

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function isRecent(value: string) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000;
}

export default function OpportunitiesPage() {
  const [mounted, setMounted] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [items, setItems] = useState<DemandOrderOut[]>([]);
  const [managedCompanies, setManagedCompanies] = useState<CompanyOut[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState("");
  const [keyword, setKeyword] = useState("");
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

  const selectedCompany = managedCompanies.find((company) => company.id === selectedCompanyId);

  const products = useMemo(
    () => Array.from(new Set(items.map((item) => item.product_name).filter(Boolean))),
    [items],
  );

  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const matchesProduct = !activeProduct || item.product_name === activeProduct;
      const text = `${item.title} ${item.description} ${item.business_background} ${item.enterprise_name} ${item.product_name}`.toLowerCase();
      const matchesKeyword = !kw || text.includes(kw);
      return matchesProduct && matchesKeyword;
    });
  }, [items, activeProduct, keyword]);

  const metrics = [
    { label: "開放需求", value: formatCount(items.length), icon: Sparkles },
    { label: "近 7 日新增", value: formatCount(items.filter((item) => isRecent(item.created_at)).length), icon: CalendarClock },
    { label: "有預算需求", value: formatCount(items.filter((item) => item.budget_amount > 0).length), icon: Coins },
    { label: "可代表公司", value: formatCount(managedCompanies.length), icon: Building2 },
  ];

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
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">載入機會池...</div>
        </section>
      </main>
    );
  }

  if (!hasUser) {
    return (
      <main className="bg-[#f6f8fb] pb-16">
        <ChannelHero
          title="機會池"
          subtitle="機會池是已審核企業需求的承接入口。登入後可查看可承接機會。"
          image="/banners/banner-3.png?v=20260828"
          note={
            <>
              <p className="text-sm font-black text-[#35120d]">登入後查看真實機會。</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">這裡不展示未授權需求，也不使用假需求填充列表。</p>
              <Link href="/login" className="btn btn-primary mt-4 h-10">
                登入查看
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            </>
          }
        />
      </main>
    );
  }

  return (
    <main className="bg-[#f6f8fb] pb-16">
      <ChannelHero
        title="機會池"
        subtitle="已通過平台審核的企業需求會進入機會池。咨詢公司可代表自身承接，後續進入報價與交付。"
        image="/banners/banner-3.png?v=20260828"
        metrics={metrics}
      >
        <ChannelSearch
          icon={Search}
          value={keyword}
          onChange={setKeyword}
          placeholder="搜尋需求標題、企業、產品或背景..."
        />
      </ChannelHero>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        {error && <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        {message && <div className="mb-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        <ChannelToolbar>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">可承接需求</h2>
            <span className="text-sm font-medium text-slate-400">{formatCount(filteredItems.length)} 個結果</span>
            {products.length > 0 && (
              <div className="ml-0 flex flex-wrap gap-1.5 lg:ml-3">
                <button onClick={() => setActiveProduct("")} className={`chip ${activeProduct === "" ? "chip-active" : "chip-idle"}`}>
                  全部
                </button>
                {products.map((product) => (
                  <button
                    key={product}
                    onClick={() => setActiveProduct(product)}
                    className={`chip ${activeProduct === product ? "chip-active" : "chip-idle"}`}
                  >
                    {product}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm font-medium text-slate-400">按審核通過後的機會池資料展示</div>
        </ChannelToolbar>

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
            {filteredItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10">
                <div className="mx-auto max-w-xl text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Sparkles size={20} strokeWidth={2.4} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">暫無開放機會</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    當企業需求完成平台審核後，會出現在這裡。沒有真實需求時，不使用示例需求填充。
                  </p>
                </div>
              </div>
            ) : (
              filteredItems.map((order) => (
                <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                          開放承接
                        </span>
                        {order.product_name && <span className="text-xs font-medium text-slate-400">{order.product_name}</span>}
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{order.title}</h3>
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
