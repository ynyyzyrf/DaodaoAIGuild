"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Database,
  FileSearch,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Users,
} from "lucide-react";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/admin-auth";
import type { AdminUser } from "@/lib/admin-api";

const NAV_ITEMS = [
  { href: "/admin", label: "仪表板", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/moderation", label: "内容审核", icon: FileSearch },
  { href: "/admin/missions", label: "任务管理", icon: ClipboardList },
  { href: "/admin/sensitive-words", label: "敏感词", icon: Database },
  { href: "/admin/audit", label: "稽核日志", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 管理员在前台登录后即拥有后台权限（后台复用前台登录态）
    const cached = getAdminUser<AdminUser>();
    if (!getAdminToken() || cached?.is_admin !== true) {
      router.replace("/admin/login");
      return;
    }
    setAdmin(cached);
    setLoading(false);
  }, [router]);

  // 登录页不套侧边栏
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-400">加载中...</span>
      </div>
    );
  }

  if (!admin) {
    return null; // 已触发跳转
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-xl ring-1 ring-brand-100">
            🦞
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">DaoDao Admin</div>
            <div className="text-[11px] text-slate-400">管理后台</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 底部：返回前台 + 管理员信息 + 退出 */}
        <div className="border-t border-slate-100 p-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            回到前台
          </Link>
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-700">
                {admin.display_name || admin.username}
              </div>
              <div className="text-[11px] text-slate-400">管理员</div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearAdminSession();
                router.replace("/admin/login");
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="退出登录"
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="ml-56 flex-1 overflow-x-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
