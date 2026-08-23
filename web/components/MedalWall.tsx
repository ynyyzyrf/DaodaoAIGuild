"use client";

import type { AchievementOut, Rarity } from "@/lib/types";

const RARITY_META: Record<Rarity, { label: string; badge: string; ring: string; dim: string }> = {
  common: {
    label: "普通",
    badge: "bg-slate-100 text-slate-600",
    ring: "ring-slate-200",
    dim: "grayscale opacity-60",
  },
  rare: {
    label: "稀有",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    ring: "ring-amber-300",
    dim: "grayscale opacity-60",
  },
  epic: {
    label: "史诗",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    ring: "ring-brand-300",
    dim: "grayscale opacity-60",
  },
  legendary: {
    label: "传说",
    badge: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300",
    ring: "ring-amber-400",
    dim: "grayscale opacity-60",
  },
};

/** 成就勋章墙（docs/2.0.md §14）：已解锁彩色展示，未解锁灰色锁形占位。 */
export default function MedalWall({ achievements }: { achievements: AchievementOut[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {achievements.map((a) => {
        const meta = RARITY_META[a.rarity];
        return (
          <li
            key={a.code}
            title={a.description}
            className={`card relative flex flex-col items-center gap-1.5 px-3 py-4 text-center ${meta.ring} ${
              a.unlocked ? "ring-1 ring-inset" : ""
            }`}
          >
            <span className="absolute right-2 top-2 text-[10px] font-medium text-slate-400">
              {meta.label}
            </span>
            <span
              className={`text-3xl leading-none ${a.unlocked ? "" : `${meta.dim} grayscale`}`}
              aria-hidden
            >
              {a.unlocked ? a.icon : "🔒"}
            </span>
            <span
              className={`text-sm font-semibold ${a.unlocked ? "text-slate-800" : "text-slate-400"}`}
            >
              {a.name}
            </span>
            {!a.unlocked && <span className="text-[11px] leading-snug text-slate-400">{a.description}</span>}
          </li>
        );
      })}
    </ul>
  );
}
