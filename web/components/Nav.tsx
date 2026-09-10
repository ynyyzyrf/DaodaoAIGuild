"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ClipboardList,
  LogOut,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { clearToken, getCurrentUser, subscribeAuth } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";
import Avatar from "@/components/Avatar";
import BrandLogo from "@/components/BrandLogo";
import LevelBadge from "@/components/LevelBadge";
import QuickNav from "@/components/QuickNav";

// 统一 Header 按钮基类：h-11 + inline-flex + items-center + justify-center
// 保证文字 / icon 在所有按钮里都垂直居中（不依赖内部 span 包裹）
const BTN_BASE =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap";

// ── 用户下拉 ───────────────────────────────────────────────────────

function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = (user as { is_admin?: boolean }).is_admin === true;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* 触发器：36px 圆头像，无 Lv 文字、无 chevron；hover 时加淡 brand 圈 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.display_name || user.username || "用戶菜單"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-brand-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        <Avatar
          user={{
            display_name: user.display_name,
            username: user.username,
            avatar_url: user.avatar_url,
          }}
          size={36}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 top-full z-30 mt-2 w-64 p-1.5 shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
        >
          {/* 身份区：頭像 + 名稱 + Lv 徽章 + 管理員標識 */}
          <div className="rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Avatar
                user={{
                  display_name: user.display_name,
                  username: user.username,
                  avatar_url: user.avatar_url,
                }}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">
                  {user.display_name || user.username}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <LevelBadge level={user.level ?? 1} />
                  {isAdmin && (
                    <span className="badge badge-red text-[11px]">管理員</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="mx-2 my-1.5 border-t border-slate-100" />

          {/* 菜單項：個人中心 / 管理後台（僅管理員）/ 帳號設定 */}
          <Link
            href="/me"
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            <UserIcon size={16} strokeWidth={2} />
            個人中心
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
            >
              <Shield size={16} strokeWidth={2} />
              管理後台
            </Link>
          )}

          {/* 分隔线 */}
          <div className="mx-2 my-1.5 border-t border-slate-100" />

          {/* 退出 */}
          <button
            type="button"
            onClick={() => {
              clearToken();
              window.location.href = "/";
            }}
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} strokeWidth={2} />
            退出登入
          </button>
        </div>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────

export default function Nav() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // 管理后台为独立全屏布局，不渲染主站 Nav（docs/3.2.md §3）
  const pathname = usePathname();
  const isAdminArea = pathname.startsWith("/admin");
  useEffect(() => {
    if (isAdminArea) return;
    const refreshUser = () => setUser(getCurrentUser());
    refreshUser();
    const unsubscribe = subscribeAuth(refreshUser);

    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      unsubscribe();
      window.removeEventListener("scroll", onScroll);
    };
  }, [isAdminArea]);

  if (isAdminArea) return null;

  return (
    <header
      className={`sticky top-0 z-20 border-b bg-white transition-shadow ${
        scrolled
          ? "border-[#EEF0F3] shadow-[0_2px_12px_rgba(16,24,40,0.04)]"
          : "border-[#EEF0F3]"
      }`}
    >
      {/* 整條 Header 採用 w-full + justify-between；不再 max-width 居中 */}
      <div className="flex h-[76px] w-full items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* ── Left Group：品牌 ── */}
        <div className="flex min-w-0 items-center gap-8">
          <Link href="/" className="inline-flex h-11 shrink-0 items-center gap-3">
            <BrandLogo />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Daostore <span className="text-brand-500">AI Guild</span>
            </span>
          </Link>

        </div>

        {/* ── Right Group：精簡常駐操作；站內入口收進 QuickNav ── */}
        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <div className="hidden items-center gap-1.5 md:flex">
              <QuickNav />
            </div>
          )}

          <Link
            href={user ? "/companies/new" : "/login?next=%2Fcompanies%2Fnew"}
            className={`${BTN_BASE} hidden border border-slate-200 px-4 text-slate-700 hover:bg-slate-50 sm:inline-flex`}
          >
            <Building2 size={15} strokeWidth={2.2} />
            申請入駐
          </Link>

          <Link
            href={user ? "/orders/new" : "/login?next=%2Forders%2Fnew"}
            className={`${BTN_BASE} bg-brand-500 px-5 text-white hover:bg-brand-600`}
          >
            <ClipboardList size={15} strokeWidth={2.4} />
            提交需求
          </Link>

          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/login"
              className={`${BTN_BASE} border border-slate-200 px-3 text-slate-700 hover:bg-slate-100`}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm">
                👤
              </span>
              <span className="hidden xl:inline">登入</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
