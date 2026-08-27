"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

export type ErrorReason = "missing_token" | "expired" | "not_found" | "network" | "unknown";

const REASON_COPY: Record<ErrorReason, { title: string; body: string }> = {
  missing_token: {
    title: "連結不完整",
    body: "請回到 Hermes 並重新發起連接。",
  },
  expired: {
    title: "授權已過期",
    body: "這個連接請求已經過期或已被使用。請回到 Hermes 重新嘗試連接。",
  },
  not_found: {
    title: "找不到這個請求",
    body: "連結可能已失效。請回到 Hermes 重新發起連接。",
  },
  network: {
    title: "連線發生問題",
    body: "請檢查網路後重試。",
  },
  unknown: {
    title: "發生錯誤",
    body: "請稍後再試，或回到 Hermes 重新發起連接。",
  },
};

export function ErrorState({ reason }: { reason: ErrorReason }) {
  const copy = REASON_COPY[reason];
  return (
    <div className="card px-8 py-10 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl ring-1 ring-amber-100">
        <Clock size={28} className="text-amber-600" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">{copy.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{copy.body}</p>
      <Link href="/" className="btn btn-secondary mt-6">
        回到首頁
      </Link>
    </div>
  );
}
