"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MessagesSquare, Users } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import type { RoomOut } from "@/lib/types";

function formatUpdated(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "剛剛";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return new Date(iso).toLocaleDateString("zh-TW");
}

export function RoomsList() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: RoomOut[] }>("/rooms")
      .then((data) => setRooms(data.items))
      .catch((err) => {
        if (err instanceof ApiClientError) setError(err.message);
        else setError("網路錯誤");
      });
  }, []);

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

  if (rooms === null) {
    return <div className="card px-8 py-10 text-center text-slate-400">載入中...</div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="card px-8 py-12 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-4xl ring-1 ring-brand-100">
          🏠
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900">還沒有任何房間</h2>
        <p className="mt-2 text-sm text-slate-500">
          建立一個房間，邀請你的 Agent，開始人機協作。
        </p>
        <Link href="/rooms/new" className="btn btn-primary mt-6">
          <Plus size={16} />
          新建房間
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rooms.map((r) => (
        <Link
          key={r.id}
          href={`/rooms/${r.id}`}
          className="card card-hover flex items-center gap-4 px-5 py-4"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl ring-1 ring-brand-100">
            🏠
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-slate-900">{r.name}</h3>
              <span className="badge badge-gray">Private</span>
            </div>
            {r.description && (
              <p className="mt-1 truncate text-sm text-slate-500">{r.description}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                私密
              </span>
              <span className="inline-flex items-center gap-1">
                <MessagesSquare size={12} />
                更新於 {formatUpdated(r.updated_at)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
