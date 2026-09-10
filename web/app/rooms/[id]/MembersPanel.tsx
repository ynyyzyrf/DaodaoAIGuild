"use client";

import { Users } from "lucide-react";
import type { RoomDetailOut } from "@/lib/types";

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

export function MembersPanel({ room }: { room: RoomDetailOut }) {
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
    </div>
  );
}
