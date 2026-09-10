"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  Coins,
  ClipboardList,
  Handshake,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  approveCompanyJoinRequest,
  assignOrderFde,
  getMyCompanyState,
  getMyProfile,
  listCompanyJoinRequests,
  listCompanyOrders,
  listMyOrders,
  rejectCompanyJoinRequest,
} from "@/lib/api";
import { getUserQuestions, getUserTutorials, setCurrentTitle } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type {
  CompanyJoinRequestWithUserOut,
  CompanyMyStateOut,
  CompanyOut,
  DemandOrderOut,
  MeOut,
  QuestionOut,
  TutorialOut,
} from "@/lib/types";
import InfoPanel from "@/components/InfoPanel";
import RoleShowcase from "@/components/RoleShowcase";

type IdentityKey = "demand" | "fde" | "company";

const ORDER_STATUS_LABEL: Record<string, string> = {
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

const ORDER_STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_review: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  review_rejected: "bg-red-50 text-red-700 ring-1 ring-red-100",
  opportunity_pool: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  claimed: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  requirement_following: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
  quoted: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  pending_payment: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  pending_acceptance: "bg-purple-50 text-purple-700 ring-1 ring-purple-100",
  accepted: "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
  settled: "bg-slate-900 text-white",
  rated: "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
};

function formatDate(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("zh-Hant", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatBudget(value: number) {
  if (!value) return "待議";
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function EntryCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]"
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-100">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-950">{title}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
        </span>
        <ArrowRight
          className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500"
          size={17}
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "slate";
  children: React.ReactNode;
}) {
  const styles = {
    green: "border-green-100 bg-green-50 text-green-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-white text-slate-600",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

function KnightStatusAction({
  tone,
  message,
  href,
  label,
}: {
  tone: "green" | "amber" | "slate";
  message: string;
  href: string;
  label: string;
}) {
  const styles = {
    green: "border-green-100 bg-green-50 text-green-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-white text-slate-600",
  };

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${styles[tone]}`}>
      <span>{message}</span>
      <Link
        href={href}
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:text-brand-600 hover:ring-brand-200"
      >
        {label}
        <ArrowRight size={13} strokeWidth={2.4} />
      </Link>
    </div>
  );
}

function OrdersOverview({
  orders,
  loading,
  error,
}: {
  orders: DemandOrderOut[];
  loading: boolean;
  error: string;
}) {
  const activeCount = orders.filter((order) => !["settled", "rated", "review_rejected"].includes(order.status)).length;
  const waitingCount = orders.filter((order) => ["pending_review", "pending_payment", "pending_acceptance"].includes(order.status)).length;
  const completedCount = orders.filter((order) => ["settled", "rated"].includes(order.status)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["進行中", activeCount],
          ["待你處理", waitingCount],
          ["已完成", completedCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">我的需求</h2>
            <p className="mt-1 text-sm text-slate-500">直接查看你已提交需求的最新狀態。</p>
          </div>
          <Link href="/orders" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            查看全部
          </Link>
        </div>

        {loading && <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-400">載入需求狀態...</div>}
        {error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="mt-5 divide-y divide-slate-100">
            {orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">暫無已提交需求。</div>
            ) : (
              orders.slice(0, 6).map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="group block py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_TONE[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {ORDER_STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-bold text-slate-950 group-hover:text-brand-600">{order.title}</h3>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                        {order.description || order.business_background || "尚未補充需求說明"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Coins size={15} strokeWidth={2} />
                        {formatBudget(order.budget_amount)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock size={15} strokeWidth={2} />
                        {formatDate(order.expected_delivery_at)}
                      </span>
                      <ArrowRight size={16} strokeWidth={2.4} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KnightProfileWorkbench({
  profile,
  loading,
  error,
  questions,
  tutorials,
  equippedBySlot,
  busy,
  onSetTitle,
}: {
  profile: MeOut | null;
  loading: boolean;
  error: string;
  questions: QuestionOut[];
  tutorials: TutorialOut[];
  equippedBySlot: Record<string, MeOut["equipment"][number] | null>;
  busy: string | null;
  onSetTitle: (code: string) => void;
}) {
  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">載入公開 Profile...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  if (!profile) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">暫無公開 Profile 資料。</div>;
  }

  return (
    <section className="flex flex-col gap-5 lg:flex-row">
      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[38%] lg:max-w-[420px]">
        <RoleShowcase equipment={equippedBySlot} user={profile} />
      </aside>
      <div className="min-w-0 flex-1">
        <InfoPanel
          user={profile}
          questions={questions}
          tutorials={tutorials}
          isOwner
          onSetTitle={onSetTitle}
          busy={busy}
          currentTitleCode={profile.current_title?.code}
          unlockedTitles={profile.titles.filter((title) => title.unlocked)}
        />
      </div>
    </section>
  );
}

function CompanyProfileOverview({ company }: { company: CompanyOut }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600">
            <Building2 size={15} strokeWidth={2} />
            公司 Profile
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">{company.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {company.description || company.strengths || "已通過平台審核的咨詢公司。"}
          </p>
        </div>
        <Link
          href={`/companies/${company.id}`}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:text-brand-600 hover:ring-brand-200"
        >
          公開頁
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
          <div className="text-xs text-slate-400">狀態</div>
          <div className="mt-1 font-bold text-slate-950">{company.status}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
          <div className="text-xs text-slate-400">龍蝦騎士</div>
          <div className="mt-1 font-bold text-slate-950">{company.lobster_knight_count} 位</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
          <div className="text-xs text-slate-400">所在地</div>
          <div className="mt-1 truncate font-bold text-slate-950">{company.location || "未設定"}</div>
        </div>
      </div>
    </section>
  );
}

function CompanyWorkbench({
  companies,
  selectedCompany,
  selectedCompanyId,
  requests,
  assignmentOrders,
  assigneeByOrderId,
  loading,
  busyKey,
  message,
  error,
  onSelectCompany,
  onAssigneeChange,
  onAssign,
  onApprove,
  onReject,
}: {
  companies: CompanyOut[];
  selectedCompany: CompanyOut | null;
  selectedCompanyId: number | null;
  requests: CompanyJoinRequestWithUserOut[];
  assignmentOrders: DemandOrderOut[];
  assigneeByOrderId: Record<number, string>;
  loading: boolean;
  busyKey: string;
  message: string;
  error: string;
  onSelectCompany: (companyId: number) => void;
  onAssigneeChange: (orderId: number, value: string) => void;
  onAssign: (order: DemandOrderOut) => void;
  onApprove: (request: CompanyJoinRequestWithUserOut) => void;
  onReject: (request: CompanyJoinRequestWithUserOut) => void;
}) {
  if (!selectedCompany) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <EntryCard
          href="/companies/new"
          icon={<Users size={18} strokeWidth={2} />}
          title="申請入駐"
          description="提交咨詢公司資料，通過審核後承接需求。"
        />
      </div>
    );
  }

  const knightCount = selectedCompany.members.lobster_knights.length;

  return (
    <div className="space-y-5">
      {companies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => onSelectCompany(company.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCompanyId === company.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:text-slate-950"
              }`}
            >
              {company.name}
            </button>
          ))}
        </div>
      )}

      <CompanyProfileOverview company={selectedCompany} />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["待分派需求", assignmentOrders.length],
          ["加入申請", requests.length],
          ["公司騎士", knightCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      {message && <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400">載入公司待辦...</div>}

      {!loading && (
        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <Send size={18} strokeWidth={2} />
                  已承接待分派
                </h3>
                <p className="mt-1 text-sm text-slate-500">把公司已接下的需求分派給 active 龍蝦騎士。</p>
              </div>
              <Link href="/company-center" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                全部
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {assignmentOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">暫無已承接待分派訂單</div>
              ) : (
                assignmentOrders.slice(0, 4).map((order) => (
                  <div key={order.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 xl:grid-cols-[1fr_260px] xl:items-center">
                    <div className="min-w-0">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">已接單</span>
                      <Link href={`/orders/${order.id}`} className="mt-2 block truncate text-sm font-bold text-slate-950 hover:text-brand-600">
                        {order.title}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{order.enterprise_name}</p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={assigneeByOrderId[order.id] ?? ""}
                        onChange={(event) => onAssigneeChange(order.id, event.target.value)}
                        disabled={knightCount === 0}
                        className="input h-10 min-w-0 flex-1 text-sm"
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
                        onClick={() => onAssign(order)}
                        disabled={busyKey === `assign-${order.id}` || knightCount === 0}
                        className="btn btn-primary btn-sm shrink-0"
                      >
                        {busyKey === `assign-${order.id}` ? "分派中" : "分派"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                  <ClipboardList size={18} strokeWidth={2} />
                  待審核加入申請
                </h3>
                <p className="mt-1 text-sm text-slate-500">審核主動申請加入公司的龍蝦騎士。</p>
              </div>
              <Link href="/company-center" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                全部
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">暫無待處理申請</div>
              ) : (
                requests.slice(0, 4).map((request) => (
                  <div key={request.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-950">{request.user.display_name || request.user.username}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">@{request.user.username}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onApprove(request)}
                        disabled={busyKey === `approve-${request.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        <Check size={14} strokeWidth={2.4} />
                        批准
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(request)}
                        disabled={busyKey === `reject-${request.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        <X size={14} strokeWidth={2.4} />
                        拒絕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <Link href="/company-center" className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:text-brand-600 hover:ring-brand-200">
          進入完整公司中心
          <ArrowRight size={14} strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  );
}

export default function MyCenterPage() {
  const [cachedUser, setCachedUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [companyState, setCompanyState] = useState<CompanyMyStateOut | null>(null);
  const [orders, setOrders] = useState<DemandOrderOut[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [profile, setProfile] = useState<MeOut | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [tutorials, setTutorials] = useState<TutorialOut[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyRequests, setCompanyRequests] = useState<CompanyJoinRequestWithUserOut[]>([]);
  const [companyOrders, setCompanyOrders] = useState<DemandOrderOut[]>([]);
  const [assigneeByOrderId, setAssigneeByOrderId] = useState<Record<number, string>>({});
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyBusyKey, setCompanyBusyKey] = useState("");
  const [companyMessage, setCompanyMessage] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [activeTab, setActiveTab] = useState<IdentityKey>("demand");
  const [error, setError] = useState("");

  useEffect(() => {
    setCachedUser(getCurrentUser());
  }, []);

  useEffect(() => {
    if (!cachedUser) return;
    getMyCompanyState()
      .then((stateData) => setCompanyState(stateData))
      .catch((err) => setError(err instanceof Error ? err.message : "載入失敗"));
  }, [cachedUser]);

  useEffect(() => {
    if (!cachedUser) return;
    setOrdersLoading(true);
    listMyOrders({ page_size: 50 })
      .then((data) => setOrders(data.items))
      .catch((err) => setOrdersError(err instanceof Error ? err.message : "載入需求失敗"))
      .finally(() => setOrdersLoading(false));
  }, [cachedUser]);

  useEffect(() => {
    if (!cachedUser) return;
    setProfileLoading(true);
    Promise.all([getMyProfile(), getUserQuestions(cachedUser.id), getUserTutorials(cachedUser.id)])
      .then(([profileData, questionData, tutorialData]) => {
        setProfile(profileData);
        setQuestions(questionData);
        setTutorials(tutorialData);
      })
      .catch((err) => setProfileError(err instanceof Error ? err.message : "載入 Profile 失敗"))
      .finally(() => setProfileLoading(false));
  }, [cachedUser]);

  const equippedBySlot = useMemo(() => {
    const map: Record<string, MeOut["equipment"][number] | null> = {};
    if (profile) {
      for (const item of profile.equipment) {
        if (item.is_equipped) map[item.slot] = item;
      }
    }
    return map;
  }, [profile]);

  const handleSetTitle = useCallback(
    async (titleCode: string) => {
      if (!titleCode || busy) return;
      setBusy("title");
      try {
        const nextProfile = await setCurrentTitle(titleCode);
        setProfile(nextProfile);
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  useEffect(() => {
    const firstCompanyId = companyState?.managed_companies[0]?.id ?? null;
    setSelectedCompanyId((current) => current ?? firstCompanyId);
  }, [companyState]);

  const refreshCompanyDesk = useCallback(async (companyId: number) => {
    setCompanyLoading(true);
    setCompanyError("");
    try {
      const [nextRequests, nextOrders] = await Promise.all([
        listCompanyJoinRequests(companyId),
        listCompanyOrders(companyId, { status: "claimed", page_size: 50 }),
      ]);
      setCompanyRequests(nextRequests);
      setCompanyOrders(nextOrders.items);
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : "載入公司待辦失敗");
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyRequests([]);
      setCompanyOrders([]);
      return;
    }
    refreshCompanyDesk(selectedCompanyId);
  }, [refreshCompanyDesk, selectedCompanyId]);

  async function runCompanyAction(key: string, action: () => Promise<unknown>, success: string) {
    if (!selectedCompanyId) return;
    setCompanyBusyKey(key);
    setCompanyError("");
    setCompanyMessage("");
    try {
      await action();
      const nextState = await getMyCompanyState();
      setCompanyState(nextState);
      await refreshCompanyDesk(selectedCompanyId);
      setCompanyMessage(success);
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setCompanyBusyKey("");
    }
  }

  if (!cachedUser) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">個人中心</h1>
        <p className="mt-3 text-sm text-slate-500">登入後查看你的身份與工作入口。</p>
        <Link href="/login?next=/me" className="btn btn-primary mt-6">
          登入
        </Link>
      </main>
    );
  }

  const displayName = cachedUser.display_name || cachedUser.username;
  const activeCompany = companyState?.active_company ?? null;
  const pendingJoin = companyState?.pending_join_request ?? null;
  const managedCompanies = companyState?.managed_companies ?? [];
  const selectedCompany = managedCompanies.find((company) => company.id === selectedCompanyId) ?? managedCompanies[0] ?? null;
  const isCompanyLobsterKnight =
    activeCompany?.members.lobster_knights.some((member) => member.id === cachedUser.id) === true ||
    managedCompanies.some((company) => company.members.lobster_knights.some((member) => member.id === cachedUser.id));
  const isVerifiedFde = cachedUser.is_verified_fde === true || isCompanyLobsterKnight;
  const managesCompany = managedCompanies.length > 0;
  const belongsToCompany = activeCompany !== null;
  const identityTabs: Array<{
    key: IdentityKey;
    label: string;
    status: string;
  }> = [
    { key: "demand", label: "需求方", status: "可用" },
    { key: "fde", label: "龍蝦騎士", status: isVerifiedFde ? "已確認" : "未確認" },
    { key: "company", label: "咨詢公司", status: managesCompany ? `${managedCompanies.length} 家` : "未管理" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
        <div className="mb-6 flex flex-wrap gap-1.5 lg:absolute lg:right-8 lg:top-8 lg:mb-0">
          {identityTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === item.key
                  ? "bg-slate-950 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white hover:text-slate-950"
              }`}
              title={`${item.label} · ${item.status}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600">
              <UserRound size={16} strokeWidth={2} />
              身份總覽
            </div>
            <h1 className="mt-5 truncate text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{displayName}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              依照你目前的身份切換工作入口。這裡只做總覽，具體操作會回到對應中心處理。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px] lg:pt-16">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
              <div className="text-xs text-slate-400">龍蝦騎士</div>
              <div className="mt-1 font-bold text-slate-950">{isVerifiedFde ? "已確認" : "未確認"}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
              <div className="text-xs text-slate-400">所屬公司</div>
              <div className="mt-1 truncate font-bold text-slate-950">
                {activeCompany?.name ?? (pendingJoin ? "審核中" : "暫無")}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
              <div className="text-xs text-slate-400">管理公司</div>
              <div className="mt-1 font-bold text-slate-950">{managedCompanies.length} 家</div>
            </div>
          </div>
        </div>
        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      </header>

      <section className="mt-8">
        {activeTab === "demand" && (
          <OrdersOverview orders={orders} loading={ordersLoading} error={ordersError} />
        )}

        {activeTab === "fde" && (
          <div className="space-y-4">
            <KnightProfileWorkbench
              profile={profile}
              loading={profileLoading}
              error={profileError}
              questions={questions}
              tutorials={tutorials}
              equippedBySlot={equippedBySlot}
              busy={busy}
              onSetTitle={handleSetTitle}
            />
            {belongsToCompany && (
              <KnightStatusAction
                tone="green"
                message={`你已正式加入「${activeCompany.name}」。`}
                href="/opportunities"
                label="前往機會池"
              />
            )}
            {!belongsToCompany && pendingJoin && (
              <KnightStatusAction
                tone="amber"
                message="你有一個待處理的公司加入申請。"
                href="/companies"
                label="查看公司"
              />
            )}
            {!belongsToCompany && !pendingJoin && isVerifiedFde && (
              <div className="grid gap-4 md:grid-cols-2">
                <EntryCard
                  href="/companies"
                  icon={<BriefcaseBusiness size={18} strokeWidth={2} />}
                  title="加入咨詢公司"
                  description="瀏覽已入駐公司，申請加入合適的合作組織。"
                />
              </div>
            )}
            {!isVerifiedFde && (
              <div className="grid gap-4 md:grid-cols-2">
                <EntryCard
                  href="/knights/become"
                  icon={<Handshake size={18} strokeWidth={2} />}
                  title="成為龍蝦騎士"
                  description="了解龍蝦騎士身份建立方式。"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "company" && (
          <div className="space-y-4">
            {managesCompany ? (
              <StatusPill tone="green">
                你正在管理 {managedCompanies.length} 家公司：
                {managedCompanies.map((company) => company.name).join("、")}
              </StatusPill>
            ) : (
              <StatusPill tone="slate">你目前不是任何公司的 Owner / Admin。</StatusPill>
            )}
            <CompanyWorkbench
              companies={managedCompanies}
              selectedCompany={selectedCompany}
              selectedCompanyId={selectedCompany?.id ?? null}
              requests={companyRequests}
              assignmentOrders={companyOrders}
              assigneeByOrderId={assigneeByOrderId}
              loading={companyLoading}
              busyKey={companyBusyKey}
              message={companyMessage}
              error={companyError}
              onSelectCompany={(companyId) => {
                setSelectedCompanyId(companyId);
                setCompanyMessage("");
                setCompanyError("");
              }}
              onAssigneeChange={(orderId, value) =>
                setAssigneeByOrderId((current) => ({ ...current, [orderId]: value }))
              }
              onAssign={(order) => {
                if (!selectedCompany) return;
                const assigneeId = Number(assigneeByOrderId[order.id]);
                if (!assigneeId) {
                  setCompanyError("請先選擇要分派的龍蝦騎士");
                  setCompanyMessage("");
                  return;
                }
                runCompanyAction(
                  `assign-${order.id}`,
                  () => assignOrderFde(selectedCompany.id, order.id, assigneeId),
                  "已分派龍蝦騎士跟進。",
                );
              }}
              onApprove={(request) => {
                if (!selectedCompany) return;
                runCompanyAction(
                  `approve-${request.id}`,
                  () => approveCompanyJoinRequest(selectedCompany.id, request.id),
                  "已批准加入申請。",
                );
              }}
              onReject={(request) => {
                if (!selectedCompany) return;
                runCompanyAction(
                  `reject-${request.id}`,
                  () => rejectCompanyJoinRequest(selectedCompany.id, request.id),
                  "已拒絕加入申請。",
                );
              }}
            />
          </div>
        )}

      </section>
    </main>
  );
}
