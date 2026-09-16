"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, FileText, GraduationCap, Plus, Search, Tag, ThumbsUp, UsersRound } from "lucide-react";

import Avatar from "@/components/Avatar";
import { ChannelHero, ChannelSearch, ChannelToolbar } from "@/components/ChannelShell";
import EmptyState from "@/components/EmptyState";
import { listCategories, listTutorials } from "@/lib/api";
import type { TutorialOut } from "@/lib/types";

const TUTORIAL_COVER = "/tutorials/default-cover.svg";

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

export default function TutorialsPage() {
  const [tutorials, setTutorials] = useState<TutorialOut[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTutorials(activeCategory ? { category: activeCategory } : {})
      .then((p) => {
        if (!cancelled) setTutorials(p.items);
      })
      .catch(() => {
        if (!cancelled) setTutorials([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return tutorials;
    return tutorials.filter(
      (t) =>
        t.title.toLowerCase().includes(kw) ||
        t.summary.toLowerCase().includes(kw) ||
        t.category.toLowerCase().includes(kw),
    );
  }, [tutorials, keyword]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const gridItems = filtered;
  const authorCount = new Set(tutorials.map((tutorial) => tutorial.author_id)).size;
  const metrics = [
    { label: "已發布教程", value: formatCount(tutorials.length), icon: BookOpen },
    { label: "總瀏覽量", value: formatCount(tutorials.reduce((sum, item) => sum + item.view_count, 0)), icon: Eye },
    { label: "教程作者", value: formatCount(authorCount), icon: UsersRound },
    { label: "課程分類", value: formatCount(categories.length), icon: Tag },
  ];

  return (
    <div className="bg-[#f6f8fb] pb-14">
      <main>
        <ChannelHero
          title="DAOSTORE 學院"
          subtitle="從實戰出發，把 AI 與 FDE 落地經驗沉澱成可學、可復用的教程。"
          image="/banners/banner-1.png?v=20260828"
          metrics={metrics}
          note={
            <>
              <p className="text-sm font-black text-[#35120d]">學會，才能做得更好。</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">目前只展示已發布教程；沒有真實學習數據時不做誇張包裝。</p>
              <Link href="/tutorials/new" className="btn btn-primary mt-4 h-10">
                <Plus size={15} strokeWidth={2.5} />
                寫教程
              </Link>
            </>
          }
        >
          <ChannelSearch
            icon={Search}
            value={keyword}
            onChange={setKeyword}
            placeholder="搜尋課程、作者或關鍵字..."
          />
        </ChannelHero>

        {!loading && featured && (
          <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="flex items-baseline gap-2">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl">
                <GraduationCap size={20} strokeWidth={2} className="text-brand-500" />
                精選課程
              </h2>
              <span className="text-sm text-slate-400">· 來自已發布教程</span>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <Link
                href={`/tutorials/${featured.slug}`}
                className="card card-hover group flex flex-col overflow-hidden rounded-lg shadow-[0_16px_42px_rgba(15,23,42,0.06)]"
              >
                <div className="relative h-[260px] overflow-hidden bg-brand-50">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${TUTORIAL_COVER})` }}
                  />
                  <span className="absolute left-4 top-4 badge badge-red shadow-sm">
                    {featured.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <h3 className="line-clamp-2 text-2xl font-bold text-slate-900 transition-colors group-hover:text-brand-600">
                    {featured.title}
                  </h3>
                  {featured.summary && (
                    <p className="line-clamp-3 text-[15px] leading-relaxed text-slate-600">
                      {featured.summary}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Avatar user={featured.author} size={22} />
                      <span className="font-medium text-slate-700">
                        {featured.author?.display_name || featured.author?.username || "未知"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-4">
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp size={13} strokeWidth={2} />
                        {featured.like_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={13} strokeWidth={2} />
                        {featured.view_count}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>

              {secondary.length > 0 && (
                <div className="flex flex-col gap-4">
                  {secondary.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tutorials/${t.slug}`}
                      className="card card-hover group flex gap-4 rounded-lg p-5"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                          style={{ backgroundImage: `url(${TUTORIAL_COVER})` }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                          {t.category || "系統課程"}
                        </span>
                        <h4 className="mt-1.5 line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-brand-600">
                          {t.title}
                        </h4>
                        {t.summary && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {t.summary}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp size={11} strokeWidth={2} />
                            {t.like_count}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye size={11} strokeWidth={2} />
                            {t.view_count}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-10">
          <ChannelToolbar>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">全部課程</h2>
              <span className="text-sm text-slate-400">{formatCount(gridItems.length)} 個結果</span>
              {categories.length > 0 && (
                <div className="ml-0 flex flex-wrap gap-1.5 lg:ml-3">
                  <button onClick={() => setActiveCategory("")} className={`chip ${activeCategory === "" ? "chip-active" : "chip-idle"}`}>
                    全部
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveCategory(c)}
                      className={`chip ${activeCategory === c ? "chip-active" : "chip-idle"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setActiveCategory("")}
                className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                清除分類篩選
              </button>
            )}
          </ChannelToolbar>

          {loading ? (
            <p className="mt-12 text-sm text-slate-500">加載中...</p>
          ) : gridItems.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                title={keyword || activeCategory ? "沒有匹配的教程" : "還沒有教程"}
                description={
                  keyword || activeCategory
                    ? "換個關鍵詞或分類試試。"
                    : "把實戰經驗沉澱成教程，幫助其他騎士。"
                }
                action={
                  !keyword && !activeCategory ? (
                    <Link href="/tutorials/new" className="btn btn-primary btn-sm">
                      <Plus size={15} strokeWidth={2.5} />
                      寫第一篇教程
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {gridItems.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tutorials/${t.slug}`}
                    className="card card-hover group flex h-full flex-col overflow-hidden rounded-lg shadow-[0_16px_42px_rgba(15,23,42,0.05)]"
                  >
                    <div className="relative h-40 overflow-hidden bg-brand-50">
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundImage: `url(${TUTORIAL_COVER})` }}
                      />
                      <span className="absolute left-3 top-3 badge badge-red shadow-sm">
                        {t.category || "實戰課程"}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="line-clamp-2 text-lg font-bold text-slate-900 transition-colors group-hover:text-brand-600">
                        {t.title}
                      </h3>
                      {t.summary && (
                        <p className="mt-2 line-clamp-2 flex-1 text-[15px] leading-relaxed text-slate-600">
                          {t.summary}
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Avatar user={t.author} size={20} />
                          <span className="truncate font-medium text-slate-700">
                            {t.author?.display_name || t.author?.username || "未知"}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-3">
                          <span className="hidden rounded-md bg-brand-50 px-2 py-1 font-bold text-brand-600 sm:inline-flex">
                            開始學習
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp size={12} strokeWidth={2} />
                            {t.like_count}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye size={12} strokeWidth={2} />
                            {t.view_count}
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
