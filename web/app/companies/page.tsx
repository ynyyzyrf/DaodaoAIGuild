"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Clock3, MapPin, Plus, Send, ShieldCheck, Users } from "lucide-react";

import { isLoggedIn } from "@/lib/auth";
import { createCompanyJoinRequest, getMyCompanyState, listCompanies } from "@/lib/api";
import type { CompanyMyStateOut, CompanyOut } from "@/lib/types";

function companyInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "C";
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCompanyId, setBusyCompanyId] = useState<number | null>(null);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinError, setJoinError] = useState("");
  const [companyState, setCompanyState] = useState<CompanyMyStateOut | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await listCompanies({ page_size: 50 });
        setCompanies(data.items);
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
  }, []);

  async function handleJoin(company: CompanyOut) {
    const activeCompany = companyState?.active_company ?? null;
    const pendingJoin = companyState?.pending_join_request ?? null;
    if (activeCompany) {
      setJoinError(`你已正式加入「${activeCompany.name}」，暫不能申請其他公司。`);
      return;
    }
    if (pendingJoin && pendingJoin.company_id !== company.id) {
      setJoinError("你已有待處理加入申請，需等公司處理後才能申請其他公司。");
      return;
    }
    setBusyCompanyId(company.id);
    setJoinMessage("");
    setJoinError("");
    try {
      await createCompanyJoinRequest(company.id);
      setCompanyState(await getMyCompanyState());
      setJoinMessage(`已申請加入「${company.name}」，等待公司 Owner / Admin 處理。`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusyCompanyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">
            <Building2 size={16} strokeWidth={2} />
            咨詢公司
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">公司名錄</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            選擇一家正式入駐公司申請加入。龍蝦騎士同一時間只能有一個待處理申請。
          </p>
        </div>
        <Link href="/companies/new" className="btn btn-primary">
          <Plus size={16} strokeWidth={2.5} />
          咨詢公司入駐
        </Link>
      </header>

      {loading && <div className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">載入中...</div>}
      {error && <div className="mt-8 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {joinMessage && <div className="mt-6 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">{joinMessage}</div>}
      {joinError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{joinError}</div>}
      {companyState?.active_company && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
          <ShieldCheck size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <div>
            你已正式加入「{companyState.active_company.name}」。
            <Link href={`/companies/${companyState.active_company.id}`} className="ml-1 font-semibold underline underline-offset-2">
              查看所屬公司
            </Link>
          </div>
        </div>
      )}
      {companyState?.pending_join_request && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock3 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <div>
            你已有一個待處理加入申請。
            <Link href={`/companies/${companyState.pending_join_request.company_id}`} className="ml-1 font-semibold underline underline-offset-2">
              查看申請公司
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <Building2 size={34} strokeWidth={1.8} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">暫無正式入駐公司</h2>
          <p className="mt-1 text-sm text-slate-500">通過平台審核後，公司會出現在這裡。</p>
        </section>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {companies.map((company) => (
          <article
            key={company.id}
            className="card card-hover group p-5"
          >
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white">
                {company.logo_url ? (
                  <img src={company.logo_url} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  companyInitial(company.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="truncate text-lg font-bold text-slate-900">{company.name}</h2>
                  <Link href={`/companies/${company.id}`} aria-label={`查看 ${company.name}`} className="mt-1 shrink-0 text-slate-300 transition-transform hover:translate-x-1 hover:text-brand-500">
                    <ArrowRight size={18} strokeWidth={2} />
                  </Link>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[44px] text-sm leading-6 text-slate-600">
                  {company.description || company.strengths || "已通過平台審核的咨詢公司。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                    <Users size={13} strokeWidth={2} />
                    {company.lobster_knight_count} 位龍蝦騎士
                  </span>
                  {company.location && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                      <MapPin size={13} strokeWidth={2} />
                      {company.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-green-700">
                    <ShieldCheck size={13} strokeWidth={2} />
                    已入駐
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/companies/${company.id}`} className="btn btn-secondary btn-sm">
                    查看 Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleJoin(company)}
                    disabled={
                      busyCompanyId === company.id ||
                      !!companyState?.active_company ||
                      (companyState?.pending_join_request !== null &&
                        companyState?.pending_join_request !== undefined &&
                        companyState.pending_join_request.company_id !== company.id)
                    }
                    className="btn btn-primary btn-sm"
                  >
                    <Send size={14} strokeWidth={2.3} />
                    {companyState?.active_company?.id === company.id
                      ? "已加入"
                      : companyState?.pending_join_request?.company_id === company.id
                      ? "已提交申請"
                      : busyCompanyId === company.id
                        ? "提交中..."
                        : "申請加入"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
