"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";

import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import LevelBadge from "@/components/LevelBadge";
import { getLeaderboardByMetric, type LeaderboardMetric } from "@/lib/api";
import type { LeaderboardOut } from "@/lib/types";

const TABS = [
  { key: "rescue", label: "本週救援", unit: "次救援", empty: "本週還沒有救援記錄" },
  { key: "tutorial", label: "教程貢獻", unit: "篇教程", empty: "還沒有騎士發布教程" },
  { key: "reputation", label: "總聲望", unit: "點聲望", empty: "還沒有騎士上榜" },
] as const;

const RANK_CLS = [
  "bg-amber-500 text-white",
  "bg-slate-200 text-slate-700",
  "bg-amber-700 text-white",
  "bg-slate-100 text-slate-400",
];

/** 首页「騎士排行榜」：本週救援 / 教程貢獻 / 總聲望 三 Tab，切换即拉取对应 metric。 */
export default function KnightLeaderboard() {
  const [tab, setTab] = useState<LeaderboardMetric>("rescue");
  const [cache, setCache] = useState<Partial<Record<LeaderboardMetric, LeaderboardOut[]>>>({});
  // loading/error 均按 tab 记录，避免切 tab 后旧请求的状态泄漏
  const [loadingTab, setLoadingTab] = useState<LeaderboardMetric | null>(null);
  const [errorTab, setErrorTab] = useState<Partial<Record<LeaderboardMetric, boolean>>>({});
  // 重试计数：请求失败时不写 cache，点「重試」自增触发重新拉取
  const [attempt, setAttempt] = useState(0);

  const active = TABS.find((t) => t.key === tab)!;
  const rows = cache[tab];
  const isLoading = loadingTab === tab && rows === undefined;
  const isError = errorTab[tab] === true;

  useEffect(() => {
    if (rows) return; // 已缓存（成功或失败均不在此判断内——失败不会写 cache）
    let cancelled = false;
    setLoadingTab(tab);
    setErrorTab((e) => (e[tab] ? { ...e, [tab]: false } : e));
    getLeaderboardByMetric(tab, 8)
      .then((data) => {
        if (!cancelled) setCache((c) => ({ ...c, [tab]: data }));
      })
      .catch(() => {
        // 失败不写 cache：否则 [] 会被当成「确实为空」，且本会话不再重试
        if (!cancelled) setErrorTab((e) => ({ ...e, [tab]: true }));
      })
      .finally(() => {
        if (!cancelled) setLoadingTab((t) => (t === tab ? null : t));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, rows, attempt]);

  return (
    <section id="rankings" className="scroll-mt-24">
      <div className="flex items-center gap-2">
        <Trophy size={20} strokeWidth={2} className="text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">騎士排行榜</h2>
      </div>

      {/* 三 Tab */}
      <div className="mt-4 flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "chip-active" : "chip-idle"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-400">加載中…</p>
      ) : isError ? (
        <div className="mt-6 rounded-2xl border border-brand-200/60 bg-brand-50/30 p-6 text-center">
          <p className="text-sm text-slate-600">排行榜加載失敗，請稍後再試。</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="btn btn-secondary btn-sm mt-3"
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            重試
          </button>
        </div>
      ) : !rows || rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={active.empty}
            description="發布內容、回答被採納、獲得認可後即可上榜。"
          />
        </div>
      ) : (
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {rows.map((u, i) => (
            <li
              key={`${tab}-${u.id}`}
              className={`card card-hover flex items-center gap-3 p-4 ${
                i === 0 ? "border-amber-300/80 bg-gradient-to-r from-amber-50 to-white" : ""
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  RANK_CLS[Math.min(i, 3)]
                }`}
              >
                {i + 1}
              </span>
              <Avatar user={u} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/users/${u.id}`}
                    className="min-w-0 truncate font-medium text-slate-800 transition-colors hover:text-brand-500"
                  >
                    {u.display_name || u.username}
                  </Link>
                  <LevelBadge level={u.level} />
                </div>
                {u.top_tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {u.top_tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-bold text-slate-800">{u.metric_value}</div>
                <div className="text-xs text-slate-400">{active.unit}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
