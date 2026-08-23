"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Eye, ThumbsUp } from "lucide-react";
import { getTutorial, likeTutorial } from "@/lib/api";
import type { TutorialDetailOut } from "@/lib/types";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";

export default function TutorialDetailPage() {
  const params = useParams();
  const slug = String(params.slug);

  const [tutorial, setTutorial] = useState<TutorialDetailOut | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTutorial(slug)
      .then(setTutorial)
      .catch(() => setNotFound(true));
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/tutorials" className="btn btn-ghost btn-sm -ml-2 text-slate-500">
        <ArrowLeft size={15} strokeWidth={2} />
        返回龍蝦学院
      </Link>

      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-red">{tutorial.category}</span>
          <span className="text-xs text-slate-400">{tutorial.view_count} 阅读</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{tutorial.title}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Avatar user={tutorial.author} size={26} />
            <span className="font-medium text-slate-700">{tutorial.author?.username ?? "未知"}</span>
          </span>
          <button onClick={handleLike} className="btn btn-secondary btn-sm">
            <ThumbsUp size={15} strokeWidth={2} />
            赞 {tutorial.like_count}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <article className="card markdown mt-5 p-6 sm:p-8">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{tutorial.content}</ReactMarkdown>
      </article>
    </main>
  );
}
