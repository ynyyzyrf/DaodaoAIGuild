"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Eye, Plus, ThumbsUp } from "lucide-react";
import { listCategories, listTutorials } from "@/lib/api";
import type { TutorialOut } from "@/lib/types";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import PageHero from "@/components/PageHero";
import SidebarNav from "@/components/SidebarNav";

// 默認封面：本地品牌圖，全部教程共用。
// 之前用 picsum.photos 隨機佔位圖（seed 固定所以同教程同圖），但 picsum 是純隨機照片，
// 會出現「一隻脚」之類與教程無關的畫面。教程目前沒有真實封面欄位，故統一換成這張品牌封面，
// 分類由卡片左上角的 badge 標出。
const TUTORIAL_COVER = "/tutorials/default-cover.svg";

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
    setLoading(true);
    listTutorials(activeCategory ? { category: activeCategory } : {})
      .then((p) => setTutorials(p.items))
      .catch(() => setTutorials([]))
      .finally(() => setLoading(false));
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

  // 精選區：基於真實資料。Featured = 第一條；次級 = 後 2 條
  const featured = filtered[0];
  const secondary = filtered.slice(1, 3);
  const gridItems = filtered.slice(0); // Grid 區用全部

  return (
    <div className="mx-auto flex max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:px-10">
      <SidebarNav />
      <main className="min-w-0 flex-1">
        {/* Page Hero */}
        <PageHero
          variant="cool"
          eyebrow="龍蝦學院 · ACADEMY"
          title="從 Demo 到落地，系統學習 AI Agent 與 FDE 實戰"
          description="精選教程、案例、工作流與實戰經驗。"
          primaryCta={{ label: "＋ 寫教程", href: "/tutorials/new" }}
          search={{
            placeholder: "搜索教程標題、摘要或分類...",
            value: keyword,
            onChange: setKeyword,
          }}
        />

        {/* 精選教程：有 featured 時才渲染（次級卡有資料時才顯示右側） */}
        {!loading && featured && (
          <section className="mt-10">
            <div className="flex items-baseline gap-2">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
                <BookOpen size={20} strokeWidth={2} className="text-brand-500" />
                精選教程
              </h2>
              <span className="text-sm text-slate-400">· 從最新教程推薦</span>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* Featured 大卡 */}
              <Link
                href={`/tutorials/${featured.slug}`}
                className="card card-hover group flex flex-col overflow-hidden"
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

              {/* 次級卡：有資料才顯示 */}
              {secondary.length > 0 && (
                <div className="flex flex-col gap-4">
                  {secondary.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tutorials/${t.slug}`}
                      className="card card-hover group flex gap-4 p-5"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                          style={{ backgroundImage: `url(${TUTORIAL_COVER})` }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                          {t.category}
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

        {/* 全部教程 section header + 分類 chips */}
        <section className="mt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">全部教程</h2>
              <span className="text-sm text-slate-400">· {gridItems.length}</span>
            </div>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setActiveCategory("")}
                className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                清除分類篩選 ✕
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveCategory("")}
                className={`chip ${activeCategory === "" ? "chip-active" : "chip-idle"}`}
              >
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

          {/* 教程卡片網格 */}
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
                    className="card card-hover group flex h-full flex-col overflow-hidden"
                  >
                    <div className="relative h-40 overflow-hidden bg-brand-50">
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundImage: `url(${TUTORIAL_COVER})` }}
                      />
                      <span className="absolute left-3 top-3 badge badge-red shadow-sm">
                        {t.category}
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
                        <span className="inline-flex items-center gap-2">
                          <Avatar user={t.author} size={20} />
                          <span className="truncate font-medium text-slate-700">
                            {t.author?.display_name || t.author?.username || "未知"}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-3">
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
