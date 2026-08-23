"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  getMyProfile,
  getUserProfile,
  getUserQuestions,
  getUserTutorials,
  setCurrentTitle,
} from "@/lib/api";
import type {
  MeOut,
  QuestionOut,
  RecentUnlockOut,
  TutorialOut,
  UserProfileOut,
} from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import EmptyState from "@/components/EmptyState";
import InfoPanel from "@/components/InfoPanel";
import RoleShowcase from "@/components/RoleShowcase";

const UNLOCK_SEEN_KEY = "daodao:unlocks:seen";

export default function UserProfilePage() {
  const params = useParams();
  const id = Number(params.id);

  const [user, setUser] = useState<UserProfileOut | null>(null);
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [tutorials, setTutorials] = useState<TutorialOut[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [unlockBanner, setUnlockBanner] = useState<RecentUnlockOut[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const isOwner = currentUser !== null && currentUser.id === id;

  // 装備按槽位裝配，供 Avatar 分層渲染（裝備區暫時隱藏，但資料仍保留）
  const equippedBySlot = useMemo(() => {
    const map: Record<string, UserProfileOut["equipment"][number] | null> = {};
    if (user) {
      for (const e of user.equipment) {
        if (e.is_equipped) map[e.slot] = e;
      }
    }
    return map;
  }, [user]);

  useEffect(() => {
    if (!id) return;
    setUser(null);
    setNotFound(false);
    setUnlockBanner([]);
    const load = isOwner ? getMyProfile() : getUserProfile(id);
    load.then((data) => {
      setUser(data);
      // 本人：取出最近解锁，过滤已在 localStorage 记过的，弹顶部提示条
      if (isOwner) {
        const me = data as MeOut;
        const seen: string[] = JSON.parse(localStorage.getItem(UNLOCK_SEEN_KEY) ?? "[]");
        const fresh = me.recent_unlocks.filter((u) => !seen.includes(u.code));
        setUnlockBanner(fresh);
        if (fresh.length > 0) {
          localStorage.setItem(
            UNLOCK_SEEN_KEY,
            JSON.stringify(seen.concat(fresh.map((u) => u.code))),
          );
        }
      }
    }).catch(() => setNotFound(true));
    getUserQuestions(id).then(setQuestions).catch(() => {});
    getUserTutorials(id).then(setTutorials).catch(() => {});
  }, [id, isOwner]);

  const handleSetTitle = useCallback(
    async (titleCode: string) => {
      if (!titleCode || busy) return;
      setBusy("title");
      try {
        const me = await setCurrentTitle(titleCode);
        setUser(me);
      } catch {
        // 保留当前状态
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  if (notFound) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <EmptyState
          icon="🦞"
          title="騎士不存在"
          description="该骑士可能已被移除或不存在。"
          action={
            <Link href="/" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} strokeWidth={2} />
              返回首页
            </Link>
          }
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 text-slate-500">
        加载中...
      </main>
    );
  }

  const unlockedTitles = user.titles.filter((t) => t.unlocked);
  const currentTitleCode = user.current_title?.code;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/" className="btn btn-ghost btn-sm -ml-2 text-slate-500">
        <ArrowLeft size={15} strokeWidth={2} />
        返回首页
      </Link>

      {/* 左右双栏:左 3D 角色展示台(35-40%),右信息模块(60-65%) */}
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        {/* 左侧:3D 角色展示台(sticky 在右侧信息流滚动时保持可见) */}
        <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[38%] lg:max-w-[440px]">
          <RoleShowcase equipment={equippedBySlot} user={user} />
        </aside>

        {/* 右侧:信息流 */}
        <div className="min-w-0 flex-1">
          <InfoPanel
            user={user}
            questions={questions}
            tutorials={tutorials}
            isOwner={isOwner}
            onSetTitle={handleSetTitle}
            busy={busy}
            currentTitleCode={currentTitleCode}
            unlockedTitles={unlockedTitles}
            unlockBanner={unlockBanner}
            onDismissBanner={() => setUnlockBanner([])}
          />
        </div>
      </div>
    </main>
  );
}
