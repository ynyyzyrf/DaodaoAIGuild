"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { adminLogin } from "@/lib/admin-api";
import { getAdminUser, setAdminSession } from "@/lib/admin-auth";
import type { AdminUser } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 已在前台登录的管理员无需再登录，直接进后台
  useEffect(() => {
    const cached = getAdminUser<AdminUser>();
    if (cached?.is_admin === true) {
      router.replace("/admin");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await adminLogin(username, password);
      setAdminSession(data.access_token, data.user);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="card w-full max-w-sm px-8 py-10">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl ring-1 ring-brand-100">
            🦞
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">管理后台登录</h1>
          <p className="mt-1 text-sm text-slate-500">DaoDao FDE 社区运营控制台</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="admin-username">
              账号
            </label>
            <input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input mt-1"
              placeholder="管理员用户名"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="admin-password">
              密码
            </label>
            <input
              id="admin-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="input mt-1"
              placeholder="密码"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-500">
              <ShieldAlert size={14} strokeWidth={2} />
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? "登录中..." : "登录后台"}
          </button>
        </form>
      </div>
    </div>
  );
}
