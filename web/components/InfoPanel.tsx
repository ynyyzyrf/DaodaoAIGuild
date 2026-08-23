"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Lock,
  MessageSquare,
  MessageSquareText,
  ThumbsUp,
  X,
  Sparkles,
} from "lucide-react";
import type {
  QuestionOut,
  TutorialOut,
  UserProfileOut,
} from "@/lib/types";
import LevelBadge from "@/components/LevelBadge";
import EmptyState from "@/components/EmptyState";
import Badge3D from "@/components/3d/Badge3D";

// 成就 code → 3D 徽章模型。Desktop 的 10 个 Tripo GLB 按目录顺序命名（1~10），
// 与 gamification.ACHIEVEMENTS 目录序一一对应（first_question → 1.glb … hundred_favorites → 10.glb）。
// 若某枚徽章想换模型，改这里的值即可。
const ACHIEVEMENT_BADGE_MODEL: Record<string, string> = {
  first_question: "/badges/1.glb",
  first_answer: "/badges/2.glb",
  first_rescue: "/badges/3.glb",
  ten_rescue: "/badges/4.glb",
  knowledge_sower: "/badges/5.glb",
  knowledge_contributor: "/badges/6.glb",
  rising_star: "/badges/7.glb",
  community_elite: "/badges/8.glb",
  fde_master: "/badges/9.glb",
  hundred_favorites: "/badges/10.glb",
};

interface InfoPanelProps {
  user: UserProfileOut;
  questions: QuestionOut[];
  tutorials: TutorialOut[];
  isOwner: boolean;
  onSetTitle: (code: string) => void;
  busy: string | null;
  currentTitleCode: string | undefined;
  unlockedTitles: UserProfileOut["titles"];
  /** 本人:最近解锁提示 */
  unlockBanner?: RecentUnlockOut[];
  onDismissBanner?: () => void;
}

type RecentUnlockOut = {
  kind: string;
  code: string;
  name: string;
  icon: string;
};

const TAGS = [
  "AI Agent",
  "FDE 落地",
  "RAG 检索增强",
  "提示词工程",
  "工作流自动化",
  "部署与运维",
  "多模态",
  "案例复盘",
];

type RecentTab = "answer" | "tutorial" | "question";

export default function InfoPanel({
  user,
  questions,
  tutorials,
  isOwner,
  onSetTitle,
  busy,
  currentTitleCode,
  unlockedTitles,
  unlockBanner,
  onDismissBanner,
}: InfoPanelProps) {
  const [tab, setTab] = useState<RecentTab>("answer");

  const stats: Array<{ label: string; value: number; icon: React.ReactNode }> = [
    { label: "發布問題", value: user.questions_count, icon: <MessageSquareText size={14} strokeWidth={2} /> },
    { label: "回答", value: user.answers_count, icon: <MessageSquare size={14} strokeWidth={2} /> },
    { label: "教程", value: user.tutorials_count, icon: <BookOpen size={14} strokeWidth={2} /> },
    { label: "被採納", value: user.accepted_count, icon: <CheckCircle2 size={14} strokeWidth={2} /> },
  ];

  // 最近贡献 tab 数据(本 MVP:用 questions/tutorials 凑)
  const recentItems = (() => {
    if (tab === "question") return questions.map((q) => ({ kind: "question" as const, id: q.id, title: q.title, meta: `${q.answer_count} 回答 · ${q.vote_count} 赞`, href: `/questions/${q.id}` }));
    if (tab === "tutorial") return tutorials.map((t) => ({ kind: "tutorial" as const, id: t.id, title: t.title, meta: `${t.like_count} 赞 · ${t.category}`, href: `/tutorials/${t.slug}` }));
    // answer tab:用 questions 里 status=resolved 的当占位
    return questions
      .filter((q) => q.status === "resolved")
      .map((q) => ({ kind: "answer" as const, id: q.id, title: q.title, meta: "已解决", href: `/questions/${q.id}` }));
  })();

  // 成就目錄：已解鎖優先，再補未解鎖；全部展示
  const achievementList = (() => {
    const unlocked = user.achievements.filter((a) => a.unlocked);
    const locked = user.achievements.filter((a) => !a.unlocked);
    return [...unlocked, ...locked];
  })();

  const unlockedCount = user.achievements.filter((a) => a.unlocked).length;
  const totalCount = user.achievements.length;

  return (
    <div className="flex flex-col gap-6">
      {/* 解锁提示条(仅本人) */}
      {isOwner && unlockBanner && unlockBanner.length > 0 && (
        <div className="card flex items-start gap-3 border-amber-200 bg-gradient-to-r from-amber-50 to-brand-50 p-4">
          <span className="mt-0.5 text-xl leading-none" aria-hidden>🎉</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Sparkles size={14} strokeWidth={2} className="text-amber-500" />
              新解鎖！{unlockBanner.length} 项
            </p>
            <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-600">
              {unlockBanner.map((u) => (
                <span key={`${u.kind}-${u.code}`} className="badge badge-gray">
                  {u.icon} {u.name}
                </span>
              ))}
            </p>
          </div>
          {onDismissBanner && (
            <button
              type="button"
              onClick={onDismissBanner}
              className="rounded p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
              aria-label="关闭提示"
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {/* ── 大型個人總覽卡：身份 + 核心數據 + 專業領域 + 成就摘要 ── */}
      <section className="card p-7">
        {/* 1) 身份區 */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h1 className="text-[28px] font-bold leading-tight text-slate-900">
            {user.display_name || user.username}
          </h1>
          <span className="text-sm text-slate-500">@{user.username}</span>
          <LevelBadge level={user.level} />
          {user.current_title && (
            <span className="badge whitespace-nowrap bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
              {user.current_title.icon} {user.current_title.name}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          {user.reputation} 聲望 · {isOwner ? "本人" : "訪客"} · {unlockedTitles.length} 個稱號
        </p>

        {isOwner && unlockedTitles.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="title-select" className="text-xs font-medium text-slate-500">
              顯示稱號
            </label>
            <select
              id="title-select"
              value={currentTitleCode ?? ""}
              disabled={busy === "title"}
              onChange={(e) => onSetTitle(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
            >
              {unlockedTitles.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 2) 核心數據：四等分 grid，數字比 label 更突出 */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            核心數據
          </h2>
          <ul className="mt-3 grid grid-cols-4 gap-3">
            {stats.map((s) => (
              <li key={s.label} className="text-center">
                <span className="block text-2xl font-bold leading-none text-slate-900">
                  {s.value}
                </span>
                <span className="mt-1.5 block text-xs text-slate-500">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3) 專業領域：輕量 pill，支援換行 */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            專業領域
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* 4) 成就徽章：全量展示，unlocked 優先，locked 補位 */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              成就徽章
              <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                {unlockedCount}/{totalCount}
              </span>
            </h2>
            <span className="text-[11px] text-slate-400">已解鎖優先展示</span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {achievementList.length === 0 ? (
              <li className="col-span-full py-3 text-center text-xs text-slate-400">
                暫無成就數據
              </li>
            ) : (
              achievementList.map((a) => {
                const modelUrl = ACHIEVEMENT_BADGE_MODEL[a.code];
                return (
                  <li key={a.code} className="group flex flex-col" title={a.description}>
                    {/* 3D 徽章展示区 */}
                    <div
                      className={`relative aspect-square overflow-hidden rounded-2xl border transition ${
                        a.unlocked
                          ? "border-amber-200/80 bg-amber-50/40 ring-1 ring-inset ring-amber-200/40"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      {modelUrl ? (
                        <>
                          <Badge3D
                            modelUrl={modelUrl}
                            interactive={a.unlocked}
                            dim={!a.unlocked}
                            fallback={<span className="text-2xl">{a.icon}</span>}
                          />
                          {!a.unlocked && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 shadow-sm">
                                <Lock size={14} className="text-slate-500" />
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">
                          {a.icon}
                        </div>
                      )}
                    </div>
                    {/* 徽章名 */}
                    <div className="mt-1.5 flex items-center justify-center gap-1 px-1">
                      <span className="text-xs leading-none" aria-hidden>
                        {a.unlocked ? a.icon : <Lock size={10} className="text-slate-400" />}
                      </span>
                      <span
                        className={`truncate text-[11px] font-medium ${
                          a.unlocked ? "text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {a.name}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>

      {/* ── 最近貢獻（保留原有 feed + tab） ── */}
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-500">最近貢獻</h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
            {(["answer", "tutorial", "question"] as RecentTab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  tab === k
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {k === "answer" ? "回答" : k === "tutorial" ? "教程" : "問題"}
              </button>
            ))}
          </div>
        </div>

        {recentItems.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              icon="🌊"
              title="這片海域還沒有留下足跡"
              description={`該騎士還沒有${tab === "answer" ? "已解決的回答" : tab === "tutorial" ? "教程" : "問題"}。`}
            />
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {recentItems.slice(0, 6).map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <Link href={it.href} className="card-hover flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm font-medium text-slate-800">{it.title}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                    {it.kind === "tutorial" && <ThumbsUp size={11} strokeWidth={2} />}
                    {it.meta}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
