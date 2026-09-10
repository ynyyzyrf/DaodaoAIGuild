"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarClock,
  Coins,
  FileText,
  Sparkles,
  X,
} from "lucide-react";

import RequireAuth from "@/components/RequireAuth";
import { createOrder, listPmDesktopProducts, submitOrder } from "@/lib/api";
import type { PmDesktopProductOut } from "@/lib/types";

const mockCases = [
  {
    title: "客服知識庫 Agent",
    company: "跨境電商團隊",
    outcome: "300+ FAQ → 可檢索 AI 客服",
    result: "把客服 FAQ 和工單 SOP 整理成可查詢、可追問、可接入前台的客服助手。",
    tags: ["知識庫", "客服", "RAG"],
  },
  {
    title: "銷售線索清洗工作流",
    company: "B2B SaaS",
    outcome: "線索池 → 自動分級跟進",
    result: "自動歸類線索來源、補全公司背景，為銷售團隊生成跟進優先級。",
    tags: ["CRM", "自動化", "銷售"],
  },
  {
    title: "週報影片生成助手",
    company: "產品運營組",
    outcome: "週報素材 → 標準化影片流程",
    result: "把週報材料轉成腳本、分鏡和可複用的影片生成工作流。",
    tags: ["內容", "影片", "流程"],
  },
];

const quickScenes = ["知識庫 Agent", "流程自動化", "數據分析", "內容生成"];

export default function NewOrderPage() {
  const router = useRouter();
  const [quickPrompt, setQuickPrompt] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [enterpriseName, setEnterpriseName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [productName, setProductName] = useState("");
  const [pmDesktopProductId, setPmDesktopProductId] = useState("");
  const [pmDesktopProducts, setPmDesktopProducts] = useState<PmDesktopProductOut[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [budgetAmount, setBudgetAmount] = useState(0);
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [description, setDescription] = useState("");
  const [businessBackground, setBusinessBackground] = useState("");
  const [deliverableExpectation, setDeliverableExpectation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const readyScore = useMemo(() => {
    return [title, enterpriseName, description, businessBackground, deliverableExpectation].filter((value) => value.trim()).length;
  }, [businessBackground, deliverableExpectation, description, enterpriseName, title]);

  useEffect(() => {
    let alive = true;
    setProductsLoading(true);
    listPmDesktopProducts()
      .then((data) => {
        if (!alive) return;
        setPmDesktopProducts(data.items);
        setProductsError("");
      })
      .catch((err) => {
        if (!alive) return;
        setProductsError(err instanceof Error ? err.message : "產品列表讀取失敗");
      })
      .finally(() => {
        if (alive) setProductsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function handleProductChange(productId: string) {
    setPmDesktopProductId(productId);
    const selectedProduct = pmDesktopProducts.find((item) => item.id === productId);
    setProductName(selectedProduct?.name ?? "");
  }

  function openFormFromPrompt() {
    const prompt = quickPrompt.trim();
    if (prompt) {
      if (!title.trim()) setTitle(prompt.slice(0, 80));
      if (!description.trim()) setDescription(prompt);
    }
    setFormOpen(true);
  }

  function applyQuickScene(scene: string) {
    setQuickPrompt((current) => {
      const trimmed = current.trim();
      if (!trimmed) return `我想做一個${scene}方案，用來`;
      return trimmed.includes(scene) ? current : `${trimmed} ${scene}`;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const order = await createOrder({
        title,
        enterprise_name: enterpriseName,
        contact_name: contactName,
        contact_email: contactEmail,
        product_name: productName,
        pmdesktop_product_id: pmDesktopProductId,
        budget_amount: budgetAmount,
        expected_delivery_at: expectedDeliveryAt ? `${expectedDeliveryAt}T00:00:00` : null,
        description,
        business_background: businessBackground,
        deliverable_expectation: deliverableExpectation,
      });
      await submitOrder(order.id);
      router.push("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <main className="min-h-[calc(100vh-5.5rem)] bg-[#f8f8f6] px-4 py-8 text-slate-950 sm:px-6 sm:py-9 lg:px-10">
        <section className="relative mx-auto flex max-w-4xl flex-col items-center overflow-hidden rounded-[2rem] px-4 py-8 text-center sm:py-11">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgba(197,87,60,0.09),transparent_34%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[length:auto,44px_44px,44px_44px]" />
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
            <Sparkles size={15} strokeWidth={2.2} />
            提交企業需求
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            描述你的需求，我們幫你找到合適的 AI 解決方案
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            從需求梳理、方案匹配到交付落地，一句話開始。
          </p>

          <div className="mt-7 w-full rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_20px_56px_rgba(15,23,42,0.07)]">
            <textarea
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              onFocus={() => setFormOpen(true)}
              rows={3}
              className="min-h-20 w-full resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-[15px] leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none"
              placeholder="例如：我想把公司客服 FAQ 做成一個可被 Agent 調用的知識庫..."
            />
            <div className="flex flex-col gap-3 border-t border-slate-100 px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {quickScenes.map((scene) => (
                  <button
                    key={scene}
                    type="button"
                    onClick={() => applyQuickScene(scene)}
                    className="rounded-full bg-brand-50/70 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-100 transition-colors hover:bg-brand-100/70"
                  >
                    {scene}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={openFormFromPrompt}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 sm:self-auto"
                aria-label="打開提交表單"
              >
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </section>

        <section id="cases" className="mx-auto mt-8 max-w-6xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">看看其他企業正在解決什麼</h2>
              <p className="mt-1 text-sm text-slate-500">從具體場景出發，沉澱可交付、可驗收、可複用的 AI Solution。</p>
            </div>
            <a href="#cases" className="btn btn-secondary hidden sm:inline-flex">
              查看全部案例
              <ArrowRight size={15} strokeWidth={2.2} />
            </a>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {mockCases.map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border border-brand-100/70 bg-brand-50/40 transition-transform duration-200 group-hover:scale-110" />
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{item.company}</span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-500 ring-1 ring-brand-100/70">
                    <FileText size={16} strokeWidth={2.2} />
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold text-brand-700">{item.outcome}</p>
                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-600">{item.result}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-6">
            <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-[0_30px_90px_rgba(15,23,42,0.25)]">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">提交需求</h2>
                  <p className="mt-1 text-xs text-slate-500">完整度 {readyScore}/5</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="關閉表單"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>

              <div className="space-y-6 px-5 py-5 sm:px-6">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <FileText size={17} strokeWidth={2.3} />
                    需求輪廓
                  </div>
                  <div>
                    <label className="label" htmlFor="order-title">
                      需求標題 <span className="text-brand-500">*</span>
                    </label>
                    <input id="order-title" value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1 h-11" required />
                  </div>
                  <div>
                    <label className="label" htmlFor="description">
                      需求說明
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="input mt-1"
                      placeholder="描述目前卡住的流程、希望被 AI/FDE 幫你完成的工作、已有資料或限制。"
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Building2 size={17} strokeWidth={2.3} />
                    企業資訊
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="enterprise-name">
                        企業名稱 <span className="text-brand-500">*</span>
                      </label>
                      <input id="enterprise-name" value={enterpriseName} onChange={(e) => setEnterpriseName(e.target.value)} className="input mt-1 h-11" required />
                    </div>
                    <div>
                      <label className="label" htmlFor="pmdesktop-product">
                        PM Desktop 產品
                      </label>
                      <select
                        id="pmdesktop-product"
                        value={pmDesktopProductId}
                        onChange={(e) => handleProductChange(e.target.value)}
                        className="input mt-1 h-11"
                        disabled={productsLoading}
                      >
                        <option value="">{productsLoading ? "正在讀取產品..." : ""}</option>
                        {pmDesktopProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      {productsError && <p className="mt-1 text-xs text-amber-600">{productsError}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor="contact-name">
                        聯繫人
                      </label>
                      <input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="input mt-1 h-11" />
                    </div>
                    <div>
                      <label className="label" htmlFor="contact-email">
                        聯繫方式
                      </label>
                      <input id="contact-email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input mt-1 h-11" placeholder="email / phone / wechat" />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <CalendarClock size={17} strokeWidth={2.3} />
                    背景與交付
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="budget-amount">
                        預算
                      </label>
                      <div className="relative mt-1">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} strokeWidth={2} />
                        <input id="budget-amount" type="number" min={0} value={budgetAmount} onChange={(e) => setBudgetAmount(Number(e.target.value))} className="input h-11 pl-9" />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="delivery-date">
                        期望交付時間
                      </label>
                      <input id="delivery-date" type="date" value={expectedDeliveryAt} onChange={(e) => setExpectedDeliveryAt(e.target.value)} className="input mt-1 h-11" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="background">
                      業務背景
                    </label>
                    <textarea
                      id="background"
                      value={businessBackground}
                      onChange={(e) => setBusinessBackground(e.target.value)}
                      rows={3}
                      className="input mt-1"
                      placeholder="這個需求來自什麼業務流程？目前人工怎麼做？為什麼現在要解決？"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="deliverables">
                      交付物期望
                    </label>
                    <textarea
                      id="deliverables"
                      value={deliverableExpectation}
                      onChange={(e) => setDeliverableExpectation(e.target.value)}
                      rows={3}
                      className="input mt-1"
                      placeholder="例如：流程設計、Agent 配置、API 對接、部署說明、驗收標準。"
                    />
                  </div>
                </section>

                {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                <button type="button" onClick={() => setFormOpen(false)} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? "提交中..." : "提交審核"}
                  <ArrowRight size={15} strokeWidth={2.2} />
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </RequireAuth>
  );
}
