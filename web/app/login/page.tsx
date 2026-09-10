"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { notifyAuthChanged, setAuthSession } from "@/lib/auth";
import { isOmeAccountConfigured, loginWithOmeAccount } from "@/lib/ome-account";

const registerUrl = "https://ome-account.omenow.com/account/register";

async function readApiBody(res: Response, fallback: string) {
  try {
    return await res.json();
  } catch {
    throw new Error(fallback);
  }
}

function LoginForm() {
  const router = useRouter();
  useSearchParams();
  const next = "/orders/new";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const omeEnabled = isOmeAccountConfigured();

  function displayError(message: string) {
    const normalized = message.trim();
    if (!normalized) return "登入失敗，請稍後再試";
    const map: Record<string, string> = {
      "系统登录建立失败": "登入狀態建立失敗，請稍後再試",
      "登录失败": "登入失敗，請確認帳號或密碼",
      "用户名或密码错误": "帳號或密碼錯誤",
      "网络错误，请稍后重试": "網路異常，請稍後再試",
    };
    return map[normalized] ?? normalized;
  }

  async function completeSystemLogin(accessToken: string) {
    const res = await fetch("/api/v1/auth/ome-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_token: accessToken }),
    });
    const body = await readApiBody(res, "登入狀態建立失敗，請稍後再試");
    if (!res.ok || body.code !== 0) {
      throw new Error(body.message || "系统登录建立失败");
    }
    setAuthSession(body.data.access_token, body.data.refresh_token, body.data.user);
  }

  async function loginWithLocalAccount() {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await readApiBody(res, "登入失敗，請稍後再試");
    if (!res.ok || body.code !== 0) {
      throw new Error(body.message || "登录失败");
    }
    setAuthSession(body.data.access_token, body.data.refresh_token, body.data.user);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("請輸入帳號與密碼");
      return;
    }
    setLoading(true);
    try {
      if (omeEnabled) {
        const omeSession = await loginWithOmeAccount(username, password);
        await completeSystemLogin(omeSession.accessToken);
      } else {
        await loginWithLocalAccount();
      }
      notifyAuthChanged();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(displayError(err instanceof Error ? err.message : "网络错误，请稍后重试"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="px-8 pb-3 pt-8 sm:px-9">
        <h1 className="text-2xl font-bold text-slate-950">登入 Daostore AI Guild</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">繼續你的項目與協作。</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 px-8 pb-8 pt-4 sm:px-9">
        <div>
          <label className="label" htmlFor="login-username">
            帳號
          </label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input mt-2 h-11"
            placeholder="請輸入帳號"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="login-password">
            密碼
          </label>
          <div className="relative mt-2">
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              className="input h-11 pr-12"
              placeholder="請輸入密碼"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
              {showPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
            </button>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary h-11 w-full">
          <LogIn size={16} strokeWidth={2} />
          {loading ? "登入中…" : "登入"}
        </button>
        <a
          href={registerUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
        >
          還沒有帳號？建立帳號
        </a>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto grid min-h-[calc(100vh-5.5rem)] w-full max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-28 lg:py-14">
        <section className="min-w-0">
          <h2 className="max-w-2xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            讓 AI 需求，
            <br />
            找到落地的夥伴。
        </h2>
          <p className="mt-6 max-w-none text-sm leading-8 text-slate-600 min-[520px]:whitespace-nowrap sm:text-base lg:text-lg">
            連結企業、諮詢公司與 AI 實戰者，從需求對接到項目交付，在這裡展開協作。
        </p>
        </section>
        {/* useSearchParams 必須包在 Suspense 里，否則 build 會報警告 */}
        <Suspense fallback={<div className="card px-8 py-10 text-center text-slate-400">載入中...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
