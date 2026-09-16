"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, Plus, Search, Tag as TagIcon } from "lucide-react";

import Avatar from "@/components/Avatar";
import { ChannelHero, ChannelSearch, ChannelToolbar } from "@/components/ChannelShell";
import EmptyState from "@/components/EmptyState";
import { listQuestions, listTags } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import type { QuestionOut, TagOut } from "@/lib/types";

type SortKey = "latest" | "hot" | "open";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "熱門" },
  { key: "open", label: "待解決" },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function questionStatus(q: QuestionOut) {
  if (q.status === "resolved") return { label: "已解決", dot: "bg-emerald-500", text: "text-emerald-700" };
  return { label: "待解決", dot: "bg-amber-500", text: "text-slate-500" };
}

function participantKey(q: QuestionOut, index: number) {
  return `${q.id}-participant-${index}`;
}

function questionParticipants(q: QuestionOut) {
  const rows = [
    { user: q.author, isAnon: q.is_anonymous },
    ...q.answers.map((answer) => ({ user: answer.author, isAnon: false })),
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.isAnon ? `anon-${q.id}` : row.user?.username || row.user?.display_name || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

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
    let cancelled = false;
    setLoading(true);
    listQuestions(activeTag ? { tag: activeTag } : {})
      .then((p) => {
        if (!cancelled) setQuestions(p.items);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
    if (sort === "open") {
      list = list.filter((q) => q.status !== "resolved");
    } else if (sort === "hot") {
      list = [...list].sort(
        (a, b) => b.answer_count + b.vote_count - (a.answer_count + a.vote_count),
      );
    }
    return list;
  }, [questions, keyword, sort]);

  const metrics = [
    { label: "問題數", value: formatCount(questions.length), icon: MessageCircle },
    { label: "已解決", value: formatCount(questions.filter((q) => q.status === "resolved").length), icon: CheckCircle2 },
    { label: "回答數", value: formatCount(questions.reduce((sum, q) => sum + q.answer_count, 0)), icon: ArrowRight },
    { label: "標籤數", value: formatCount(tags.length), icon: TagIcon },
  ];

  return (
    <main className="bg-[#f6f8fb] pb-16">
      <ChannelHero
        title="問題廣場"
        subtitle="把 AI 落地中的具體問題沉澱成可討論、可回答、可追蹤的知識。"
        image="/banners/banner-3.png?v=20260828"
        metrics={metrics}
        note={
          <>
            <p className="text-sm font-black text-[#35120d]">社區問答，不混成正式需求。</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">這裡沉澱問題和解法；正式商機仍然進機會池。</p>
            <Link href="/questions/new" className="btn btn-primary mt-4 h-10">
              <Plus size={15} strokeWidth={2.5} />
              提個問題
            </Link>
          </>
        }
      >
        <ChannelSearch
          icon={Search}
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索問題標題、描述或標籤..."
        />
      </ChannelHero>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <ChannelToolbar>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">全部問題</h2>
            <span className="text-sm font-medium text-slate-400">{formatCount(filtered.length)} 個結果</span>
            {activeTag && (
              <button
                type="button"
                onClick={() => setActiveTag("")}
                className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              >
                <TagIcon size={11} strokeWidth={2} />
                {activeTag} X
              </button>
            )}
            {tags.length > 0 && (
              <div className="ml-0 flex flex-wrap gap-1.5 lg:ml-3">
                <button onClick={() => setActiveTag("")} className={`chip ${activeTag === "" ? "chip-active" : "chip-idle"}`}>
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
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSort(o.key)}
                className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold shadow-sm transition-colors ${
                  sort === o.key
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-600"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </ChannelToolbar>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">同步最新問題...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={keyword || activeTag ? "沒有匹配的問題" : "還沒有問題"}
              description={
                keyword || activeTag
                  ? "換個關鍵詞或標籤試試。"
                  : "遇到 AI 落地的坑？來提第一個問題。"
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
          <ul className="question-row-list overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filtered.map((q) => {
              const status = questionStatus(q);
              const participants = questionParticipants(q);
              const primaryTag = q.tags[0] ?? "Daostore";
              const authorName = q.is_anonymous
                ? "匿名龍蝦騎士"
                : q.author?.display_name || q.author?.username || "未知";
              return (
                <li key={q.id} className="border-b border-slate-100 last:border-b-0">
                  <Link
                    href={`/questions/${q.id}`}
                    className="group grid min-h-[92px] gap-4 px-5 py-4 transition-colors hover:bg-brand-50/35 md:grid-cols-[minmax(0,1fr)_132px_270px_86px] md:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[20px] font-semibold leading-snug text-slate-950 transition-colors group-hover:text-brand-600">
                        {q.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                        <span>互動交流</span>
                        <span className="text-slate-300">·</span>
                        <span>#{primaryTag}</span>
                        <span className="text-slate-300">·</span>
                        <span>{authorName}</span>
                        <span className="text-slate-300">·</span>
                        <span>{timeAgo(q.created_at)}</span>
                      </div>
                      {q.tags.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {q.tags.slice(1, 4).map((t) => (
                            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center md:justify-center">
                      <div className="flex -space-x-2">
                        {participants.map((participant, index) => (
                          <Avatar
                            key={participantKey(q, index)}
                            user={participant.user}
                            isAnon={participant.isAnon}
                            size={30}
                            className="border-2 border-white shadow-sm"
                          />
                        ))}
                      </div>
                      {participants.length === 0 && <span className="text-xs text-slate-400">暫無參與</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm md:text-right">
                      <div>
                        <div className="font-semibold text-slate-900">{formatCount(q.answer_count)}</div>
                        <div className="mt-0.5 text-xs text-slate-400">回答</div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{formatCount(q.view_count)}</div>
                        <div className="mt-0.5 text-xs text-slate-400">瀏覽</div>
                      </div>
                      <div>
                        <div className="font-medium text-slate-500">{timeAgo(q.updated_at)}</div>
                        <div className="mt-0.5 text-xs text-slate-400">更新</div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 text-xs font-semibold ${status.text} md:justify-end`}>
                      <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                      <span>{status.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
