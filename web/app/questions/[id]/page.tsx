"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { acceptAnswer, createAnswer, getQuestion, voteAnswer, voteQuestion } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { QuestionOut } from "@/lib/types";
import Attachments from "@/components/Attachments";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";

export default function QuestionDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [question, setQuestion] = useState<QuestionOut | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const currentUser = getCurrentUser();
  const isAuthor = currentUser !== null && question !== null && currentUser.id === question.author_id;

  useEffect(() => {
    getQuestion(id)
      .then(setQuestion)
      .catch(() => setNotFound(true));
  }, [id]);

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setError("");
    setBusy(true);
    try {
      const answer = await createAnswer(id, content.trim());
      setQuestion((prev) =>
        prev
          ? { ...prev, answers: [...prev.answers, answer], answer_count: prev.answer_count + 1 }
          : prev
      );
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoteQuestion() {
    if (!question) return;
    try {
      const r = await voteQuestion(question.id);
      setQuestion((prev) => (prev ? { ...prev, vote_count: r.count } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function handleVoteAnswer(answerId: number) {
    if (!question) return;
    try {
      const r = await voteAnswer(answerId);
      setQuestion((prev) =>
        prev
          ? {
              ...prev,
              answers: prev.answers.map((a) => (a.id === answerId ? { ...a, vote_count: r.count } : a)),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function handleAccept(answerId: number) {
    if (!question) return;
    setBusy(true);
    try {
      await acceptAnswer(question.id, answerId);
      const fresh = await getQuestion(question.id);
      setQuestion(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          icon="🦞"
          title="问题不存在"
          description="该问题可能已被删除或不存在。"
          action={
            <Link href="/questions" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} strokeWidth={2} />
              返回问题广场
            </Link>
          }
        />
      </main>
    );
  }

  if (!question) {
    return <main className="mx-auto max-w-3xl px-6 py-20 text-slate-500">加载中...</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/questions" className="btn btn-ghost btn-sm -ml-2 text-slate-500">
        <ArrowLeft size={15} strokeWidth={2} />
        返回问题广场
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-slate-900">{question.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Avatar user={question.author} isAnon={question.is_anonymous} size={26} />
          <span className="font-medium text-slate-700">{question.author?.display_name ?? "未知"}</span>
          {question.is_anonymous && <span className="badge badge-red">🦞 匿名</span>}
        </span>
        <span>{question.view_count} 浏览</span>
        {question.status === "resolved" && (
          <span className="badge badge-green">
            <CheckCircle2 size={13} strokeWidth={2} />
            已解决
          </span>
        )}
      </div>

      {question.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.tags.map((t) => (
            <span key={t} className="badge badge-gray">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="card mt-6 space-y-3 p-6 text-sm">
        {question.scenario && (
          <p>
            <span className="font-medium text-slate-700">场景：</span>
            <span className="text-slate-600">{question.scenario}</span>
          </p>
        )}
        {question.tools.length > 0 && (
          <p>
            <span className="font-medium text-slate-700">工具：</span>
            <span className="text-slate-600">{question.tools.join(", ")}</span>
          </p>
        )}
        {question.description && (
          <div>
            <p className="font-medium text-slate-700">描述：</p>
            <p className="whitespace-pre-wrap text-slate-600">{question.description}</p>
          </div>
        )}
        {question.error_info && (
          <div>
            <p className="font-medium text-slate-700">报错信息：</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {question.error_info}
            </pre>
          </div>
        )}
        <Attachments items={question.attachments} />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={handleVoteQuestion} className="btn btn-secondary btn-sm">
          <ThumbsUp size={15} strokeWidth={2} />
          赞 {question.vote_count}
        </button>
      </div>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <MessageSquare size={18} strokeWidth={2} />
          {question.answer_count} 个回答
        </h2>
        {question.answers.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="还没有回答"
              description="这是第一个回答的机会,分享你的排查思路或解决方案。"
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {question.answers.map((a) => (
              <li
                key={a.id}
                className={`card p-5 ${a.is_accepted ? "border-green-300 ring-1 ring-green-200" : ""}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Avatar user={a.author} size={24} />
                  <span className="font-medium text-slate-700">{a.author?.username ?? "未知"}</span>
                  {a.is_accepted && (
                    <span className="badge badge-green">
                      <CheckCircle2 size={13} strokeWidth={2} />
                      已采纳
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.content}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => handleVoteAnswer(a.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ThumbsUp size={14} strokeWidth={2} />
                    {a.vote_count}
                  </button>
                  {isAuthor && !a.is_accepted && (
                    <button
                      onClick={() => handleAccept(a.id)}
                      disabled={busy}
                      className="btn btn-primary btn-sm"
                    >
                      <CheckCircle2 size={14} strokeWidth={2} />
                      采纳
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-slate-900">写下你的回答</h2>
        {currentUser ? (
          <form onSubmit={handleAnswer} className="card mt-3 p-5">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="input"
              placeholder="分享你的排查思路或解决方案..."
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={busy || !content.trim()}
              className="btn btn-primary mt-3"
            >
              <Send size={15} strokeWidth={2} />
              {busy ? "提交中..." : "提交回答"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-500 hover:underline">
              登录
            </Link>{" "}
            后即可回答。
          </p>
        )}
      </section>
    </main>
  );
}
