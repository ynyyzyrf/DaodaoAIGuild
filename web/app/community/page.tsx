"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Flame,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import KnightLeaderboard from "@/components/KnightLeaderboard";
import LevelBadge from "@/components/LevelBadge";
import PageHero from "@/components/PageHero";
import SidebarNav from "@/components/SidebarNav";
import { getActivityFeed, listTags } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import type { FeedItemOut, TagOut } from "@/lib/types";

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
  const [tags, setTags] = useState<TagOut[]>([]);

  useEffect(() => {
    getActivityFeed(12)
      .then(setFeed)
      .catch(() => setFeed([]));
    listTags()
      .then(setTags)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:px-10">
      <SidebarNav />
      <main className="min-w-0 flex-1">
        {/* Page Hero */}
        <PageHero
          variant="earth"
          eyebrow="龍蝦社區 · GUILD COMMUNITY"
          title="和正在做 AI 落地的人一起交流"
          description="分享進展、經驗、踩坑與新的發現。"
          rightSlot={
            <Link
              href="/questions/new"
              className="btn btn-primary h-12 px-6 text-base"
            >
              ＋ 加入討論
            </Link>
          }
        />

        {/* 雙欄：Feed + Right Rail */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* 左欄：社區 Feed */}
          <section>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">社區正在發生</h2>
            </div>

            {feed === null ? (
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
                        className="card card-hover group flex min-h-[140px] flex-col gap-3 p-5"
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
                    <Link
                      key={t.slug}
                      href="/questions"
                      className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    >
                      #{t.name}
                    </Link>
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
