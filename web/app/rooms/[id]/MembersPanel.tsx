"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, UserPlus, Users } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import type { AgentOut, RoomDetailOut } from "@/lib/types";

function MemberRow({
  type,
  name,
  isOnline,
  isOwner,
  isAgent,
}: {
  type: "user" | "agent";
  name: string;
  isOnline: boolean;
  isOwner: boolean;
  isAgent: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ring-1 ${
          isAgent ? "bg-brand-50 ring-brand-100" : "bg-slate-100 ring-slate-200"
        }`}
      >
        {isAgent ? "🤖" : "🦞"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-800">{name}</span>
          {isOwner && <span className="badge badge-red text-[10px]">Owner</span>}
          {isAgent && <span className="badge badge-gray text-[10px]">Agent</span>}
        </div>
      </div>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isOnline ? "bg-green-500" : "bg-slate-300"
        }`}
        title={isOnline ? "在線" : "離線"}
      />
    </div>
  );
}

export function MembersPanel({
  room,
  onAgentInvited,
}: {
  room: RoomDetailOut;
  onAgentInvited: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  const [myAgents, setMyAgents] = useState<AgentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberAgentIds = new Set(
    room.members.filter((m) => m.type === "agent").map((m) => m.id)
  );

  const openInvite = async () => {
    setInviting(true);
    setError(null);
    try {
      const data = await api.get<{ items: AgentOut[] }>("/agents");
      setMyAgents(data.items.filter((a) => !memberAgentIds.has(a.id)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "無法載入 Agent 列表");
    }
  };

  const inviteAgent = async (agentId: string) => {
    setBusyId(agentId);
    try {
      await api.post(`/rooms/${room.id}/agents`, { agent_id: agentId });
      onAgentInvited();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "邀請失敗");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Users size={15} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-800">成員</span>
        <span className="text-xs text-slate-400">{room.members.length}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        {room.members.map((m) => (
          <MemberRow
            key={`${m.type}-${m.id}`}
            type={m.type}
            name={m.name}
            isOnline={m.is_online}
            isOwner={m.is_owner}
            isAgent={m.type === "agent"}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 p-3">
        {inviting ? (
          <div>
            {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
            {myAgents === null ? (
              <p className="text-xs text-slate-400">載入中...</p>
            ) : myAgents.length === 0 ? (
              <p className="text-xs text-slate-400">
                沒有可邀請的 Agent（只有你自己的 Agent 可以邀請）
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {myAgents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => inviteAgent(a.id)}
                    disabled={busyId === a.id}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Bot size={15} className="text-brand-500" />
                    <span className="flex-1 truncate">{a.display_name}</span>
                    <span
                      className={`text-xs ${a.status === "online" ? "text-green-600" : "text-slate-400"}`}
                    >
                      {a.status === "online" ? "在線" : "離線"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setInviting(false)}
              className="btn btn-ghost btn-sm mt-2 w-full"
            >
              取消
            </button>
          </div>
        ) : (
          <button type="button" onClick={openInvite} className="btn btn-secondary btn-sm w-full">
            <UserPlus size={14} />
            邀請 Agent
          </button>
        )}
      </div>
    </div>
  );
}
