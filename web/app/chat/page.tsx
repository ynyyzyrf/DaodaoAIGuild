"use client";

import { type FormEvent, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Bot, Clock3, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, SendHorizonal } from "lucide-react";

import { sendChatMessage } from "@/lib/api";
import type { RequirementDraft } from "@/lib/types";

type ChatRole = "user" | "assistant";
type ComposerMode = "chat" | "requirement" | "requirement_review";

type RequirementComposerState = {
  mode: Exclude<ComposerMode, "chat">;
  conversationId: string;
  currentField: keyof RequirementDraft | null;
  draft: RequirementDraft;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  action?: "open_requirement_form" | null;
  requirementDraft?: RequirementDraft | null;
};

type ChatConversation = {
  id: string;
  title: string;
  conversationId: string | null;
  messages: ChatMessage[];
  updatedAt: number;
};

const STORAGE_KEY = "daostore.chat.conversations.v1";

function createConversation(initialTitle = "新的需求對話"): ChatConversation {
  const now = Date.now();
  return {
    id: `local-${now}-${Math.random().toString(16).slice(2)}`,
    title: initialTitle,
    conversationId: null,
    messages: [],
    updatedAt: now,
  };
}

function titleFrom(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized || "新的需求對話";
}

function loadConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatConversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((conversation) => ({
      ...conversation,
      messages: (conversation.messages ?? []).map((message) =>
        message.action === "open_requirement_form"
          ? {
              ...message,
              action: null,
              requirementDraft: null,
            }
          : message,
      ),
    }));
  } catch {
    return [];
  }
}

function saveConversations(items: ChatConversation[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
}

function createEmptyRequirementDraft(): RequirementDraft {
  return {
    enterprise_name: "",
    contact_name: "",
    contact_email: "",
    product_name: "",
    title: "",
    description: "",
    business_background: "",
    deliverable_expectation: "",
    budget_note: "",
    expected_delivery_at: null,
  };
}

function normalizeRequirementDraft(draft?: RequirementDraft | null): RequirementDraft {
  return { ...createEmptyRequirementDraft(), ...(draft ?? {}) };
}

function RailIconButton({
  label,
  children,
  className = "",
  onClick,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative inline-flex shrink-0 items-center justify-center rounded-xl border transition ${className}`}
    >
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("message") ?? "";
  const consumedInitialRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [requirementComposer, setRequirementComposer] = useState<RequirementComposerState | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? conversations[0] ?? null,
    [activeId, conversations],
  );

  useEffect(() => {
    const stored = loadConversations();
    const next = stored.length > 0 ? stored : [createConversation()];
    setConversations(next);
    setActiveId(next[0].id);
  }, []);

  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages, loading]);

  useEffect(() => {
    const text = initialMessage.trim();
    if (!text || consumedInitialRef.current || conversations.length === 0) return;
    consumedInitialRef.current = true;
    const next = createConversation(titleFrom(text));
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    router.replace("/chat");
    void sendMessage(text, next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, conversations.length]);

  function updateConversation(id: string, updater: (item: ChatConversation) => ChatConversation) {
    setConversations((prev) =>
      prev
        .map((item) => (item.id === id ? updater(item) : item))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  }

  function handleNewConversation() {
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    setInput("");
    setError("");
  }

  function handleOpenHistory() {
    setSidebarCollapsed(false);
    window.setTimeout(() => {
      historySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function sendMessage(
    query: string,
    targetId = activeConversation?.id,
    options: { intentConfirmed?: boolean; requirement?: RequirementDraft } = {},
  ) {
    if (!targetId || loading) return;
    const content = query.trim();
    if (!content) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    setError("");
    setLoading(true);
    setInput("");
    updateConversation(targetId, (item) => ({
      ...item,
      title: item.messages.length === 0 ? titleFrom(content) : item.title,
      messages: [...item.messages, userMessage],
      updatedAt: Date.now(),
    }));

    const current = conversations.find((item) => item.id === targetId);
    try {
      const data = await sendChatMessage(content, current?.conversationId, options);
      const assistantMessage: ChatMessage = {
        id: data.message_id || `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "我收到你的需求了，但暫時沒有生成具體回覆。",
        action: null,
        requirementDraft: null,
      };
      if (data.action === "open_requirement_form") {
        setRequirementComposer(createRequirementComposerState(targetId, data.requirement_draft));
      }
      updateConversation(targetId, (item) => ({
        ...item,
        conversationId: data.conversation_id,
        messages: [...item.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "發送失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function handleRequirementComposerChange(field: keyof RequirementDraft, value: RequirementDraft[keyof RequirementDraft]) {
    setRequirementComposer((current) =>
      current ? { ...current, draft: { ...current.draft, [field]: value } } : current,
    );
  }

  function handleRequirementComposerNext() {
    setRequirementComposer((current) => {
      if (!current) return current;
      const nextDraft = normalizeRequirementDraft(current.draft);
      const nextField = getNextRequirementField(current.currentField);
      return nextField
        ? { ...current, currentField: nextField, draft: nextDraft, mode: "requirement" }
        : { ...current, mode: "requirement_review", currentField: null, draft: nextDraft };
    });
  }

  function handleRequirementComposerPrevious() {
    setRequirementComposer((current) => {
      if (!current) return current;
      const previousField = getPreviousRequirementField(current.currentField);
      return previousField ? { ...current, currentField: previousField, mode: "requirement" } : current;
    });
  }

  function handleRequirementComposerBackToEdit() {
    setRequirementComposer((current) =>
      current
        ? {
            ...current,
            mode: "requirement",
            currentField: getFirstRequirementField(current.draft) ?? requirementFields[0].key,
          }
        : current,
    );
  }

  function handleRequirementComposerCancel() {
    setRequirementComposer(null);
    setError("");
  }

  async function handleConfirmRequirement(draft: RequirementDraft) {
    if (loading) return;
    const content = `確認提交需求：${draft.title.trim() || "未命名需求"}`;
    const conversationId = requirementComposer?.conversationId || activeConversation?.id;
    if (!conversationId) return;

    setError("");
    setLoading(true);

    const current = conversations.find((item) => item.id === conversationId);
    try {
      const data = await sendChatMessage(content, current?.conversationId, {
        intentConfirmed: true,
        requirement: draft,
      });
      const assistantMessage: ChatMessage = {
        id: data.message_id || `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "收到，我已經把需求提交了。接下來我可以繼續幫你看看適合的 FDE 或解決方案。",
        action: null,
        requirementDraft: null,
      };
      setRequirementComposer(null);
      updateConversation(conversationId, (item) => ({
        ...item,
        conversationId: data.conversation_id || item.conversationId,
        messages: [...item.messages, assistantMessage],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <main className="h-[calc(100vh-64px)] bg-[#fafaf9]">
      <div className="flex h-full min-h-0">
        <aside
          className={`hidden shrink-0 border-r border-slate-100 bg-white/80 transition-[width] duration-200 lg:flex lg:flex-col ${
            sidebarCollapsed ? "w-[72px] items-center px-3 py-4" : "w-[292px] p-4"
          }`}
        >
          {sidebarCollapsed ? (
            <>
              <RailIconButton
                label="新對話"
                onClick={handleNewConversation}
                className="h-11 w-11 border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100/80"
              >
                <Plus size={18} strokeWidth={2.5} />
              </RailIconButton>

              <RailIconButton
                label="展開側邊欄"
                onClick={() => setSidebarCollapsed(false)}
                className="mt-3 h-10 w-10 border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
              >
                <PanelLeftOpen size={18} strokeWidth={2.3} />
              </RailIconButton>

              <RailIconButton
                label="歷史記錄"
                onClick={handleOpenHistory}
                className="mt-6 h-10 w-10 border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
              >
                <Clock3 size={18} strokeWidth={2.3} />
              </RailIconButton>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNewConversation}
                  className="btn h-11 flex-1 border border-brand-100 bg-brand-50 text-brand-700 shadow-none hover:bg-brand-100/80"
                >
                  <Plus size={16} strokeWidth={2.4} />
                  新對話
                </button>
                <RailIconButton
                  label="收起側邊欄"
                  onClick={() => setSidebarCollapsed(true)}
                  className="h-11 w-11 border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                >
                  <PanelLeftClose size={18} strokeWidth={2.3} />
                </RailIconButton>
              </div>

              <div
                ref={historySectionRef}
                className="mt-5 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400"
              >
                <Clock3 size={14} strokeWidth={2.2} />
                歷史記錄
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {conversations.map((item) => {
                  const active = item.id === activeConversation?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveId(item.id);
                        setError("");
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                        active
                          ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                          : "text-slate-600 hover:bg-brand-50/50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageSquareText size={16} strokeWidth={2.3} className="shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{item.title}</div>
                        {active && <div className="mt-0.5 text-xs font-medium text-slate-400">{item.messages.length} 則消息</div>}
                      </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#fafaf9]">
          <div className="bg-white/72 px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[920px] items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-600">
                  <SparkIcon />
                  需求對話
                </div>
                <h1 className="mt-1.5 truncate text-2xl font-black leading-8 text-slate-950">
                  {activeConversation?.title || "新的需求對話"}
                </h1>
              </div>
              <button type="button" onClick={handleNewConversation} className="btn btn-secondary h-10 lg:hidden">
                <Plus size={16} strokeWidth={2.4} />
                新對話
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[900px] space-y-5 pb-6">
              {!activeConversation || activeConversation.messages.length === 0 ? (
                <div className="rounded-2xl bg-white/70 p-7 text-center shadow-[0_8px_30px_rgba(16,24,40,0.04)]">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <MessageSquareText size={22} strokeWidth={2.3} />
                  </div>
                  <h2 className="mt-4 text-xl font-black text-slate-950">你好，我是 DaoStore 小助手</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500">
                    有什麼企業需求、FDE 或解決方案相關的事，都可以直接跟我說。你也可以說「我要提交需求」，我會先幫你澄清必要信息。
                  </p>
                </div>
              ) : (
                activeConversation.messages.map((message) => (
                  <MessageBlock key={message.id} message={message} />
                ))
              )}

              {loading && (
                <div className="animate-[message-in_200ms_ease-out] flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Bot size={18} strokeWidth={2.4} />
                  </div>
                  <div className="flex h-9 items-center gap-1.5 rounded-xl bg-white/70 px-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-300" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:240ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="sticky bottom-0 bg-[#fafaf9]/94 px-4 pb-5 pt-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[860px]">
              {error && (
                <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {error}
                </div>
              )}
              {!requirementComposer && (
                <ChatComposer
                  input={input}
                  loading={loading}
                  onInputChange={setInput}
                  onSubmit={handleSubmit}
                  onSend={() => void sendMessage(input)}
                />
              )}
              {requirementComposer?.mode === "requirement" && (
                <RequirementComposer
                  state={requirementComposer}
                  disabled={loading}
                  onChange={handleRequirementComposerChange}
                  onNext={handleRequirementComposerNext}
                  onPrevious={handleRequirementComposerPrevious}
                  onCancel={handleRequirementComposerCancel}
                />
              )}
              {requirementComposer?.mode === "requirement_review" && (
                <RequirementReviewComposer
                  state={requirementComposer}
                  disabled={loading}
                  onBack={handleRequirementComposerBackToEdit}
                  onCancel={handleRequirementComposerCancel}
                  onConfirm={handleConfirmRequirement}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="h-[calc(100vh-64px)] bg-[#fafaf9]" />}>
      <ChatPageContent />
    </Suspense>
  );
}

function MessageBlock({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="animate-[message-in_200ms_ease-out] flex items-start justify-end">
        <div className="max-w-[640px] rounded-2xl rounded-tr-md border border-brand-100 bg-brand-50/90 px-4 py-3 text-sm font-semibold leading-7 text-slate-800">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[message-in_200ms_ease-out] flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Bot size={18} strokeWidth={2.4} />
      </div>
      <div className="max-w-[780px]">
        <div className="rounded-2xl bg-white/60 px-4 py-3">
          <div className="markdown text-[15px] leading-7">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

const requirementFields: Array<{
  key: keyof RequirementDraft;
  label: string;
  reviewLabel: string;
  hint: string;
  required?: boolean;
  multiline?: boolean;
  type?: "text" | "date";
}> = [
  {
    key: "title",
    label: "先給這個需求起個名字吧",
    reviewLabel: "需求名稱",
    hint: "用一句短標題描述它，例如：經銷商開發 Agent。",
    required: true,
  },
  {
    key: "description",
    label: "主要想解決什麼問題？",
    reviewLabel: "要解決的問題",
    hint: "描述要解決的問題、核心能力、使用對象。",
    required: true,
    multiline: true,
  },
  {
    key: "deliverable_expectation",
    label: "你希望最後交付什麼結果？",
    reviewLabel: "期望交付",
    hint: "例如 Agent 原型、工作流、後台頁、線索表、驗收文檔。",
    multiline: true,
  },
  {
    key: "business_background",
    label: "現在主要是什麼業務場景？",
    reviewLabel: "需求背景",
    hint: "補充現有流程、數據來源、團隊分工或卡點。",
    multiline: true,
  },
  {
    key: "budget_note",
    label: "預算大概在哪個範圍？",
    reviewLabel: "預算",
    hint: "可以填預算、投入範圍，也可以先留空。",
  },
  {
    key: "expected_delivery_at",
    label: "有期望完成時間嗎？",
    reviewLabel: "時間",
    hint: "如果還沒定，可以先跳過。",
    type: "date",
  },
  {
    key: "enterprise_name",
    label: "是哪個企業或團隊提出的？",
    reviewLabel: "企業 / 團隊",
    hint: "用於後續需求歸屬，也可以先留空。",
  },
  {
    key: "contact_name",
    label: "後續找誰對接？",
    reviewLabel: "聯系人",
    hint: "填聯繫人姓名或稱呼即可。",
  },
  {
    key: "contact_email",
    label: "有聯繫郵箱嗎？",
    reviewLabel: "聯系郵箱",
    hint: "沒有可以跳過。",
  },
];

function fieldValue(draft: RequirementDraft, key: keyof RequirementDraft) {
  return String(draft[key] ?? "").trim();
}

function getFirstRequirementField(draft?: RequirementDraft | null): keyof RequirementDraft | null {
  const normalized = normalizeRequirementDraft(draft);
  return requirementFields.find((field) => !fieldValue(normalized, field.key))?.key ?? null;
}

function getNextRequirementField(currentField: keyof RequirementDraft | null) {
  const currentIndex = requirementFields.findIndex((field) => field.key === currentField);
  return currentIndex >= 0 && currentIndex < requirementFields.length - 1
    ? requirementFields[currentIndex + 1].key
    : null;
}

function getPreviousRequirementField(currentField: keyof RequirementDraft | null) {
  const currentIndex = requirementFields.findIndex((field) => field.key === currentField);
  return currentIndex > 0 ? requirementFields[currentIndex - 1].key : null;
}

function createRequirementComposerState(conversationId: string, draft?: RequirementDraft | null): RequirementComposerState {
  const normalized = normalizeRequirementDraft(draft);
  const currentField = getFirstRequirementField(normalized);
  return {
    mode: currentField ? "requirement" : "requirement_review",
    conversationId,
    currentField,
    draft: normalized,
  };
}

function requirementIsReady(draft: RequirementDraft) {
  return Boolean(fieldValue(draft, "title") && fieldValue(draft, "description"));
}

function ChatComposer({
  input,
  loading,
  onInputChange,
  onSubmit,
  onSend,
}: {
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onSend: () => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_36px_rgba(16,24,40,0.07)] transition-all duration-150 focus-within:border-brand-200 focus-within:shadow-[0_16px_44px_rgba(197,87,60,0.10)]">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          className="max-h-[180px] min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
          placeholder="繼續補充你的需求..."
        />
        <button
          type="submit"
          aria-label="發送"
          disabled={!input.trim() || loading}
          className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-all duration-150 hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <SendHorizonal size={17} strokeWidth={2.5} />
        </button>
      </div>
      <div className="mt-2 hidden text-center text-xs font-medium text-slate-400 sm:block">Enter 發送，Shift + Enter 換行</div>
    </form>
  );
}

function RequirementComposer({
  state,
  disabled,
  onChange,
  onNext,
  onPrevious,
  onCancel,
}: {
  state: RequirementComposerState;
  disabled: boolean;
  onChange: (field: keyof RequirementDraft, value: RequirementDraft[keyof RequirementDraft]) => void;
  onNext: () => void;
  onPrevious: () => void;
  onCancel: () => void;
}) {
  const field = requirementFields.find((item) => item.key === state.currentField) ?? requirementFields[0];
  const value = state.draft[field.key] ?? "";
  const canGoPrevious = getPreviousRequirementField(field.key) !== null;

  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(16,24,40,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-black text-brand-700">需求整理中</div>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="text-xs font-black text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          取消
        </button>
      </div>
      <div className="animate-[message-in_180ms_ease-out]">
        <div className="text-base font-black leading-6 text-slate-950">{field.label}</div>
        <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{field.hint}</div>
        <div className="mt-3">
          {field.multiline ? (
            <textarea
              value={String(value)}
              onChange={(event) => onChange(field.key, event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-bold leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-200 focus:bg-white"
            />
          ) : (
            <input
              type={field.type ?? "text"}
              value={String(value)}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm font-bold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-200 focus:bg-white"
            />
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {canGoPrevious ? (
          <button
            type="button"
            onClick={onPrevious}
            disabled={disabled}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← 上一步
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-black text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          繼續 →
        </button>
      </div>
    </div>
  );
}

function RequirementReviewComposer({
  state,
  disabled,
  onBack,
  onCancel,
  onConfirm,
}: {
  state: RequirementComposerState;
  disabled: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: (draft: RequirementDraft) => void;
}) {
  const ready = requirementIsReady(state.draft);
  const compactFields = requirementFields.filter((field) => fieldValue(state.draft, field.key) || field.required);

  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4 shadow-[0_12px_36px_rgba(16,24,40,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black text-brand-700">需求待確認</div>
          <div className="mt-1 text-sm font-black text-slate-950">{state.draft.title || "未命名需求"}</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="text-xs font-black text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          取消
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {compactFields.map((field) => {
          const value = fieldValue(state.draft, field.key);
          return (
            <div key={field.key} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-black text-slate-400">{field.reviewLabel}</div>
              <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm font-bold leading-5 text-slate-800">
                {value || "尚未補充"}
              </div>
            </div>
          );
        })}
      </div>
      {!ready && <div className="mt-3 text-sm font-bold text-brand-700">需求名稱和要解決的問題還需要補一下。</div>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition-colors hover:border-brand-100 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          返回修改
        </button>
        <button
          type="button"
          onClick={() => onConfirm(state.draft)}
          disabled={disabled || !ready}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-black text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          確認提交需求
        </button>
      </div>
    </div>
  );
}

function SparkIcon() {
  return <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(197,87,60,0.12)]" />;
}
