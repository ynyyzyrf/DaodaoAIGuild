"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Check,
  ClipboardList,
  ExternalLink,
  Send,
  Shield,
  UserCog,
  UserMinus,
  Users,
  X,
} from "lucide-react";

import {
  assignOrderFde,
  approveCompanyJoinRequest,
  createCompanySolution,
  getMyCompanyState,
  listCompanyJoinRequests,
  listCompanyOrders,
  listCompanySolutions,
  rejectCompanyJoinRequest,
  releaseCompanyLobsterKnight,
  submitCompanySolution,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatSolutionCoinPrice } from "@/lib/solution-price";
import type {
  CompanyJoinRequestWithUserOut,
  CompanyMemberUserOut,
  CompanyMyStateOut,
  CompanyOut,
  DemandOrderOut,
  EnterpriseSolutionOut,
} from "@/lib/types";

type WorkspaceTab = "overview" | "solutions" | "orders" | "members";
type SolutionMode = "uploaded" | "new";

function solutionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    pending_review: "待審核",
    approved: "已通過",
    rejected: "已駁回",
  };
  return labels[status] ?? status;
}

function MemberRow({
  member,
  action,
}: {
  member: CompanyMemberUserOut;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full items-center justify-between gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
          {(member.display_name || member.username).slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">
            {member.display_name || member.username}
          </span>
          <span className="block truncate text-xs text-slate-400">@{member.username}</span>
        </span>
      </div>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

function MemberSection({
  title,
  icon,
  items,
  renderAction,
}: {
  title: string;
  icon: React.ReactNode;
  items: CompanyMemberUserOut[];
  renderAction?: (member: CompanyMemberUserOut) => React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {icon}
        {title}
      </h3>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((member) => (
            <MemberRow key={`${title}-${member.id}`} member={member} action={renderAction?.(member)} />
          ))
        ) : (
          <div className="min-w-0 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">暫無成員</div>
        )}
      </div>
    </section>
  );
}

function CompanyProfileCard({ company }: { company: CompanyOut }) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600">
            <Building2 size={14} strokeWidth={2} />
            公司 Profile
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900">{company.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {company.description || company.strengths || "這家公司暫未補充介紹。"}
          </p>
        </div>
        <Link href={`/companies/${company.id}`} className="btn btn-secondary btn-sm shrink-0">
          <ExternalLink size={14} strokeWidth={2} />
          公開頁
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-400">狀態</div>
          <div className="mt-1 font-semibold text-slate-900">{company.status}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-400">龍蝦騎士</div>
          <div className="mt-1 font-semibold text-slate-900">{company.lobster_knight_count} 位</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-400">所在地</div>
          <div className="mt-1 font-semibold text-slate-900">{company.location || "未填寫"}</div>
        </div>
      </div>
    </section>
  );
}

export default function CompanyCenterPage() {
  const [cachedUser, setCachedUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [state, setState] = useState<CompanyMyStateOut | null>(null);
  const [requests, setRequests] = useState<CompanyJoinRequestWithUserOut[]>([]);
  const [assignmentOrders, setAssignmentOrders] = useState<DemandOrderOut[]>([]);
  const [companySolutions, setCompanySolutions] = useState<EnterpriseSolutionOut[]>([]);
  const [assigneeByOrderId, setAssigneeByOrderId] = useState<Record<number, string>>({});
  const [solutionForm, setSolutionForm] = useState({
    title: "",
    subtitle: "",
    category: "企業知識庫",
    industry: "",
    scenario: "",
    delivery_cycle: "",
    budget_range: "",
    tags: "",
    case_count: "0",
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("overview");
  const [activeSolutionMode, setActiveSolutionMode] = useState<SolutionMode>("uploaded");

  const managedCompanies = state?.managed_companies ?? [];
  const selectedCompany = managedCompanies.find((company) => company.id === selectedCompanyId) ?? managedCompanies[0] ?? null;

  const workspaceTabs: Array<{ key: WorkspaceTab; label: string; count?: number }> = [
    { key: "overview", label: "概覽" },
    { key: "solutions", label: "方案", count: companySolutions.length },
    { key: "orders", label: "需求", count: assignmentOrders.length + requests.length },
    { key: "members", label: "成員", count: selectedCompany?.members.lobster_knights.length ?? 0 },
  ];

  function selectWorkspaceTab(tab: WorkspaceTab) {
    setActiveWorkspaceTab(tab);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  useEffect(() => {
    setCachedUser(getCurrentUser());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "overview" || tab === "solutions" || tab === "orders" || tab === "members") {
      setActiveWorkspaceTab(tab);
    }
  }, []);

  async function refresh(companyId?: number) {
    const nextState = await getMyCompanyState();
    setState(nextState);
    const nextCompanyId = companyId ?? selectedCompanyId ?? nextState.managed_companies[0]?.id ?? null;
    setSelectedCompanyId(nextCompanyId);
    if (nextCompanyId) {
      const [nextRequests, nextOrders, nextSolutions] = await Promise.all([
        listCompanyJoinRequests(nextCompanyId),
        listCompanyOrders(nextCompanyId, { status: "claimed", page_size: 50 }),
        listCompanySolutions(nextCompanyId, { page_size: 50 }),
      ]);
      setRequests(nextRequests);
      setAssignmentOrders(nextOrders.items);
      setCompanySolutions(nextSolutions.items);
    } else {
      setRequests([]);
      setAssignmentOrders([]);
      setCompanySolutions([]);
    }
  }

  useEffect(() => {
    if (!cachedUser) {
      setLoading(false);
      return;
    }
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
    // selectedCompanyId is intentionally excluded; refresh owns the initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedUser]);

  async function runAction(key: string, action: () => Promise<unknown>, success: string) {
    if (!selectedCompany) return false;
    setBusyKey(key);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh(selectedCompany.id);
      setMessage(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function handleAssignFde(order: DemandOrderOut) {
    if (!selectedCompany) return;
    const assigneeId = Number(assigneeByOrderId[order.id]);
    if (!assigneeId) {
      setError("請先選擇要分配的龍蝦騎士");
      setMessage("");
      return;
    }
    await runAction(
      `assign-${order.id}`,
      () => assignOrderFde(selectedCompany.id, order.id, assigneeId),
      "已分配龍蝦騎士跟進。",
    );
  }

  async function handleCreateSolution() {
    if (!selectedCompany) return;
    if (!solutionForm.title.trim()) {
      setError("請先填寫方案名稱");
      setMessage("");
      return;
    }
    const created = await runAction(
      "solution-create",
      async () => {
        const created = await createCompanySolution(selectedCompany.id, {
          title: solutionForm.title.trim(),
          subtitle: solutionForm.subtitle.trim(),
          category: solutionForm.category.trim(),
          industry: solutionForm.industry.trim(),
          scenario: solutionForm.scenario.trim(),
          delivery_cycle: solutionForm.delivery_cycle.trim(),
          budget_range: solutionForm.budget_range.trim(),
          tags: solutionForm.tags
            .split(/[,，\s]+/)
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 8),
          case_count: Number(solutionForm.case_count) || 0,
        });
        await submitCompanySolution(selectedCompany.id, created.id);
        setSolutionForm({
          title: "",
          subtitle: "",
          category: "企業知識庫",
          industry: "",
          scenario: "",
          delivery_cycle: "",
          budget_range: "",
          tags: "",
          case_count: "0",
        });
      },
      "企業方案已提交，等待 Daostore 後台管理員審核。",
    );
    if (created) {
      setActiveSolutionMode("uploaded");
    }
  }

  if (!cachedUser) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">咨詢公司中心</h1>
        <p className="mt-3 text-sm text-slate-500">登入後可管理公司 Profile、加入申請與龍蝦騎士成員。</p>
        <Link href="/login?next=/company-center" className="btn btn-primary mt-6">
          登入
        </Link>
      </main>
    );
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-center text-slate-400">載入中...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      {error && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {message && <div className="mt-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {managedCompanies.length === 0 || !selectedCompany ? (
        <section className="mt-8 rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
          <ClipboardList size={28} strokeWidth={1.8} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-900">暫無可管理公司</h2>
          <p className="mt-2 text-sm text-slate-500">成為公司 Owner / Admin 後，這裡會展示公司管理入口。</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/companies" className="btn btn-secondary btn-sm">
              查看公司名錄
            </Link>
            <Link href="/companies/new" className="btn btn-primary btn-sm">
              咨詢公司入駐
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          {managedCompanies.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {managedCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    refresh(company.id).catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    selectedCompany.id === company.id
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {company.name}
                </button>
              ))}
            </div>
          )}

          {activeWorkspaceTab !== "solutions" && (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              {workspaceTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => selectWorkspaceTab(tab.key)}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    activeWorkspaceTab === tab.key
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  {tab.label}
                  {typeof tab.count === "number" && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${activeWorkspaceTab === tab.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeWorkspaceTab === "overview" && (
            <>
              <CompanyProfileCard company={selectedCompany} />
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["企業方案", companySolutions.length],
                  ["待分配需求", assignmentOrders.length],
                  ["加入申請", requests.length],
                  ["龍蝦騎士", selectedCompany.members.lobster_knights.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-medium text-slate-400">{label}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeWorkspaceTab === "solutions" && (
          <section className="card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <ClipboardList size={18} strokeWidth={2} />
                  企業方案
                </h2>
                <p className="mt-1 text-sm text-slate-500">這裡只做兩件事：查看已上傳方案，或新增一個方案。</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSolutionMode("new")}
                className="btn btn-primary btn-sm"
              >
                新增方案
              </button>
            </div>

            {activeSolutionMode === "uploaded" && (
              <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {companySolutions.length > 0 ? (
                  companySolutions.map((solution) => (
                    <div key={solution.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">{solution.title}</h3>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {solutionStatusLabel(solution.status)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{solution.subtitle || "暫未填寫方案描述"}</p>
                        {solution.review_note && <p className="mt-1 text-xs text-slate-400">審核備註：{solution.review_note}</p>}
                      </div>
                      <div className="text-sm font-bold text-brand-600">{formatSolutionCoinPrice(solution.budget_range)}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <div className="text-sm text-slate-400">暫無企業方案</div>
                  </div>
                )}
              </div>
            )}

          </section>
          )}

          {activeWorkspaceTab === "solutions" && activeSolutionMode === "new" && typeof document !== "undefined" && createPortal(
            <>
              <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[1px]" />
              <div className="fixed inset-0 z-[101] flex items-center justify-center px-4 py-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="solution-create-title"
                className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_56px_rgba(15,23,42,0.16)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="solution-create-title" className="text-lg font-bold text-slate-950">新增企業方案</h2>
                    <p className="mt-1 text-sm text-slate-500">提交後會進入 Daostore 後台審核，通過後展示到企業方案頁。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSolutionMode("uploaded")}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                    aria-label="關閉新增方案彈窗"
                  >
                    <X size={16} strokeWidth={2.2} />
                  </button>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-4">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-2">
                    方案名稱
                    <input
                      value={solutionForm.title}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, title: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：企業知識庫搭建"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    分類
                    <input
                      value={solutionForm.category}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, category: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：企業知識庫"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    Coin 價格
                    <input
                      value={solutionForm.budget_range}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, budget_range: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：5000 coin 起"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-4">
                    方案描述
                    <textarea
                      value={solutionForm.subtitle}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, subtitle: e.target.value }))}
                      className="input min-h-24 py-2 text-sm font-normal"
                      placeholder="一句話說清楚交付內容、適用場景與可驗收結果"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    行業
                    <input
                      value={solutionForm.industry}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, industry: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：零售"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    場景
                    <input
                      value={solutionForm.scenario}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, scenario: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：客服提效"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    交付週期
                    <input
                      value={solutionForm.delivery_cycle}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, delivery_cycle: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="例如：2-3 週"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    案例數
                    <input
                      value={solutionForm.case_count}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, case_count: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="0"
                      type="number"
                      min="0"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-4">
                    標籤
                    <input
                      value={solutionForm.tags}
                      onChange={(e) => setSolutionForm((current) => ({ ...current, tags: e.target.value }))}
                      className="input h-10 text-sm font-normal"
                      placeholder="用逗號或空格分隔，例如：RAG 知識庫 自動化"
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveSolutionMode("uploaded")}
                    className="btn btn-secondary btn-sm"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSolution}
                    disabled={busyKey === "solution-create"}
                    className="btn btn-primary btn-sm"
                  >
                    {busyKey === "solution-create" ? "提交中..." : "提交審核"}
                  </button>
                </div>
              </div>
            </div>
            </>,
            document.body,
          )}

          {activeWorkspaceTab === "orders" && (
          <section className="grid gap-6">
            <div className="space-y-6">
              <div className="card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Send size={18} strokeWidth={2} />
                      已承接待分配
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">公司接單後，在這裡分配給本公司 active 龍蝦騎士。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {assignmentOrders.length}
                  </span>
                </div>

                <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {assignmentOrders.length > 0 ? (
                    assignmentOrders.map((order) => (
                      <div key={order.id} className="grid gap-3 p-4 xl:grid-cols-[1fr_280px] xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                              已接單
                            </span>
                            <span className="text-xs text-slate-400">{order.enterprise_name}</span>
                          </div>
                          <Link href={`/orders/${order.id}`} className="mt-2 block truncate text-sm font-bold text-slate-900 hover:text-brand-600">
                            {order.title}
                          </Link>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {order.description || order.business_background || "企業尚未補充詳細描述"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={assigneeByOrderId[order.id] ?? ""}
                            onChange={(e) =>
                              setAssigneeByOrderId((current) => ({ ...current, [order.id]: e.target.value }))
                            }
                            className="input h-10 min-w-0 flex-1 text-sm"
                            disabled={selectedCompany.members.lobster_knights.length === 0}
                          >
                            <option value="">選擇騎士</option>
                            {selectedCompany.members.lobster_knights.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.display_name || member.username}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAssignFde(order)}
                            disabled={busyKey === `assign-${order.id}` || selectedCompany.members.lobster_knights.length === 0}
                            className="btn btn-primary btn-sm shrink-0"
                          >
                            {busyKey === `assign-${order.id}` ? "分配中..." : "分配"}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">暫無已承接待分配訂單</div>
                  )}
                </div>
              </div>

              <div className="card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <ClipboardList size={18} strokeWidth={2} />
                    待處理加入申請
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">第一階段不做邀請，只處理龍蝦騎士主動申請。</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {requests.length}
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {requests.length > 0 ? (
                  requests.map((request) => (
                    <div key={request.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {request.user.display_name || request.user.username}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          @{request.user.username} · {new Date(request.requested_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              `approve-${request.id}`,
                              () => approveCompanyJoinRequest(selectedCompany.id, request.id),
                              "已批准加入申請。",
                            )
                          }
                          disabled={busyKey === `approve-${request.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          <Check size={14} strokeWidth={2.4} />
                          批准
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction(
                              `reject-${request.id}`,
                              () => rejectCompanyJoinRequest(selectedCompany.id, request.id),
                              "已拒絕加入申請。",
                            )
                          }
                          disabled={busyKey === `reject-${request.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          <X size={14} strokeWidth={2.4} />
                          拒絕
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-sm text-slate-400">暫無待處理申請</div>
                )}
              </div>
            </div>
            </div>
          </section>
          )}

          {activeWorkspaceTab === "members" && (
            <section className="grid gap-6 lg:grid-cols-3">
              <MemberSection
                title="Owner"
                icon={<Shield size={16} strokeWidth={2} />}
                items={selectedCompany.members.owner ? [selectedCompany.members.owner] : []}
              />
              <MemberSection
                title="Admin"
                icon={<UserCog size={16} strokeWidth={2} />}
                items={selectedCompany.members.admins}
              />
              <MemberSection
                title="龍蝦騎士"
                icon={<Users size={16} strokeWidth={2} />}
                items={selectedCompany.members.lobster_knights}
                renderAction={(member) => (
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        `release-${member.id}`,
                        () => releaseCompanyLobsterKnight(selectedCompany.id, member.id),
                        "已解除龍蝦騎士正式歸屬。",
                      )
                    }
                    disabled={busyKey === `release-${member.id}` || member.id === cachedUser.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    title={member.id === cachedUser.id ? "不能自行解除公司歸屬" : "解除正式歸屬"}
                  >
                    <UserMinus size={14} strokeWidth={2.2} />
                  </button>
                )}
              />
            </section>
          )}
        </div>
      )}
    </main>
  );
}
