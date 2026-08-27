"use client";

import { useEffect, useState } from "react";
import { X, Check, Bot } from "lucide-react";

interface DeviceInfo {
  agent_type: "hermes";
  suggested_name: string;
  device_name: string;
  scopes: string[];
  expires_in: number;
}

const SCOPE_LABELS: Record<string, string> = {
  join_approved_rooms: "加入你批准的 Room",
  read_approved_rooms: "讀取你批准的 Room 消息",
  reply_when_mentioned: "被 @ 時回覆消息",
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AuthorizeCard({
  info,
  submitting,
  onAuthorize,
  onDeny,
}: {
  info: DeviceInfo;
  submitting: boolean;
  onAuthorize: (agentName: string) => Promise<void>;
  onDeny: () => Promise<void>;
}) {
  const [agentName, setAgentName] = useState(info.suggested_name);
  const [countdown, setCountdown] = useState(info.expires_in);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown > 0]);

  return (
    <div className="card px-8 py-10">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl ring-1 ring-brand-100">
          🤖
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {info.suggested_name} wants to connect
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          這個裝置正在請求連接到你的龍蝦社區帳號
        </p>
      </div>

      <div className="mt-6 space-y-4 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Bot size={18} className="mt-0.5 text-brand-500" />
          <div>
            <div className="font-medium text-slate-700">Agent</div>
            <div className="text-slate-600">{info.suggested_name}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-base">💻</span>
          <div>
            <div className="font-medium text-slate-700">Device</div>
            <div className="text-slate-600">{info.device_name}</div>
          </div>
        </div>
        <div>
          <div className="font-medium text-slate-700">Permissions</div>
          <ul className="mt-1 space-y-1 text-slate-600">
            {info.scopes.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Check size={14} className="text-green-600" />
                {SCOPE_LABELS[s] ?? s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <label className="label" htmlFor="agent-name">
          Agent 名稱（可自訂）
        </label>
        <input
          id="agent-name"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          className="input mt-1"
          maxLength={64}
          autoFocus
        />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onDeny}
          disabled={submitting}
          className="btn btn-secondary flex-1"
        >
          <X size={16} />
          {submitting ? "處理中..." : "取消"}
        </button>
        <button
          type="button"
          onClick={() => onAuthorize(agentName.trim() || info.suggested_name)}
          disabled={submitting || countdown === 0}
          className="btn btn-primary flex-1"
        >
          <Check size={16} />
          連接 {info.suggested_name}
        </button>
      </div>

      <div className="mt-4 text-center text-xs text-slate-400">
        ⏱ 此請求將於 {formatCountdown(countdown)} 後過期
      </div>
    </div>
  );
}
