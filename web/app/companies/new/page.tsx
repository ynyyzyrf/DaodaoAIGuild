"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, Send } from "lucide-react";

import RequireAuth from "@/components/RequireAuth";
import { createCompany, submitCompany } from "@/lib/api";

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [serviceFields, setServiceFields] = useState("");
  const [strengths, setStrengths] = useState("");
  const [cases, setCases] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const company = await createCompany({
        name,
        logo_url: logoUrl,
        location,
        description,
        service_fields: serviceFields,
        strengths,
        cases,
        contact_name: contactName,
        contact_email: contactEmail,
      });
      const submitted = await submitCompany(company.id);
      router.push(`/companies/${submitted.id}?submitted=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-10">
      <Link href="/companies" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} strokeWidth={2} />
        返回公司名錄
      </Link>

      <header className="mt-6">
        <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">
          <Building2 size={16} strokeWidth={2} />
          咨詢公司入駐
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">提交公司資料</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          提交後進入平台審核；審核通過後，申請人會成為該公司的 Owner。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label" htmlFor="company-name">
            公司名稱 <span className="text-brand-500">*</span>
          </label>
          <input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1"
            placeholder="例如：ABC Consulting"
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company-logo">
              Logo URL
            </label>
            <input
              id="company-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="input mt-1"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="label" htmlFor="company-location">
              所在地
            </label>
            <input
              id="company-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input mt-1"
              placeholder="城市 / 地區"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="company-description">
            公司介紹
          </label>
          <textarea
            id="company-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input mt-1"
            placeholder="公司定位、團隊背景、服務方式..."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company-services">
              服務領域
            </label>
            <textarea
              id="company-services"
              value={serviceFields}
              onChange={(e) => setServiceFields(e.target.value)}
              rows={4}
              className="input mt-1"
              placeholder="RAG、Agent、企業自動化..."
            />
          </div>
          <div>
            <label className="label" htmlFor="company-strengths">
              擅長方向
            </label>
            <textarea
              id="company-strengths"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={4}
              className="input mt-1"
              placeholder="行業經驗、工具能力、交付方法..."
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="company-cases">
            過往案例
          </label>
          <textarea
            id="company-cases"
            value={cases}
            onChange={(e) => setCases(e.target.value)}
            rows={4}
            className="input mt-1"
            placeholder="可公開的案例、作品或成果描述"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-name">
              聯繫人 <span className="text-brand-500">*</span>
            </label>
            <input
              id="contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input mt-1"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="contact-email">
              聯繫方式 <span className="text-brand-500">*</span>
            </label>
            <input
              id="contact-email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="input mt-1"
              placeholder="email / phone / wechat"
              required
            />
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          <Send size={16} strokeWidth={2.5} />
          {loading ? "提交中..." : "提交入駐審核"}
        </button>
      </form>
      </main>
    </RequireAuth>
  );
}
