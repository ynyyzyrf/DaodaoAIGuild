import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** 插圖 emoji，默認 🦞 */
  icon?: string;
  action?: ReactNode;
}

/** 龍蝦空狀態：品牌淺底圓角插圖框 + 標題 + 說明 + 可選操作。 */
export default function EmptyState({ title, description, icon = "🦞", action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl ring-1 ring-brand-100">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
