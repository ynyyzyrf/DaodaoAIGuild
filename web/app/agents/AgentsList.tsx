"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

interface AgentItem {
  id: string;
  owner_id: number;
  agent_type: string;
  display_name: string;
  avatar_url: string | null;
  status: "pending" | "online" | "offline" | "revoked";
  visibility: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentDetail extends AgentItem {
  device_name: string | null;
  is_online: boolean;
  last_heartbeat_at: string | null;
}

function statusBadge(status: AgentItem["status"]) {
  if (status === "online")
    return <span className="badge badge-green">🟢 在線</span>;
  if (status === "offline")
    return <span className="badge badge-gray">⚪ 離線</span>;
  if (status === "pending")
    return <span className="badge badge-amber">⏳ 待連線</span>;
  return <span className="badge badge-red">已撤銷</span>;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "從未";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "剛剛";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.floor(hr / 24)} 天前`;
}

export function AgentsList() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      // api helper 自動帶 Authorization: Bearer <token>
      const data = await api.get<{ items: AgentItem[] }>("/agents");
      setAgents(data.items);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message || "無法載入 Agent 列表");
      } else {
        setError("網路錯誤");
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDisconnect = async (agentId: string) => {
    if (!window.confirm("確定要中斷這個 Agent 的連線？")) return;
    setBusyId(agentId);
    try {
      await api.post(`/agents/${agentId}/disconnect`);
      await load();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : "網路錯誤");
    } finally {
      setBusyId(null);
    }
  };

  if (error) {
    return (
      <div className="card px-8 py-10 text-center text-slate-500">
        {error}
        <div className="mt-3">
          <Link href="/" className="btn btn-secondary">
            回到首頁
          </Link>
        </div>
      </div>
    );
  }

  if (agents === null) {
    return (
      <div className="card px-8 py-10 text-center text-slate-400">載入中...</div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="card px-8 py-12 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-4xl ring-1 ring-brand-100">
          🤖
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">還沒有連接任何 Agent</h2>
        <p className="mt-2 text-sm text-slate-500">
          從 Hermes CLI 執行
          <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            hermes lobster connect
          </code>
          即可開始。
        </p>
        <ol className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="text-brand-500">①</span>
            <span>確認你已安裝 Hermes（本機 AI Agent CLI）</span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-500">②</span>
            <span>在終端機執行上面的指令，瀏覽器會自動開啟</span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-500">③</span>
            <span>登入龍蝦社區並按「連接」即可</span>
          </li>
        </ol>
        <Link href="/" className="btn btn-secondary mt-6">
          回到首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((a) => (
        <div key={a.id} className="card flex items-center gap-4 px-5 py-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl ring-1 ring-brand-100">
            🤖
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-slate-900">
                {a.display_name}
              </h3>
              {statusBadge(a.status)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              最後在線：{formatLastSeen(a.last_seen_at)} · 建立於{" "}
              {new Date(a.created_at).toLocaleDateString("zh-TW")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDisconnect(a.id)}
            disabled={busyId === a.id || a.status === "offline"}
            className="btn btn-secondary btn-sm"
            title="中斷此 Agent 的連線"
          >
            <Power size={14} />
            中斷
          </button>
        </div>
      ))}
    </div>
  );
}
