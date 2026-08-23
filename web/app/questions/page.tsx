"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, MessageSquare, Plus, Tag as TagIcon } from "lucide-react";
import { listQuestions, listTags } from "@/lib/api";
import type { QuestionOut, TagOut } from "@/lib/types";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import PageHero from "@/components/PageHero";
import SidebarNav from "@/components/SidebarNav";

type SortKey = "latest" | "hot" | "open";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "熱門" },
  { key: "open", label: "待解決" },
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [tags, setTags] = useState<TagOut[]>([]);
  const [activeTag, setActiveTag] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTags()
      .then(setTags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    listQuestions(activeTag ? { tag: activeTag } : {})
      .then((p) => setQuestions(p.items))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [activeTag]);

  const filtered = useMemo(() => {
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
    // 排序：「待解決」獨立過濾；「最新 / 熱門」都基於現有結果
    if (sort === "open") {
      list = list.filter((q) => q.status !== "resolved");
    } else if (sort === "hot") {
      list = [...list].sort(
        (a, b) => b.answer_count + b.vote_count - (a.answer_count + a.vote_count),
      );
    }
    return list;
  }, [questions, keyword, sort]);

  const hotTags = tags.slice(0, 4).map((t) => t.name);

  return (
    <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:px-10">
      <SidebarNav />
      <main className="min-w-0 flex-1">
        {/* Page Hero */}
        <PageHero
          variant="warm"
          eyebrow="社區板塊 · COMMUNITY"
          title="問題廣場"
          description="提出 AI 落地中的具體場景，讓 FDE、AI 工程師一起幫你想清楚。"
          primaryCta={{ label: "＋ 提個問題", href: "/questions/new" }}
          search={{
            placeholder: "搜索問題標題、描述或標籤...",
            value: keyword,
            onChange: setKeyword,
          }}
          hotTags={hotTags}
        />

        {/* 篩選 / 排序 Bar */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">全部問題</h2>
            <span className="text-sm text-slate-400">· {filtered.length}</span>
            {activeTag && (
              <button
                type="button"
                onClick={() => setActiveTag("")}
                className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              >
                <TagIcon size={11} strokeWidth={2} />
                {activeTag} ✕
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

        {/* 標籤篩選 */}
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

        {/* 列表 */}
        {loading ? (
          <p className="mt-12 text-sm text-slate-500">加載中...</p>
        ) : filtered.length === 0 ? (
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
            {filtered.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/questions/${q.id}`}
                  className="card card-hover group flex gap-5 p-6"
                >
                  {/* 左側統計：回答數 */}
                  <div className="hidden min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-xl bg-slate-50 px-4 py-4 text-center sm:flex">
                    <span className="text-2xl font-extrabold leading-none text-slate-900">
                      {q.answer_count}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      回答
                    </span>
                  </div>

                  {/* 主內容 */}
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
                        {q.is_anonymous && <span className="badge badge-red">🦞 匿名</span>}
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
      </main>
    </div>
  );
}
