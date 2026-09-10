"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, LifeBuoy, MessageSquare, Radio, type LucideIcon } from "lucide-react";

import Avatar from "@/components/Avatar";
import { getActivityFeed } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import type { FeedItemOut } from "@/lib/types";

const ROTATE_MS = 3800;

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

export default function CommunityTicker() {
  const [items, setItems] = useState<FeedItemOut[]>([]);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    getActivityFeed(8)
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  const item = items[current];
  const meta = useMemo(() => (item ? KIND_META[item.kind] : null), [item]);

  if (!item || !meta) {
    return (
      <section className="mx-auto max-w-[1220px] px-4 pt-4 sm:px-6 lg:px-10">
        <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-400">
          <Radio size={16} strokeWidth={2} className="mr-2 text-brand-500" />
          社區正在發生，動態載入中...
        </div>
      </section>
    );
  }

  const Icon = meta.icon;
  const href = meta.href(item);
  const authorName = item.author?.display_name || item.author?.username || "未知騎士";
  const isAnon = item.kind === "question" && !!item.author && item.author.username === "";

  return (
    <section className="mx-auto max-w-[1220px] px-4 pt-4 sm:px-6 lg:px-10">
      <Link
        href={href}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="group flex min-h-12 items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:border-brand-200 hover:bg-brand-50/35"
      >
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-slate-900">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          社區正在發生
        </span>
        <span className="h-5 w-px shrink-0 bg-slate-200" />
        <Icon size={16} strokeWidth={2} className="shrink-0 text-brand-500" />
        <Avatar user={item.author} isAnon={isAnon} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm leading-6">
          <span className="font-medium text-slate-700">{authorName}</span>
          <span className="text-slate-500"> {meta.label} </span>
          <span className="font-semibold text-slate-900 transition-colors group-hover:text-brand-600">
            {item.title}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
          {timeAgo(item.created_at)}
        </span>
        <ArrowRight
          size={16}
          strokeWidth={2.3}
          className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500"
        />
      </Link>
    </section>
  );
}
