"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/admin-api";
import type { AuditLog } from "@/lib/admin-api";

function ActionLabel({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "auth.login": { label: "登录", cls: "badge-green" },
    "auth.login_failed": { label: "登录失败", cls: "badge-red" },
    "auth.locked": { label: "账号锁定", cls: "badge-red" },
    "user.update": { label: "修改用户", cls: "badge-amber" },
    "user.reset_password": { label: "重置密码", cls: "badge-amber" },
    "user.soft_delete": { label: "注销用户", cls: "badge-red" },
    "moderation.approve.question": { label: "通过问题", cls: "badge-green" },
    "moderation.approve.answer": { label: "通过回答", cls: "badge-green" },
    "moderation.approve.tutorial": { label: "通过教程", cls: "badge-green" },
    "moderation.hide.tutorial": { label: "隐藏教程", cls: "badge-orange" },
    "moderation.delete.question": { label: "删除问题", cls: "badge-red" },
    "moderation.delete.answer": { label: "删除回答", cls: "badge-red" },
    "moderation.delete.tutorial": { label: "删除教程", cls: "badge-red" },
    "moderation.reject.tutorial": { label: "打回教程", cls: "badge-orange" },
    "sensitive_word.create": { label: "新增敏感词", cls: "badge-gray" },
    "sensitive_word.update": { label: "修改敏感词", cls: "badge-gray" },
    "sensitive_word.delete": { label: "删除敏感词", cls: "badge-gray" },
    "sensitive_word.import": { label: "导入敏感词", cls: "badge-gray" },
    "mission.update": { label: "修改任务", cls: "badge-gray" },
  };
  const entry = map[action];
  return (
    <span className={`badge ${entry?.cls ?? "badge-gray"}`}>
      {entry?.label ?? action}
    </span>
  );
}

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs({ page, page_size: 20 });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">稽核日志</h1>
        <p className="mt-1 text-sm text-slate-500">
          所有后台写操作留痕 · 仅追加不可删除 · 共 {total} 条
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3">操作</th>
                <th className="px-5 py-3">对象</th>
                <th className="px-5 py-3">操作者</th>
                <th className="px-5 py-3">原因</th>
                <th className="px-5 py-3">时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">加载中...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                      <ScrollText size={22} strokeWidth={2} className="text-slate-400" />
                    </span>
                    <p className="mt-3 text-sm text-slate-400">暂无日志</p>
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3">
                      <ActionLabel action={log.action} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {log.target_type}
                      {log.target_id ? ` #${log.target_id}` : ""}
                    </td>
                    <td className="px-5 py-3 text-slate-600">#{log.admin_id}</td>
                    <td className="max-w-[240px] truncate px-5 py-3 text-slate-500" title={log.reason}>
                      {log.reason}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="hover:text-brand-600"
                      >
                        {log.created_at.slice(0, 16).replace("T", " ")}
                      </button>
                      {expanded === log.id && (
                        <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
                          <div>IP: {log.ip ?? "—"}</div>
                          {log.before_value && (
                            <div>before: {JSON.stringify(log.before_value)}</div>
                          )}
                          {log.after_value && (
                            <div>after: {JSON.stringify(log.after_value)}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
