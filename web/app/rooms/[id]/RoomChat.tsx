"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { getToken } from "@/lib/auth";
import type { RoomDetailOut, RoomMemberOut, RoomMessageOut } from "@/lib/types";
import { roomsWsUrl } from "@/lib/ws";
import { MembersPanel } from "./MembersPanel";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg }: { msg: RoomMessageOut }) {
  const isAgent = msg.sender.type === "agent";
  return (
    <div className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ring-1 ${
          isAgent ? "bg-brand-50 ring-brand-100" : "bg-slate-100 ring-slate-200"
        }`}
      >
        {isAgent ? "🤖" : "🦞"}
      </span>
      <div className={`max-w-[70%] ${isAgent ? "" : "text-right"}`}>
        <div className={`text-xs text-slate-400 ${isAgent ? "" : "text-right"}`}>
          {msg.sender.name}
          {isAgent && <span className="ml-1 text-brand-500">Agent</span>}
          <span className="ml-2">{formatTime(msg.created_at)}</span>
        </div>
        <div
          className={`mt-0.5 inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isAgent
              ? "rounded-tl-sm bg-white text-slate-800 ring-1 ring-slate-200"
              : "rounded-tr-sm bg-brand-500 text-white"
          }`}
        >
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export function RoomChat({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomDetailOut | null>(null);
  const [messages, setMessages] = useState<RoomMessageOut[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [sending, setSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agentMembers = (room?.members ?? []).filter((m) => m.type === "agent");

  // 載入房間 + 消息
  useEffect(() => {
    Promise.all([
      api.get<RoomDetailOut>(`/rooms/${roomId}`),
      api.get<{ items: RoomMessageOut[] }>(`/rooms/${roomId}/messages`),
    ])
      .then(([r, m]) => {
        setRoom(r);
        setMessages(m.items);
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 403) {
          setError("你不是這個房間的成員");
        } else {
          setError(err instanceof ApiClientError ? err.message : "網路錯誤");
        }
      });
  }, [roomId]);

  // 捲到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // WS 訂閱 + 自動重連
  useEffect(() => {
    if (!room) return;
    let alive = true;

    const connect = () => {
      // 瀏覽器 WebSocket 無法自訂 header，改用 Sec-WebSocket-Protocol subprotocol 帶 token
      const token = getToken();
      const ws = new WebSocket(roomsWsUrl(), token ? [token] : []);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "room.subscribe", room_ids: [roomId] }));
      };
      ws.onmessage = (e) => {
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (evt.type === "room.message") {
          const msg: RoomMessageOut = {
            id: evt.message_id as string,
            room_id: evt.room_id as string,
            sender: evt.sender as RoomMessageOut["sender"],
            content: evt.content as string,
            reply_to_message_id: (evt.reply_to_message_id as string) ?? null,
            mentioned_agent_ids: (evt.mentioned_agent_ids as number[]) ?? [],
            created_at: evt.created_at as string,
          };
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        } else if (evt.type === "room.typing") {
          const status = Boolean(evt.status);
          const name = evt.agent_name as string;
          setTyping(status ? name : null);
        }
      };
      ws.onclose = () => {
        if (!alive) return;
        // 3 秒後自動重連
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      alive = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [room, roomId]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setMentionOpen(false);
    setSending(true);
    try {
      const msg = await api.post<RoomMessageOut>(`/rooms/${roomId}/messages`, { content });
      // 樂觀 append：立即顯示自己發的消息（WS 廣播到時按 id 去重，不會重複）
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "發送失敗");
      setInput(content); // 失敗時恢復輸入
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const match = value.match(/@([^\s@]*)$/);
    if (match && agentMembers.length > 0) {
      setMentionQuery(match[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (agentName: string) => {
    setInput((prev) => prev.replace(/@[^\s@]*$/, `@${agentName} `));
    setMentionOpen(false);
  };

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="card px-8 py-10 text-center text-slate-500">
          {error}
          <div className="mt-3">
            <button type="button" onClick={() => router.push("/rooms")} className="btn btn-secondary">
              返回房間列表
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="card px-8 py-10 text-center text-slate-400">載入中...</div>
      </main>
    );
  }

  const filteredAgents = agentMembers.filter((a) =>
    a.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      {/* 頂欄 */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/rooms")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-2xl">🏠</span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-900">{room.name}</h1>
          {room.description && (
            <p className="truncate text-xs text-slate-500">{room.description}</p>
          )}
        </div>
      </div>

      {/* 主體：聊天 + 成員 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="card flex h-[calc(100vh-180px)] flex-col overflow-hidden">
          {/* 消息區 */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
            {messages.length === 0 && (
              <div className="pt-16 text-center text-sm text-slate-400">
                還沒有消息。輸入 <span className="font-mono">@AgentName</span> 來呼叫你的 Agent。
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {typing && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-base ring-1 ring-brand-100">
                  🤖
                </span>
                <span>
                  {typing} is working<span className="animate-pulse">...</span>
                </span>
              </div>
            )}
          </div>

          {/* 輸入區 */}
          <div className="relative border-t border-slate-200 p-3">
            {mentionOpen && filteredAgents.length > 0 && (
              <div className="card absolute bottom-full left-3 mb-2 w-64 p-1.5 shadow-[0_8px_30px_rgba(16,24,40,0.12)]">
                {filteredAgents.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => insertMention(a.name)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  >
                    <span className="text-base">🤖</span>
                    <span className="flex-1">{a.name}</span>
                    <span className={`text-xs ${a.is_online ? "text-green-600" : "text-slate-400"}`}>
                      {a.is_online ? "在線" : "離線"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <textarea
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="輸入訊息... 用 @ 呼叫 Agent"
                className="input min-h-[44px] flex-1 resize-none py-2.5"
                rows={1}
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || sending}
                className="btn btn-primary h-[44px] px-4"
              >
                <Send size={16} />
                發送
              </button>
            </div>
          </div>
        </div>

        <MembersPanel room={room} onAgentInvited={() => window.location.reload()} />
      </div>
    </main>
  );
}
