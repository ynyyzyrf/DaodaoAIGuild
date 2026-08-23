"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Home,
  MessageSquare,
  Tags as TagsIcon,
  Trophy,
  Users,
} from "lucide-react";
import { listCategories, listTags } from "@/lib/api";
import {
  getCollapsed,
  setCollapsed,
  subscribeCollapsed,
} from "@/lib/sidebar-state";
import { DAOCLAW_COMMUNITY } from "@/lib/site";

const MAIN_ITEMS = [
  { href: "/", label: "首页", icon: Home, match: "/" },
  { href: "/questions", label: "问题广场", icon: MessageSquare, match: "/questions" },
  { href: "/tutorials", label: "龍蝦学院", icon: BookOpen, match: "/tutorials" },
  { href: DAOCLAW_COMMUNITY.path, label: "龍蝦社区", icon: Users, match: DAOCLAW_COMMUNITY.path },
];

const W_EXPANDED = "w-[240px]";
const W_COLLAPSED = "w-[68px]";

/**
 * 左侧导航：支持展开 / 收起，状态持久化到 localStorage。
 *
 * - 展开：240px，文字 + icon + section header
 * - 收起：68px，仅 icon，title 作为原生 tooltip
 * - 切换动效：width 200ms ease-out
 *
 * 移除了「有個 AI 落地的坑」营销卡：与 Header 全局提問 CTA 重复。
 */
export default function SidebarNav() {
  const pathname = usePathname();
  const [tags, setTags] = useState<{ slug: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [collapsed, setLocalCollapsed] = useState(false);

  useEffect(() => {
    setLocalCollapsed(getCollapsed());
    return subscribeCollapsed(setLocalCollapsed);
  }, []);

  useEffect(() => {
    listTags()
      .then((res) => setTags(res.map((t) => ({ slug: t.slug, name: t.name }))))
      .catch(() => {});
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  function toggle() {
    setCollapsed(!collapsed);
  }

  return (
    <aside
      className={`hidden shrink-0 transition-[width] duration-200 ease-out lg:block ${
        collapsed ? W_COLLAPSED : W_EXPANDED
      }`}
    >
      <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col overflow-y-auto pb-10 text-sm">
        {/* 收起 / 展开按钮 */}
        <div className={`flex ${collapsed ? "justify-center" : "justify-end"} px-2`}>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* 主导航 */}
        <div className="mt-2">
          {!collapsed && (
            <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              导航
            </h3>
          )}
          <ul className="mt-2 flex flex-col gap-0.5 px-2">
            {MAIN_ITEMS.map(({ href, label, icon: Icon, match }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === match || pathname.startsWith(`${match}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-xl py-2 font-medium transition-colors ${
                      collapsed ? "justify-center px-2" : "px-3"
                    } ${
                      active
                        ? "bg-brand-50 text-brand-600"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {active && !collapsed && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-500" />
                    )}
                    {active && collapsed && (
                      <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500" />
                    )}
                    <Icon size={16} strokeWidth={2} />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 教程分类：展开时显示全列表；收起时仅留入口图标 */}
        <div className="mt-6">
          {!collapsed && categories.length > 0 && (
            <>
              <h3 className="flex items-center gap-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BookOpen size={12} strokeWidth={2} />
                教程分类
              </h3>
              <ul className="mt-2 flex flex-col gap-0.5 px-2">
                {categories.slice(0, 4).map((c) => (
                  <li key={c}>
                    <Link
                      href="/tutorials"
                      className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-300 transition-colors group-hover:bg-brand-500" />
                      {c}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/tutorials"
                    className="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 transition-colors group-hover:bg-brand-400" />
                    更多 ›
                  </Link>
                </li>
              </ul>
            </>
          )}
          {collapsed && (
            <ul className="flex flex-col gap-0.5 px-2">
              <li>
                <Link
                  href="/tutorials"
                  title="教程分类"
                  aria-label="教程分类"
                  className="flex items-center justify-center rounded-xl px-2 py-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  <BookOpen size={16} strokeWidth={2} />
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* 热门标签：仅展开时显示（收起后太拥挤，藏在「教程分类」之后） */}
        {tags.length > 0 && !collapsed && (
          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <TagsIcon size={12} strokeWidth={2} />
              热门标签
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5 px-3">
              {tags.slice(0, 10).map((t) => (
                <Link
                  key={t.slug}
                  href="/questions"
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 社区 */}
        <div className="mt-6">
          {!collapsed && (
            <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              社区
            </h3>
          )}
          <ul className="mt-2 flex flex-col gap-0.5 px-2">
            <li>
              <Link
                href="/#rankings"
                title={collapsed ? "騎士排行榜" : undefined}
                aria-label={collapsed ? "騎士排行榜" : undefined}
                className={`group relative flex items-center gap-2 rounded-xl py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 ${
                  collapsed ? "justify-center px-2" : "px-3"
                }`}
              >
                <Trophy size={16} strokeWidth={2} className="text-amber-500" />
                {!collapsed && <span>騎士排行榜</span>}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
