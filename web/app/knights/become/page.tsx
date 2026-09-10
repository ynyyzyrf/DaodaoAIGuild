"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardCheck, UserRoundCheck } from "lucide-react";

export default function BecomeKnightPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-10">
      <header className="border-b border-slate-100 pb-8">
        <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600">
          <UserRoundCheck size={16} strokeWidth={2} />
          成為龍蝦騎士
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">先完善 Profile，再由平台確認身份</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          第一階段暫不提供獨立的龍蝦騎士申請單。平台確認龍蝦騎士身份後，用戶即可擁有並完善龍蝦騎士 Profile。
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <ClipboardCheck size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">1. 完善個人資料</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            補充展示名稱、頭像、簡介與擅長方向，讓平台與公司能理解你的能力。
          </p>
        </div>
        <div className="card p-5">
          <BadgeCheck size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">2. 平台確認身份</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            龍蝦騎士身份由平台確認。通過後，你可以申請加入一家正式入駐的咨詢公司。
          </p>
        </div>
        <div className="card p-5">
          <ArrowRight size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">3. 申請加入公司</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            一個龍蝦騎士同一時間只能申請一家公司，正式所屬公司最多也只能有一家。
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/me" className="btn btn-primary">
          前往個人中心
        </Link>
        <Link href="/companies" className="btn btn-secondary">
          查看咨詢公司
        </Link>
      </div>
    </main>
  );
}
