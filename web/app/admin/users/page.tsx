"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Shield } from "lucide-react";
import { listAdminUsers, updateAdminUser } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/admin-api";
import ConfirmDialog from "../ConfirmDialog";

const LEVEL_LABELS: Record<number, string> = {
  1: "小龍蝦",
  2: "銅鉗騎士",
  3: "銀鉗騎士",
  4: "黃金騎士",
  5: "龍蝦領主",
};

function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className={`badge ${
        level >= 4 ? "badge-amber" : level === 3 ? "badge-gray" : "badge-gray"
      }`}
    >
      Lv{level} {LEVEL_LABELS[level] ?? ""}
    </span>
  );
}

function UsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const q = searchParams.get("q") ?? "";

  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 操作状态
  const [confirm, setConfirm] = useState<{
    user: AdminUser;
    action: "toggle_active" | "level" | "reputation";
    value?: number;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminUsers({ page, q: q || undefined, page_size: 20 });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitAction() {
    if (!confirm) return;
    setSubmitting(true);
    try {
      if (confirm.action === "toggle_active") {
        await updateAdminUser(confirm.user.id, {
          is_active: !confirm.user.is_active,
          reason,
        });
      } else if (confirm.action === "level") {
        await updateAdminUser(confirm.user.id, { level: confirm.value, reason });
      } else if (confirm.action === "reputation") {
        await updateAdminUser(confirm.user.id, { reputation: confirm.value, reason });
      }
      await load();
      setConfirm(null);
      setReason("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  function setPage(p: number) {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(p));
    router.push(`/admin/users?${sp.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">用户管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          共 {total} 位骑士 · 可停用、调等级、调声望、标记 FDE
        </p>
      </div>

      {/* 搜索 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const sp = new URLSearchParams(searchParams);
          const val = new FormData(e.currentTarget).get("q") as string;
          if (val.trim()) sp.set("q", val.trim());
          else sp.delete("q");
          sp.set("page", "1");
          router.push(`/admin/users?${sp.toString()}`);
        }}
        className="relative max-w-sm"
      >
        <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索用户名 / 昵称"
          className="input pl-10"
        />
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 用户表格 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3">用户</th>
                <th className="px-5 py-3">等级</th>
                <th className="px-5 py-3">声望</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">注册时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <span className="text-3xl">🦞</span>
                    <p className="mt-2 text-sm text-slate-400">没有找到骑士</p>
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="flex items-center gap-3"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                          {u.display_name?.[0] || u.username?.[0] || "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">
                            {u.display_name || u.username}
                            {u.is_admin && <Shield size={12} strokeWidth={2} className="ml-1 inline text-brand-500" />}
                          </span>
                          <span className="block text-xs text-slate-400">@{u.username}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <LevelBadge level={u.level} />
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{u.reputation}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                        {u.is_active ? "启用" : "停用"}
                      </span>
                      {u.is_verified_fde && <span className="badge badge-amber ml-1.5">FDE</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {u.created_at.slice(0, 10)}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${u.id}`} className="btn btn-secondary btn-sm">
                        详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft size={14} strokeWidth={2} /> 上一页
              </button>
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
              >
                下一页 <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 操作确认弹窗 */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === "toggle_active"
            ? confirm.user.is_active
              ? "停用该用户？"
              : "启用该用户？"
            : confirm?.action === "level"
              ? `将 ${confirm.user.display_name || confirm.user.username} 调整为 Lv${confirm?.value}`
              : "调整声望？"
        }
        description={
          confirm?.action === "toggle_active"
            ? `停用后 ${confirm.user.display_name || confirm.user.username} 将无法登录，内容保留。`
            : confirm?.action === "level"
              ? "修改等级会覆盖用户当前等级。"
              : `将声望调整为 ${confirm?.value}（覆盖当前值）。`
        }
        confirmLabel="确认"
        loading={submitting}
        reasonRequired
        reason={reason}
        onReasonChange={setReason}
        onConfirm={submitAction}
        onCancel={() => {
          setConfirm(null);
          setReason("");
        }}
      />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中...</p>}>
      <UsersContent />
    </Suspense>
  );
}
