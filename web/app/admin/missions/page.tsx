"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { listAdminMissions } from "@/lib/admin-api";
import type { AdminMission } from "@/lib/admin-api";

const STATUS_LABELS: Record<string, string> = {
  open: "待接单",
  in_progress: "进行中",
  delivered: "已交付",
  closed: "已关闭",
};

const STATUS_BADGE: Record<string, string> = {
  open: "badge-gray",
  in_progress: "badge-orange",
  delivered: "badge-green",
  closed: "badge-gray",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

function MissionsContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";

  const [items, setItems] = useState<AdminMission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminMissions({ page: 1, status: status || undefined });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">任务管理</h1>
        <p className="mt-1 text-sm text-slate-500">龍蝦任務大廳 · 共 {total} 个任务</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { /* 状态筛选切换简化：全部 */ window.location.search = ""; }}
          className={`chip ${!status ? "chip-active" : "chip-idle"}`}
        >
          全部
        </button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              const sp = new URLSearchParams(searchParams);
              if (k) sp.set("status", k);
              else sp.delete("status");
              window.location.search = sp.toString();
            }}
            className={`chip ${status === k ? "chip-active" : "chip-idle"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3">任务</th>
                <th className="px-5 py-3">难度</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">接单者</th>
                <th className="px-5 py-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                      <ClipboardList size={22} strokeWidth={2} className="text-slate-400" />
                    </span>
                    <p className="mt-3 text-sm text-slate-400">暂无任务</p>
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{m.title}</div>
                      <div className="text-xs text-slate-400">#{m.id} · 奖励 {m.reward || "未设置"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge badge-gray">
                        {DIFFICULTY_LABELS[m.difficulty] ?? m.difficulty}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${STATUS_BADGE[m.status] ?? "badge-gray"}`}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {m.assignee_id ? `#${m.assignee_id}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {m.created_at.slice(0, 10)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminMissionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中...</p>}>
      <MissionsContent />
    </Suspense>
  );
}
