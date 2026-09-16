import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ChannelMetric {
  label: string;
  value: string | number;
  icon: LucideIcon;
}

export function ChannelHero({
  title,
  subtitle,
  image,
  note,
  metrics,
  children,
}: {
  title: string;
  subtitle: string;
  image: string;
  note?: ReactNode;
  metrics?: ChannelMetric[];
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200">
      <div className="absolute inset-0 -z-10">
        <img src={image} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.88)_54%,rgba(255,255,255,0.58)_100%)]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#35120d] sm:text-5xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-slate-700">{subtitle}</p>
          </div>
          {note && (
            <div className="rounded-lg border border-white/80 bg-white/88 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
              {note}
            </div>
          )}
        </div>

        {metrics && metrics.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg border border-white/80 bg-white/92 px-4 py-3 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Icon size={17} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-black text-slate-950">{metric.value}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{metric.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

export function ChannelSearch({
  icon: Icon,
  value,
  onChange,
  placeholder,
  action,
}: {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/94 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <label className="flex items-center gap-3">
        <Icon size={20} strokeWidth={2} className="ml-2 shrink-0 text-slate-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          placeholder={placeholder}
        />
        {action}
      </label>
    </div>
  );
}

export function ChannelToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.035)] lg:flex-row lg:items-center lg:justify-between">
      {children}
    </div>
  );
}
