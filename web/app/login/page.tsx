"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { notifyAuthChanged } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 登录成功后跳回原页面（被 client.ts 401 重定向带过来）；仅接受同源相对路径防 open redirect
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok || body.code !== 0) {
        setError(body.message || "登录失败");
        return;
      }
      localStorage.setItem("token", body.data.access_token);
      localStorage.setItem("user", JSON.stringify(body.data.user));
      notifyAuthChanged();
      router.push(next);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card px-8 py-10">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl ring-1 ring-brand-100">
          🦞
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">龍蝦騎士登录</h1>
        <p className="mt-1 text-sm text-slate-500">登录后发起问题、发布教程、积累声望</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="login-username">
            账号
          </label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input mt-1"
            placeholder="用户名"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="login-password">
            密码
          </label>
          <input
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="input mt-1"
            placeholder="密码"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          <LogIn size={16} strokeWidth={2} />
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      {/* useSearchParams 必须包在 Suspense 里，否则 build 报警告 */}
      <Suspense fallback={<div className="card px-8 py-10 text-center text-slate-400">加载中...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
