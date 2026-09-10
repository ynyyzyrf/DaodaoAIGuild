"use client";

import Link from "next/link";
import { BadgeCheck, Search, UserCog, Users } from "lucide-react";

export default function AdminKnightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">龍蝦騎士管理</h1>
        <p className="mt-1 text-sm text-slate-500">確認龍蝦騎士身份，查看騎士資料與正式公司歸屬。</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/users" className="card card-hover p-5">
          <Users size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">用戶列表</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            從用戶管理查看平台成員，進入詳情後確認或取消龍蝦騎士身份。
          </p>
        </Link>
        <div className="card p-5">
          <BadgeCheck size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">身份確認</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            第一階段不做獨立申請單，由平台在用戶詳情中確認龍蝦騎士身份。
          </p>
        </div>
        <div className="card p-5">
          <Search size={24} strokeWidth={1.8} className="text-brand-500" />
          <h2 className="mt-4 text-base font-bold text-slate-900">公司歸屬</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            後續接入正式所屬公司查詢後，這裡展示每位騎士當前所屬公司與歷史記錄。
          </p>
        </div>
      </section>

      <Link href="/admin/users" className="btn btn-primary">
        <UserCog size={16} strokeWidth={2.5} />
        前往用戶管理
      </Link>
    </div>
  );
}
