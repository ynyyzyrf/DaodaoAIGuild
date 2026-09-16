"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Bookmark,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  Eye,
  ExternalLink,
  FileText,
  MessageCircle,
  PenLine,
  Star,
  ThumbsUp,
} from "lucide-react";
import { getTutorial, likeTutorial, listTutorials } from "@/lib/api";
import type { TutorialDetailOut, TutorialOut } from "@/lib/types";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, " ")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getReadingMinutes(content: string) {
  const plainText = stripMarkdown(content);
  return Math.max(1, Math.ceil(plainText.length / 500));
}

function formatDate(value: string) {
  if (!value) return "未記錄";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getContentHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.match(/^#{2,3}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading))
    .slice(0, 6);
}

function TutorialVideoPlayer({ tutorial }: { tutorial: TutorialDetailOut }) {
  if (!tutorial.video_url) return null;

  const title = tutorial.video_title || "教程视频";
  if (tutorial.video_provider === "direct") {
    return (
      <section className="mt-8 overflow-hidden rounded bg-slate-950 shadow-sm ring-1 ring-slate-200">
        <video
          src={tutorial.video_url}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
        <div className="flex items-center px-4 py-3 text-sm text-slate-200">
          <span className="line-clamp-1 font-medium">{title}</span>
        </div>
      </section>
    );
  }

  if (tutorial.video_embed_url) {
    return (
      <section className="mt-8 overflow-hidden rounded bg-slate-950 shadow-sm ring-1 ring-slate-200">
        <iframe
          src={tutorial.video_embed_url}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          className="aspect-video w-full border-0 bg-black"
        />
      </section>
    );
  }

  return (
    <section className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <a
        href={tutorial.video_url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        打开外部视频
        <ExternalLink size={14} strokeWidth={2} />
      </a>
    </section>
  );
}

export default function TutorialDetailPage() {
  const params = useParams();
  const slug = String(params.slug);

  const [tutorial, setTutorial] = useState<TutorialDetailOut | null>(null);
  const [related, setRelated] = useState<TutorialOut[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTutorial(slug)
      .then(setTutorial)
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    listTutorials({ page_size: 6 })
      .then((p) => setRelated(p.items.filter((item) => item.slug !== slug).slice(0, 4)))
      .catch(() => setRelated([]));
  }, [slug]);

  async function handleLike() {
    if (!tutorial) return;
    try {
      const r = await likeTutorial(tutorial.id);
      setTutorial((prev) => (prev ? { ...prev, like_count: r.count } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          icon="🦞"
          title="教程不存在"
          description="该教程可能已被删除或不存在。"
          action={
            <Link href="/tutorials" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} strokeWidth={2} />
              返回龍蝦学院
            </Link>
          }
        />
      </main>
    );
  }

  if (!tutorial) {
    return <main className="mx-auto max-w-3xl px-6 py-20 text-slate-500">加载中...</main>;
  }

  const authorName =
    tutorial.author?.display_name || tutorial.author?.username || "未知作者";
  const readingMinutes = getReadingMinutes(tutorial.content);
  const headings = getContentHeadings(tutorial.content);
  const plainContent = stripMarkdown(tutorial.content);
  const summary =
    tutorial.summary ||
    (plainContent
      ? `${plainContent.slice(0, 110)}${plainContent.length > 110 ? "..." : ""}`
      : "這篇教程還在整理中，先收藏起來，後續可以補充完整的操作步驟與案例。");
  const tocItems = headings.length ? headings : ["正文內容", "實戰筆記", "寫在最後"];

  return (
    <main className="mx-auto grid max-w-[1480px] grid-cols-1 gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[72px_minmax(0,920px)_320px]">
      <aside className="hidden pt-24 xl:block">
        <div className="sticky top-24 flex flex-col items-center gap-5">
          <button
            onClick={handleLike}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-brand-600 hover:ring-brand-200"
            title="讚"
          >
            <ThumbsUp size={24} strokeWidth={2.2} />
            <span className="absolute -right-2 -top-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
              {tutorial.like_count}
            </span>
          </button>
          <button
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"
            title="評論"
          >
            <MessageCircle size={24} strokeWidth={2.2} />
            <span className="absolute -right-2 -top-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
              0
            </span>
          </button>
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"
            title="收藏"
          >
            <Star size={24} strokeWidth={2.2} />
          </button>
        </div>
      </aside>

      <article className="min-w-0 rounded bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200 sm:px-10 sm:py-10">
        <Link
          href="/tutorials"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          返回龍蝦學院
        </Link>

        <header>
          <h1 className="break-words text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
            {tutorial.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 sm:text-base">
            <span className="font-medium text-slate-800">{authorName}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={16} strokeWidth={2} />
              {formatDate(tutorial.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye size={16} strokeWidth={2} />
              {tutorial.view_count.toLocaleString()} 閱讀
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={16} strokeWidth={2} />
              閱讀 {readingMinutes} 分鐘
            </span>
          </div>

          <TutorialVideoPlayer tutorial={tutorial} />
        </header>

        <section className="mt-8">
          <blockquote className="mb-10 border-l-4 border-slate-300 bg-slate-50 px-6 py-5 text-lg leading-relaxed text-slate-600">
            {summary}
          </blockquote>
          {tutorial.content.trim() ? (
            <div className="markdown text-[18px] leading-[1.95] text-slate-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{tutorial.content}</ReactMarkdown>
            </div>
          ) : (
            <EmptyState
              icon="📘"
              title="正文還在整理中"
              description="這篇教程已建立條目，可以稍後補上完整操作步驟、截圖和案例。"
            />
          )}
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 xl:hidden">
          <button onClick={handleLike} className="btn btn-primary">
            <ThumbsUp size={15} strokeWidth={2} />
            讚 {tutorial.like_count}
          </button>
          <Link href="/tutorials/new" className="btn btn-secondary">
            <PenLine size={15} strokeWidth={2} />
            寫教程
          </Link>
          <Link href="/tutorials" className="btn btn-secondary">
            返回學院
          </Link>
        </div>
      </article>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-4">
            <Avatar user={tutorial.author} size={58} />
            <div className="min-w-0">
              <div className="truncate text-xl font-bold text-slate-900">{authorName}</div>
              <div className="mt-1 text-sm text-slate-500">
                {tutorial.author?.bio || "龍蝦學院教程作者"}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-slate-950">
                {tutorial.author?.level ?? 1}
              </div>
              <div className="text-xs text-slate-500">等級</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-950">
                {tutorial.view_count.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">閱讀</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-950">
                {tutorial.like_count}
              </div>
              <div className="text-xs text-slate-500">讚</div>
            </div>
          </div>
        </section>

        <section className="rounded bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText size={18} strokeWidth={2} className="text-brand-500" />
              目錄
            </div>
            <span className="text-sm text-slate-400">收起</span>
          </div>
          <div className="mt-5 space-y-3">
            {tocItems.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="line-clamp-1 text-[15px] leading-relaxed text-slate-600"
              >
                {index + 1}. {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 text-lg font-bold text-slate-900">
            <BookOpenCheck size={18} strokeWidth={2} className="text-brand-500" />
            相關推薦
          </div>
          <div className="mt-5 space-y-4">
            {related.length > 0 ? (
              related.map((item) => (
                <Link key={item.id} href={`/tutorials/${item.slug}`} className="block group">
                  <div className="line-clamp-2 text-[15px] font-medium leading-relaxed text-slate-800 group-hover:text-brand-600">
                    {item.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {item.view_count.toLocaleString()}閱讀 · {item.like_count}點讚
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm leading-relaxed text-slate-500">
                暫時沒有更多教程，先把這篇內容補完整。
              </p>
            )}
          </div>
        </section>

        <section className="rounded bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Bookmark size={18} strokeWidth={2} className="text-brand-500" />
            精選內容
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
            將企業微信、Agent 工作流、交付案例整理成教程，後續可以直接沉澱到龍蝦學院。
          </p>
          <Link href="/tutorials/new" className="btn btn-secondary mt-5 w-full">
            <PenLine size={15} strokeWidth={2} />
            寫一篇實戰教程
          </Link>
        </section>
      </aside>

      {error && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded bg-red-50 px-4 py-2 text-sm text-red-600 shadow-sm ring-1 ring-red-100">
          {error}
        </div>
      )}
    </main>
  );
}
