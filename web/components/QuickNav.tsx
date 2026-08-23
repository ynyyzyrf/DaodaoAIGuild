"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Compass } from "lucide-react";
import { ECOSYSTEM_LINKS } from "@/lib/site";

/**
 * 一鍵導航（docs/3.0.md §2 / §6）：Header 下拉 Popup，跳转 DaoDao 生态各系统。
 * 白底 + 浅灰 border + 轻微阴影，hover 品牌红；所有项外部新窗口打开。
 */
export default function QuickNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const links = ECOSYSTEM_LINKS.filter((l) => l.url !== "");

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
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
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
          className="card absolute right-0 top-full z-30 mt-2 w-60 p-1.5 shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
        >
          {links.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
            >
              <span className="text-base leading-none" aria-hidden>
                {link.icon}
              </span>
              <span className="flex-1">{link.name}</span>
              <ChevronRight size={14} strokeWidth={2} className="text-slate-300" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
