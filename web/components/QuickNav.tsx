"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Compass } from "lucide-react";

/**
 * 一鍵導航（docs/3.0.md §2 / §6）：Header 下拉 Popup，跳转 DaoDao 生态各系统。
 * 白底 + 浅灰 border + 轻微阴影，hover 品牌红；所有项外部新窗口打开。
 */
export default function QuickNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const productLinks = [
    { name: "龍蝦學院", href: "/tutorials", icon: "📖" },
    { name: "問題廣場", href: "/questions", icon: "💬" },
    { name: "機會池", href: "/opportunities", icon: "✨" },
    { name: "需求", href: "/orders", icon: "📋" },
  ];

  // 点击外部 / Escape 关闭
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors ${
          open
            ? "bg-brand-50 text-brand-600"
            : "text-slate-600 hover:bg-brand-50 hover:text-brand-600"
        }`}
      >
        <Compass size={16} strokeWidth={2} />
        一鍵導航
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 top-[calc(100%+8px)] z-50 w-60 p-1.5 shadow-[0_12px_36px_rgba(16,24,40,0.16)]"
        >
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            站內入口
          </div>
          {productLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
            >
              <span className="text-base leading-none" aria-hidden>
                {link.icon}
              </span>
              <span className="flex-1">{link.name}</span>
              <ChevronRight size={14} strokeWidth={2} className="text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
