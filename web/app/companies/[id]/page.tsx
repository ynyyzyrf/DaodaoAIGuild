"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Send,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

import { isLoggedIn } from "@/lib/auth";
import { createCompanyJoinRequest, getCompany, getMyCompanyState } from "@/lib/api";
import type { CompanyMemberUserOut, CompanyMyStateOut, CompanyOut } from "@/lib/types";

function AvatarStackItem({ member }: { member: CompanyMemberUserOut }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
        {(member.display_name || member.username).slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-800">
          {member.display_name || member.username}
        </span>
        <span className="block truncate text-xs text-slate-400">@{member.username}</span>
      </span>
    </div>
  );
}

function MemberSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: CompanyMemberUserOut[];
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {icon}
        {title}
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.length > 0 ? (
          items.map((member) => <AvatarStackItem key={`${title}-${member.id}`} member={member} />)
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-400">
            暫無成員
          </div>
        )}
      </div>
    </section>
  );
}

const COMPANY_STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
    icon: React.ReactNode;
    headline: string;
    description: string;
  }
> = {
  draft: {
    label: "草稿",
    className: "bg-slate-100 text-slate-600",
    icon: <Clock3 size={14} strokeWidth={2.2} />,
    headline: "公司資料尚未提交",
    description: "補齊資料後提交平台審核，審核通過後才會正式入駐並進入公司名錄。",
  },
  pending: {
    label: "審核中",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    icon: <Clock3 size={14} strokeWidth={2.2} />,
    headline: "入駐申請已提交，等待平台審核",
    description: "平台會先確認公司資料、服務方向與聯繫方式。審核通過後，申請人會成為公司 Owner。",
  },
  requires_changes: {
    label: "需補充",
    className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/70",
    icon: <AlertCircle size={14} strokeWidth={2.2} />,
    headline: "入駐資料需要補充",
    description: "請根據審核意見補齊資料後再提交審核。",
  },
  rejected: {
    label: "未通過",
    className: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
    icon: <AlertCircle size={14} strokeWidth={2.2} />,
    headline: "入駐申請未通過",
    description: "可根據審核意見調整公司資料後重新提交。",
  },
  approved: {
    label: "已入駐",
    className: "bg-green-50 text-green-700 ring-1 ring-green-200/70",
    icon: <CheckCircle2 size={14} strokeWidth={2.2} />,
    headline: "已通過平台審核",
    description: "公司已正式進入供給側，可以管理成員並承接平台需求。",
  },
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const companyId = useMemo(() => Number(params.id), [params.id]);
  const [company, setCompany] = useState<CompanyOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [companyState, setCompanyState] = useState<CompanyMyStateOut | null>(null);

  useEffect(() => {
    if (!Number.isFinite(companyId)) return;
    async function load() {
      try {
        setCompany(await getCompany(companyId));
        if (isLoggedIn()) {
          setCompanyState(await getMyCompanyState());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function handleJoin() {
    const activeCompany = companyState?.active_company ?? null;
    const pendingJoin = companyState?.pending_join_request ?? null;
    if (activeCompany) {
      setError(`你已正式加入「${activeCompany.name}」，暫不能申請其他公司。`);
      setMessage("");
      return;
    }
    if (pendingJoin && pendingJoin.company_id !== companyId) {
      setError("你已有待處理加入申請，需等公司處理後才能申請其他公司。");
      setMessage("");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createCompanyJoinRequest(companyId);
      setCompanyState(await getMyCompanyState());
      setMessage("加入申請已提交，等待公司 Owner / Admin 處理。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-center text-slate-400">載入中...</main>;
  }

  if (!company) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-center text-slate-400">{error || "公司不存在"}</main>;
  }

  const owner = company.members.owner ? [company.members.owner] : [];
  const activeCompany = companyState?.active_company ?? null;
  const pendingJoin = companyState?.pending_join_request ?? null;
  const hasActiveCompany = activeCompany !== null;
  const hasPendingElsewhere = pendingJoin !== null && pendingJoin.company_id !== company.id;
  const hasPendingHere = pendingJoin?.company_id === company.id;
  const statusMeta = COMPANY_STATUS_META[company.status] ?? COMPANY_STATUS_META.draft;
  const isApproved = company.status === "approved";
  const justSubmitted = searchParams.get("submitted") === "1";

  return (
    <main className="bg-slate-50/70 pb-16">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <Link href="/companies" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} strokeWidth={2} />
        返回公司名錄
      </Link>

      <header className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#fff_0%,#fff7f3_48%,#f8fafc_100%)] px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xl font-bold text-white shadow-sm">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="h-full w-full rounded-xl object-cover" />
              ) : (
                company.name.slice(0, 1).toUpperCase()
              )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-950">{company.name}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                    {statusMeta.icon}
                    {statusMeta.label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                  {company.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={15} strokeWidth={2} />
                      {company.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users size={15} strokeWidth={2} />
                    {company.lobster_knight_count} 位龍蝦騎士
                  </span>
                </div>
              </div>
            </div>

            {isApproved ? (
              <button type="button" onClick={handleJoin} disabled={busy || hasActiveCompany || hasPendingElsewhere || hasPendingHere} className="btn btn-primary md:mt-1">
                <Send size={16} strokeWidth={2.5} />
                {activeCompany?.id === company.id ? "已加入" : hasPendingHere ? "已提交申請" : busy ? "提交中..." : "申請加入"}
              </button>
            ) : (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 md:max-w-xs">
                目前不可申請加入，待平台審核通過後開放。
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
              {statusMeta.icon}
              入駐狀態
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-950">{statusMeta.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{statusMeta.description}</p>
            {justSubmitted && (
              <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                資料已送出，現在是等待平台審核，不代表已正式入駐。
              </p>
            )}
            {company.review_note && (
              <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                審核意見：{company.review_note}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-bold text-slate-900">審核流程</div>
            <div className="mt-4 space-y-3">
              {["提交資料", "平台審核", "正式入駐"].map((step, index) => {
                const active =
                  index === 0 ||
                  (index === 1 && ["pending", "requires_changes", "rejected", "approved"].includes(company.status)) ||
                  (index === 2 && isApproved);
                return (
                  <div key={step} className="flex items-center gap-3 text-sm">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-brand-500 text-white" : "bg-white text-slate-300 ring-1 ring-slate-200"}`}>
                      {index + 1}
                    </span>
                    <span className={active ? "font-semibold text-slate-800" : "text-slate-400"}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {activeCompany && (
          <p className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 sm:mx-7">
            <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            你已正式加入「{activeCompany.name}」，暫不能再申請其他公司。
          </p>
        )}
        {hasPendingElsewhere && (
          <p className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:mx-7">
            <Clock3 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            你已有待處理加入申請，暫不能申請其他公司。
            <Link href={`/companies/${pendingJoin.company_id}`} className="font-semibold underline underline-offset-2">
              查看申請公司
            </Link>
          </p>
        )}
        {message && <p className="mx-5 mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 sm:mx-7">{message}</p>}
        {error && <p className="mx-5 mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 sm:mx-7">{error}</p>}
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <Building2 size={18} strokeWidth={2} />
              公司介紹
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {company.description || "這家公司暫未補充介紹。"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">服務與能力</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">服務領域</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{company.service_fields || "暫未填寫"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800">擅長方向</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{company.strengths || "暫未填寫"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">過往案例</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
              {company.cases || "暫未填寫"}
            </p>
          </div>
        </section>

        <aside className="space-y-5">
          {isApproved ? (
            <>
              <MemberSection title="Owner" icon={<Shield size={16} strokeWidth={2} />} items={owner} />
              <MemberSection title="Admin" icon={<UserCog size={16} strokeWidth={2} />} items={company.members.admins} />
              <MemberSection title="龍蝦騎士" icon={<Users size={16} strokeWidth={2} />} items={company.members.lobster_knights} />
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <Clock3 size={18} strokeWidth={2.2} />
                等待平台審核
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                審核通過前，公司不會出現在正式公司名錄中，也不會開放龍蝦騎士申請加入。
              </p>
            </section>
          )}
        </aside>
      </div>
      </div>
    </main>
  );
}
