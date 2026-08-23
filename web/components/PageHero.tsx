import Link from "next/link";
import { Search } from "lucide-react";

type Variant = "warm" | "cool" | "earth";

const VARIANT_BG: Record<Variant, string> = {
  warm: "from-brand-50 via-rose-50 to-orange-50",
  cool: "from-sky-50 via-brand-50 to-amber-50",
  earth: "from-amber-50 via-brand-50 to-rose-50",
};

interface PageHeroProps {
  /** 小標（如 "社區板塊 · COMMUNITY"） */
  eyebrow: string;
  /** 主標（大字） */
  title: string;
  /** 副標，1-2 句 */
  description: string;
  /** 主 CTA（右上角），可不傳 */
  primaryCta?: { label: string; href: string };
  /** 嵌入式搜索框（問題 / 學院用） */
  search?: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
  };
  /** 熱門標籤列（問題頁用） */
  hotTags?: string[];
  /** 自訂右側 slot（社區頁用） */
  rightSlot?: React.ReactNode;
  /** 三頁主題色 */
  variant?: Variant;
}

/**
 * 三頁社區 Portal 共用 Page Hero。
 * 設計目標：
 * - 180-220px 高，圓角 2xl，淺漸變
 * - 標題 text-3xl / sm:text-4xl，視覺重量 ≈ 首頁 Hero 30%
 * - 右側放主 CTA / 搜索 / 自訂 slot，桌面 lg 橫排，行動裝置縱排
 */
export default function PageHero({
  eyebrow,
  title,
  description,
  primaryCta,
  search,
  hotTags,
  rightSlot,
  variant = "warm",
}: PageHeroProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br ${VARIANT_BG[variant]} p-6 sm:p-8 lg:p-10`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* 左：標題區 */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            {description}
          </p>
        </div>

        {/* 右：CTA / Slot */}
        {(primaryCta || rightSlot) && (
          <div className="shrink-0">
            {rightSlot ?? (
              primaryCta && (
                <Link
                  href={primaryCta.href}
                  className="btn btn-primary h-12 px-6 text-base"
                >
                  {primaryCta.label}
                </Link>
              )
            )}
          </div>
        )}
      </div>

      {/* 搜索框（如果有） */}
      {search && (
        <div className="relative mt-6">
          <Search
            size={20}
            strokeWidth={2}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>
      )}

      {/* 熱門標籤列（如果有） */}
      {hotTags && hotTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">熱門：</span>
          {hotTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-white hover:text-brand-600"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
