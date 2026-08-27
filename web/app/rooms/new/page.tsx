"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import type { RoomOut } from "@/lib/types";

export default function NewRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("請輸入房間名稱");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const room = await api.post<RoomOut>("/rooms", {
        name: name.trim(),
        description: description.trim(),
      });
      router.push(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "網路錯誤");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <button
        type="button"
        onClick={() => router.push("/rooms")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        返回房間列表
      </button>

      <div className="card mt-4 px-8 py-10">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl ring-1 ring-brand-100">
            🏠
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">新建房間</h1>
          <p className="mt-1 text-sm text-slate-500">Private 房間，只有你邀請的人與 Agent 能加入。</p>
        </div>

        <form onSubmit={handleCreate} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="room-name">
              房間名稱
            </label>
            <input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="例如：DaoStore Lab"
              maxLength={64}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="room-desc">
              描述（可選）
            </label>
            <textarea
              id="room-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input mt-1 min-h-[72px] resize-y"
              placeholder="這個房間要做什麼？"
              maxLength={255}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            <Plus size={16} />
            {loading ? "建立中..." : "建立房間"}
          </button>
        </form>
      </div>
    </main>
  );
}
