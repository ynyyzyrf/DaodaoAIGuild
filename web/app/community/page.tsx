"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Filter,
  Flame,
  LifeBuoy,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Send,
  Tag as TagIcon,
  type LucideIcon,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import KnightLeaderboard from "@/components/KnightLeaderboard";
import LevelBadge from "@/components/LevelBadge";
import { getActivityFeed, listQuestions, listTags } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import type { FeedItemOut, QuestionOut, TagOut } from "@/lib/types";

type SortKey = "latest" | "hot" | "open";
type CommunityTab = "feed" | "questions" | "cases" | "rankings";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "熱門" },
  { key: "open", label: "待解決" },
];

const COMMUNITY_TABS: Array<{ key: CommunityTab; label: string }> = [
  { key: "feed", label: "動態" },
  { key: "cases", label: "實戰案例" },
  { key: "questions", label: "問答" },
  { key: "rankings", label: "FDE 榜" },
];

const KIND_META: Record<
  FeedItemOut["kind"],
  { icon: LucideIcon; label: string; href: (item: FeedItemOut) => string }
> = {
  question: {
    icon: MessageSquare,
    label: "提出了一個問題",
    href: (item) => `/questions/${item.id}`,
  },
  tutorial: {
    icon: BookOpen,
    label: "發布了一篇教程",
    href: (item) => `/tutorials/${item.slug}`,
  },
  rescue: {
    icon: LifeBuoy,
    label: "救援並採納了回答",
    href: (item) => `/questions/${item.id}`,
  },
};

/**
 * 龍蝦社區頁（docs/3.0.md §4）。
 * 定位：Guild 成員交流中心。展示最近社區動態 + 騎士排行 + 熱門標籤。
 * 原 Skill/MCP 佔位卡已移除：作為社區 Portal 來看，那兩張卡與定位不符，後續由專門頁面承載。
 */
export default function CommunityPage() {
  const [feed, setFeed] = useState<FeedItemOut[] | null>(null);
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [tags, setTags] = useState<TagOut[]>([]);
  const [activeTab, setActiveTab] = useState<CommunityTab>("questions");
  const [activeTag, setActiveTag] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [questionLoading, setQuestionLoading] = useState(true);

  useEffect(() => {
    getActivityFeed(12)
      .then(setFeed)
      .catch(() => setFeed([]));
    listTags()
      .then(setTags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setQuestionLoading(true);
    listQuestions(activeTag ? { tag: activeTag } : {})
      .then((p) => setQuestions(p.items))
      .catch(() => setQuestions([]))
      .finally(() => setQuestionLoading(false));
  }, [activeTag]);

  const filteredQuestions = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let list = questions;
    if (kw) {
      list = list.filter(
        (q) =>
          q.title.toLowerCase().includes(kw) ||
          q.description.toLowerCase().includes(kw) ||
          q.tags.some((t) => t.toLowerCase().includes(kw)),
      );
    }
    if (sort === "open") {
      list = list.filter((q) => q.status !== "resolved");
    } else if (sort === "hot") {
      list = [...list].sort(
        (a, b) => b.answer_count + b.vote_count - (a.answer_count + a.vote_count),
      );
    }
    return list;
  }, [questions, keyword, sort]);

  return (
    <div className="bg-[#f6f8fb] pb-14">
      <main>
        <section className="relative isolate overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 -z-10">
            <img src="/banners/banner-1.png?v=20260828" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.86)_58%,rgba(255,255,255,0.55)_100%)]" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-10">
            <div className="grid gap-7 lg:grid-cols-[1fr_420px] lg:items-end">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#35120d] sm:text-5xl">問題廣場</h1>
                <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-700">
                  提出 AI 落地中的具體場景，讓 FDE、AI 工程師一起幫你想清楚。
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/94 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                <label className="flex items-center gap-3">
                  <Search size={19} strokeWidth={2} className="ml-2 shrink-0 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      if (activeTab !== "questions") setActiveTab("questions");
                    }}
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="搜尋問題、內容或標籤..."
                  />
                  <Link href="/questions/new" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-black text-white">
                    發佈內容
                    <Send size={14} strokeWidth={2.4} />
                  </Link>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 grid max-w-6xl gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <MessagesSquare size={21} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">龍蝦房間</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                基礎討論空間，用於社區交流、問題沉澱與小範圍同步。
              </p>
            </div>
          </div>
          <Link href="/rooms" className="btn btn-primary">
            進入房間
          </Link>
        </section>

        {/* 雙欄：Feed + Right Rail */}
        <div className="mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-10">
          {/* 左欄：社區 Feed */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
                </span>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                  {activeTab === "questions" ? "問答" : activeTab === "rankings" ? "FDE 榜" : activeTab === "cases" ? "實戰案例" : "動態"}
                </h2>
              </div>
              <div className="flex gap-2">
                {COMMUNITY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`chip ${activeTab === tab.key ? "chip-active" : "chip-idle"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "questions" ? (
              <>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-bold text-slate-900">全部問題</h3>
                    <span className="text-sm text-slate-400">· {filteredQuestions.length}</span>
                    {activeTag && (
                      <button
                        type="button"
                        onClick={() => setActiveTag("")}
                        className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        <TagIcon size={11} strokeWidth={2} />
                        {activeTag} x
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setSort(o.key)}
                        className={`chip ${sort === o.key ? "chip-active" : "chip-idle"}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="mt-4 flex items-start gap-3 overflow-x-auto pb-1">
                    <span className="inline-flex shrink-0 items-center gap-1.5 pt-1.5 text-xs font-medium text-slate-500">
                      <Filter size={12} strokeWidth={2} />
                      標籤
                    </span>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button
                        onClick={() => setActiveTag("")}
                        className={`chip ${activeTag === "" ? "chip-active" : "chip-idle"}`}
                      >
                        全部
                      </button>
                      {tags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTag(t.slug)}
                          className={`chip ${activeTag === t.slug ? "chip-active" : "chip-idle"}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {questionLoading ? (
                  <p className="mt-12 text-sm text-slate-500">加載中...</p>
                ) : filteredQuestions.length === 0 ? (
                  <div className="mt-10">
                    <EmptyState
                      title={keyword || activeTag ? "沒有匹配的問題" : "還沒有問題"}
                      description={
                        keyword || activeTag
                          ? "換個關鍵詞或標籤試試。"
                          : "遇到 AI 落地的坑？來提第一個問題，召喚騎士。"
                      }
                      action={
                        !keyword && !activeTag ? (
                          <Link href="/questions/new" className="btn btn-primary btn-sm">
                            <Plus size={15} strokeWidth={2.5} />
                            提第一個問題
                          </Link>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <ul className="mt-8 space-y-4">
                    {filteredQuestions.map((q) => (
                      <li key={q.id}>
                        <Link
                          href={`/questions/${q.id}`}
                          className="card card-hover group flex gap-5 p-6"
                        >
                          <div className="hidden min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-xl bg-slate-50 px-4 py-4 text-center sm:flex">
                            <span className="text-2xl font-extrabold leading-none text-slate-900">
                              {q.answer_count}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              回答
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="line-clamp-2 text-[17px] font-bold text-slate-900 transition-colors group-hover:text-brand-600 sm:text-lg">
                                {q.title}
                              </h3>
                              {q.status === "resolved" && (
                                <span className="badge badge-green shrink-0">✓ 已解決</span>
                              )}
                            </div>
                            {q.description && (
                              <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-slate-600">
                                {q.description}
                              </p>
                            )}
                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <Avatar user={q.author} isAnon={q.is_anonymous} size={20} />
                                <span className="font-medium text-slate-700">
                                  {q.author?.display_name ?? "未知"}
                                </span>
                                {q.is_anonymous && <span className="badge badge-red">匿名</span>}
                              </span>
                              <span className="inline-flex items-center gap-1 sm:hidden">
                                <MessageSquare size={12} strokeWidth={2} />
                                {q.answer_count} 回答
                              </span>
                              <span className="text-slate-500">{q.view_count} 瀏覽</span>
                              <div className="flex flex-wrap gap-1.5">
                                {q.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : activeTab === "rankings" ? (
              <div className="mt-6">
                <KnightLeaderboard />
              </div>
            ) : activeTab === "cases" ? (
              <div className="mt-6">
                <EmptyState
                  title="還沒有實戰案例"
                  description="發布教程或案例後，會沉澱到這裡。"
                />
              </div>
            ) : feed === null ? (
              <p className="mt-6 text-sm text-slate-400">加載中…</p>
            ) : feed.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="還沒有社區動態"
                  description="提問、發布教程或採納回答後，會實時出現在這裡。"
                />
              </div>
            ) : (
              <ul className="mt-5 space-y-4">
                {feed.map((item) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  const href = meta.href(item);
                  const authorName =
                    item.author?.display_name || item.author?.username || "未知騎士";
                  const authorLevel = item.author?.level;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={href}
                        className="card card-hover group flex min-h-[140px] flex-col gap-3 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.04)]"
                      >
                        {/* 第一行：kind icon + Avatar + 用戶名 + Level + time */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                              <Icon size={15} strokeWidth={2} />
                            </span>
                            <Avatar
                              user={item.author}
                              isAnon={item.kind === "question" && !!item.author}
                              size={28}
                            />
                            <span className="min-w-0 truncate text-sm font-medium text-slate-700">
                              {authorName}
                            </span>
                            {authorLevel !== undefined && (
                              <LevelBadge level={authorLevel} />
                            )}
                            <span className="hidden text-xs text-slate-400 sm:inline">
                              · {meta.label}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400">
                            {timeAgo(item.created_at)}
                          </span>
                        </div>

                        {/* 第二行：title */}
                        <h3 className="line-clamp-2 text-[15px] font-semibold leading-relaxed text-slate-800 transition-colors group-hover:text-brand-600">
                          {item.title}
                        </h3>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 右欄 Rail */}
          <aside className="space-y-6">
            {/* 熱門話題 */}
            {tags.length > 0 && (
              <section className="card p-5">
                <div className="flex items-center gap-2">
                  <Flame size={16} strokeWidth={2} className="text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900">熱門話題</h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags.slice(0, 10).map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => {
                        setActiveTag(t.slug);
                        setActiveTab("questions");
                      }}
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    >
                      #{t.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 騎士排行榜（共用首頁組件，id=rankings 保留） */}
            <KnightLeaderboard />
          </aside>
        </div>
      </main>
    </div>
  );
}
