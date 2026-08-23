"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, LifeBuoy, MessageSquare, type LucideIcon } from "lucide-react";

import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import { getActivityFeed } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import type { FeedItemOut } from "@/lib/types";

const KIND_META: Record<FeedItemOut["kind"], { icon: LucideIcon; label: string }> = {
  question: { icon: MessageSquare, label: "提出了一個問題" },
  tutorial: { icon: BookOpen, label: "發布了一篇教程" },
  rescue: { icon: LifeBuoy, label: "救援並採納了回答" },
};

/** 首页「社區正在發生」：最近问题 / 教程 / 被采纳回答的混合动态流。 */
export default function CommunityFeed() {
  const [items, setItems] = useState<FeedItemOut[] | null>(null);

  useEffect(() => {
    getActivityFeed(6)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <section>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
        <h2 className="text-xl font-bold text-slate-900">社區正在發生</h2>
      </div>

      {items === null ? (
        <p className="mt-6 text-sm text-slate-400">加載中…</p>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="還沒有社區動態"
            description="提問、發布教程或採納回答後，會實時出現在這裡。"
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const href =
              item.kind === "tutorial" ? `/tutorials/${item.slug}` : `/questions/${item.id}`;
            const isAnon = item.kind === "question" && !!item.author && item.author.username === "";
            const authorName = item.author?.display_name || item.author?.username || "未知騎士";
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 px-4 py-3 transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-50/40"
                >
                  <Icon size={16} strokeWidth={2} className="shrink-0 text-brand-500" />
                  <Avatar user={item.author} isAnon={isAnon} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm leading-6">
                    <span className="font-medium text-slate-700">{authorName}</span>
                    <span className="text-slate-500"> {meta.label} </span>
                    <span className="font-medium text-slate-800 transition-colors group-hover:text-brand-600">
                      {item.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {timeAgo(item.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
