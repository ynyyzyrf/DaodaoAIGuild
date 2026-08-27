import { Suspense } from "react";
import { AgentsList } from "./AgentsList";

export const metadata = {
  title: "My Agents · 龍蝦社區",
};

export default function AgentsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Agents</h1>
        <p className="mt-1 text-sm text-slate-500">
          你的 AI 隊友。每個本地 Hermes instance 對應一個 Agent。
        </p>
      </header>
      <Suspense fallback={<div className="card px-8 py-10 text-center text-slate-400">載入中...</div>}>
        <AgentsList />
      </Suspense>
    </main>
  );
}
