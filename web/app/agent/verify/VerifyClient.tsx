"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { getToken } from "@/lib/auth";
import { AuthorizeCard } from "./AuthorizeCard";
import { ErrorState, type ErrorReason } from "./ErrorState";

interface DeviceInfo {
  agent_type: "hermes";
  suggested_name: string;
  device_name: string;
  scopes: string[];
  expires_in: number;
}

interface AuthorizeResponse {
  agent_id: string;
  display_name: string;
  status: string;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "expired_no_token" }
  | { kind: "error"; reason: ErrorReason }
  | { kind: "ready"; info: DeviceInfo; verificationToken: string }
  | { kind: "submitting" }
  | { kind: "denying" }
  | { kind: "success"; agentId: string; displayName: string };

/**
 * Agent 授權頁 Client Component。
 *
 * 流程：
 * 1. 從 window.location.hash 讀 vt=<token>；跳轉後 fragment 會丟失，故同時存 sessionStorage
 * 2. 檢查登入（未登入先存 vt 再導去 /login?next=/agent/verify，登入後回來從 sessionStorage 讀回）
 * 3. api.get /api/v1/agent/device/info 拿 device 詳情
 * 4. 渲染 AuthorizeCard
 * 5. 確認 → api.post /api/v1/agent/device/authorize → success
 * 6. 拒絕 → api.post /api/v1/agent/device/deny → 關閉視窗
 *
 * 「無任何 token 進 URL path/query」原則：verification_token 只在 body，
 * URL 只有 fragment，server log 看不到；sessionStorage 是瀏覽器本地，也不會送達 server。
 */
const VT_SESSION_KEY = "daodao:verify-vt";

export function VerifyClient() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.slice(1));
    const vtFromFragment = params.get("vt");
    // fragment 在跳轉 /login 後會丟失，從 sessionStorage 讀回上次保存的 vt
    const vt = vtFromFragment ?? sessionStorage.getItem(VT_SESSION_KEY);
    if (!vt) {
      setView({ kind: "expired_no_token" });
      return;
    }
    // 先存起來（若 fragment 還在；之後跳轉回來靠它恢復）
    sessionStorage.setItem(VT_SESSION_KEY, vt);

    // 未登入：先存 vt（上面已存），再導去登入，登入後跳回本頁
    if (!getToken()) {
      const next = encodeURIComponent("/agent/verify");
      window.location.assign(`/login?next=${next}`);
      return;
    }

    // 已登入：拿 device info（api helper 自動帶 Bearer token）
    api
      .post<DeviceInfo>("/agent/device/info", { verification_token: vt })
      .then((info) => {
        setView({ kind: "ready", info, verificationToken: vt });
      })
      .catch((err) => {
        if (err instanceof ApiClientError) {
          if (err.status === 410 || err.code === 50006) {
            setView({ kind: "error", reason: "expired" });
          } else if (err.status === 404) {
            setView({ kind: "error", reason: "not_found" });
          } else {
            setView({ kind: "error", reason: "unknown" });
          }
        } else {
          setView({ kind: "error", reason: "network" });
        }
      });
  }, []);

  const handleAuthorize = async (agentName: string) => {
    if (view.kind !== "ready") return;
    setView({ kind: "submitting" });
    try {
      const data = await api.post<AuthorizeResponse>("/agent/device/authorize", {
        verification_token: view.verificationToken,
        agent_name: agentName,
      });
      sessionStorage.removeItem(VT_SESSION_KEY); // 授權完成，清掉本地 vt
      setView({
        kind: "success",
        agentId: data.agent_id,
        displayName: data.display_name,
      });
    } catch {
      setView({ kind: "error", reason: "unknown" });
    }
  };

  const handleDeny = async () => {
    if (view.kind !== "ready") return;
    setView({ kind: "denying" });
    try {
      await api.post("/agent/device/deny", {
        verification_token: view.verificationToken,
      });
    } catch {
      // ignore
    }
    sessionStorage.removeItem(VT_SESSION_KEY);
    // 嘗試關閉視窗；瀏覽器不允許時 fallback 到首頁
    if (typeof window !== "undefined") {
      window.close();
      setTimeout(() => router.push("/"), 100);
    }
  };

  if (view.kind === "loading") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="card px-8 py-10 text-center text-slate-400">載入中...</div>
      </main>
    );
  }

  if (view.kind === "expired_no_token") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <ErrorState reason="missing_token" />
      </main>
    );
  }

  if (view.kind === "error") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <ErrorState reason={view.reason} />
      </main>
    );
  }

  if (view.kind === "success") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="card px-8 py-10 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-3xl">
            ✓
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">連接成功</h1>
          <p className="mt-2 text-sm text-slate-600">
            <strong>{view.displayName}</strong> 已連接到你的龍蝦社區帳號
          </p>
          <p className="mt-1 text-xs text-slate-400">可以關閉這個視窗，回到 Hermes 繼續操作</p>
        </div>
      </main>
    );
  }

  // ready / submitting / denying
  const info = view.kind === "ready" ? view.info : null;
  if (!info) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="card px-8 py-10 text-center text-slate-400">處理中...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <AuthorizeCard
        info={info}
        submitting={view.kind === "submitting" || view.kind === "denying"}
        onAuthorize={handleAuthorize}
        onDeny={handleDeny}
      />
    </main>
  );
}
