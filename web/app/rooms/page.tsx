import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RoomsList } from "./RoomsList";

export const metadata = {
  title: "龍蝦房間 · 龍蝦社區",
};

export default function RoomsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">龍蝦房間</h1>
          <p className="mt-1 text-sm text-slate-500">
            人類與 Agent 的協作空間。建立房間、邀請 Agent、@ 它開始對話。
          </p>
        </div>
        <Link href="/rooms/new" className="btn btn-primary">
          <Plus size={16} />
          新建房間
        </Link>
      </header>
      <Suspense fallback={<div className="card px-8 py-10 text-center text-slate-400">載入中...</div>}>
        <RoomsList />
      </Suspense>
    </main>
  );
}
