"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  getAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
} from "@/lib/admin-api";
import type { AdminUserDetail } from "@/lib/admin-api";
import ConfirmDialog from "../../ConfirmDialog";

const LEVEL_LABELS: Record<number, string> = {
  1: "小龍蝦",
  2: "銅鉗騎士",
  3: "銀鉗騎士",
  4: "黃金騎士",
  5: "龍蝦領主",
};

type PendingAction =
  | { kind: "toggle_active" }
  | { kind: "level"; value: number }
  | { kind: "reputation"; value: number }
  | { kind: "toggle_fde" }
  | { kind: "reset_password" };

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUser(userId);
      setUser(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitAction() {
    if (!user || !confirm) return;
    setSubmitting(true);
    try {
      if (confirm.kind === "toggle_active") {
        await updateAdminUser(user.id, { is_active: !user.is_active, reason });
      } else if (confirm.kind === "level") {
        await updateAdminUser(user.id, { level: confirm.value, reason });
      } else if (confirm.kind === "reputation") {
        await updateAdminUser(user.id, { reputation: confirm.value, reason });
      } else if (confirm.kind === "toggle_fde") {
        await updateAdminUser(user.id, { is_verified_fde: !user.is_verified_fde, reason });
      } else if (confirm.kind === "reset_password") {
        const data = await resetAdminUserPassword(user.id);
        setNewPassword(data.new_password);
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

  if (loading) return <p className="text-sm text-slate-400">加载中...</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!user) return null;

  const stats = [
    { icon: MessageSquare, label: "提问", value: user.questions_count },
    { icon: CheckCircle2, label: "回答", value: user.answers_count },
    { icon: BookOpen, label: "教程", value: user.tutorials_count },
    { icon: Award, label: "被采纳", value: user.accepted_count },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <button
        type="button"
        onClick={() => router.push("/admin/users")}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← 返回用户列表
      </button>

      {/* 身份卡 */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500">
            {user.display_name?.[0] || user.username?.[0] || "?"}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {user.display_name || user.username}
              </h1>
              {user.is_admin && (
                <span className="badge badge-red">
                  <Shield size={12} strokeWidth={2} /> 管理员
                </span>
              )}
              {user.is_verified_fde && (
                <span className="badge badge-amber">
                  <UserCheck size={12} strokeWidth={2} /> 官方 FDE
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
            {user.bio && <p className="mt-2 text-sm text-slate-600">{user.bio}</p>}
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="badge badge-amber">
                Lv{user.level} {LEVEL_LABELS[user.level] ?? ""}
              </span>
              <span className="text-slate-500">
                声望 <span className="font-semibold text-slate-800">{user.reputation}</span>
              </span>
              <span className="text-slate-500">
                EXP <span className="font-semibold text-slate-800">{user.exp}</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">注册于</div>
            <div className="text-sm font-semibold text-slate-700">
              {user.created_at.slice(0, 10)}
            </div>
          </div>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Icon size={18} strokeWidth={2} />
            </span>
            <div>
              <div className="text-xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 操作 */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-800">管理操作</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setConfirm({ kind: "toggle_active" })}
            className={`btn ${user.is_active ? "btn-secondary" : "btn-primary"}`}
          >
            {user.is_active ? (
              <>
                <UserX size={15} strokeWidth={2} /> 停用账号
              </>
            ) : (
              <>
                <UserCheck size={15} strokeWidth={2} /> 启用账号
              </>
            )}
          </button>
          {[2, 3, 4, 5].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setConfirm({ kind: "level", value: lv })}
              className="btn btn-secondary"
            >
              Lv{lv} {LEVEL_LABELS[lv]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setConfirm({ kind: "reputation", value: 0 })}
            className="btn btn-secondary"
          >
            <Award size={15} strokeWidth={2} /> 声望归零
          </button>
          <button
            type="button"
            onClick={() => setConfirm({ kind: "toggle_fde" })}
            className="btn btn-secondary"
          >
            <UserCheck size={15} strokeWidth={2} />
            {user.is_verified_fde ? "取消 FDE 认证" : "标记 FDE"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm({ kind: "reset_password" })}
            className="btn btn-secondary"
          >
            <KeyRound size={15} strokeWidth={2} /> 重置密码
          </button>
        </div>
      </div>

      {/* 重置密码结果 */}
      {newPassword && (
        <div className="card border-amber-200 bg-amber-50/50 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-800">新密码已生成</h3>
              <p className="mt-1 text-sm text-amber-700">
                请立即复制保存，此密码仅显示一次：
              </p>
              <code className="mt-3 inline-block rounded-lg bg-white px-4 py-2 font-mono text-base text-slate-900 ring-1 ring-amber-200">
                {newPassword}
              </code>
            </div>
            <button
              type="button"
              onClick={() => setNewPassword(null)}
              className="btn btn-secondary btn-sm"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 确认弹窗 */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "toggle_active"
            ? user.is_active
              ? "停用该用户？"
              : "启用该用户？"
            : confirm?.kind === "level"
              ? `调整为 Lv${confirm.value} ${LEVEL_LABELS[confirm.value]}`
              : confirm?.kind === "reputation"
                ? "将声望归零？"
                : confirm?.kind === "toggle_fde"
                  ? user.is_verified_fde
                    ? "取消官方 FDE 认证？"
                    : "标记为官方认证 FDE？"
                  : "重置该用户密码？"
        }
        description={
          confirm?.kind === "reset_password"
            ? "将生成随机新密码，旧密码立即失效。新密码仅显示一次。"
            : "此操作会写入稽核日志。"
        }
        confirmLabel="确认"
        loading={submitting}
        reasonRequired={confirm?.kind !== "reset_password"}
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
