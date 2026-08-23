"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Check,
  Eye,
  FileQuestion,
  Trash2,
  Undo2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getModerationDetail,
  listModeration,
  moderationAction,
} from "@/lib/admin-api";
import type { ModerationDetail, ModerationItem } from "@/lib/admin-api";
import ConfirmDialog from "../ConfirmDialog";

const TYPE_LABELS: Record<string, string> = {
  question: "问题",
  answer: "回答",
  tutorial: "教程",
};

const TYPE_BADGE: Record<string, string> = {
  question: "badge-gray",
  answer: "badge-gray",
  tutorial: "badge-amber",
};

function ModerationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetType = searchParams.get("target_type") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const [items, setItems] = useState<ModerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 详情
  const [detail, setDetail] = useState<ModerationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 操作
  const [confirm, setConfirm] = useState<{
    action: "approve" | "hide" | "delete" | "reject";
    item: ModerationItem;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listModeration({
        page,
        page_size: 20,
        target_type: targetType || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, targetType]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(item: ModerationItem) {
    setDetailLoading(true);
    try {
      const d = await getModerationDetail(item.target_type, item.target_id);
      setDetail(d);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitAction() {
    if (!confirm) return;
    setSubmitting(true);
    try {
      await moderationAction(
        confirm.item.target_type,
        confirm.item.target_id,
        confirm.action,
        reason,
      );
      setDetail(null);
      setConfirm(null);
      setReason("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  function setType(t: string) {
    const sp = new URLSearchParams(searchParams);
    if (t) sp.set("target_type", t);
    else sp.delete("target_type");
    sp.set("page", "1");
    router.push(`/admin/moderation?${sp.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">内容审核</h1>
        <p className="mt-1 text-sm text-slate-500">
          教程预审 · 问题/回答（举报 / 敏感词触发） · 共 {total} 条待处理
        </p>
      </div>

      {/* 类型筛选 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("")}
          className={`chip ${!targetType ? "chip-active" : "chip-idle"}`}
        >
          全部
        </button>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={`chip ${targetType === k ? "chip-active" : "chip-idle"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 审核队列 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-5 py-3">内容</th>
                <th className="px-5 py-3">类型</th>
                <th className="px-5 py-3">作者</th>
                <th className="px-5 py-3">触发原因</th>
                <th className="px-5 py-3">时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <span className="text-3xl">🦞</span>
                    <p className="mt-2 text-sm text-slate-400">暂无待审核内容</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.target_type}-${item.target_id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="max-w-[320px] px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="block w-full truncate text-left font-medium text-slate-800 hover:text-brand-600"
                      >
                        {item.title}
                      </button>
                      {item.matched_words.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {item.matched_words.slice(0, 3).map((w) => (
                            <span key={w} className="badge badge-red text-[11px]">
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${TYPE_BADGE[item.target_type] ?? "badge-gray"}`}>
                        {TYPE_LABELS[item.target_type] ?? item.target_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.author_name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`badge ${
                          item.trigger_reason === "pre_review"
                            ? "badge-amber"
                            : item.trigger_reason === "report"
                              ? "badge-orange"
                              : "badge-gray"
                        }`}
                      >
                        {item.trigger_reason === "pre_review"
                          ? "预审"
                          : item.trigger_reason === "report"
                            ? `举报${item.report_count ? ` ×${item.report_count}` : ""}`
                            : "敏感词"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {item.created_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Eye size={13} strokeWidth={2} /> 审核
                        </button>
                        {item.target_type === "tutorial" && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirm({ action: "reject", item });
                              setReason("");
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            <Undo2 size={13} strokeWidth={2} /> 打回
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {!loading && items.length > 0 && (
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const sp = new URLSearchParams(searchParams);
                sp.set("page", String(page - 1));
                router.push(`/admin/moderation?${sp.toString()}`);
              }}
              className="btn btn-secondary btn-sm"
            >
              上一页
            </button>
            <span className="px-2 text-sm text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                const sp = new URLSearchParams(searchParams);
                sp.set("page", String(page + 1));
                router.push(`/admin/moderation?${sp.toString()}`);
              }}
              className="btn btn-secondary btn-sm"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 审核详情 Drawer */}
      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileQuestion size={16} strokeWidth={2} className="text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    {TYPE_LABELS[detail.target_type] ?? detail.target_type} 详情
                  </h3>
                  <span
                    className={`badge ${
                      detail.trigger_reason === "pre_review" ? "badge-amber" : "badge-orange"
                    }`}
                  >
                    {detail.trigger_reason === "pre_review" ? "预审" : "举报"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  作者：{detail.author_name} · {detail.created_at.slice(0, 16).replace("T", " ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="btn btn-secondary btn-sm"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">{detail.title}</h2>

              {/* 举报信息 */}
              {detail.reports.length > 0 && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-sm font-semibold text-orange-700">
                    举报（{detail.reports.length}）
                  </div>
                  {detail.reports.map((r, i) => (
                    <div key={i} className="mt-2 text-sm text-orange-800">
                      <span className="font-medium">{r.reporter_name}</span>
                      <span className="text-orange-600"> · {r.reason || "未说明理由"}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 敏感词命中 */}
              {detail.matched_words.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <div className="text-sm font-semibold text-red-700">命中敏感词</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detail.matched_words.map((w) => (
                      <span key={w} className="badge badge-red">{w}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 内容预览 */}
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-700">内容</div>
                <div className="markdown mt-2 rounded-xl border border-slate-100 p-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown>
                </div>
              </div>
            </div>

            {/* 操作栏 */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              {detailLoading && <span className="text-sm text-slate-400">加载中...</span>}
              <button
                type="button"
                onClick={() => setConfirm({ action: "delete", item: items.find(
                  (i) => i.target_type === detail.target_type && i.target_id === detail.target_id,
                )! })}
                className="btn bg-red-500 text-white hover:bg-red-600"
              >
                <Trash2 size={15} strokeWidth={2} /> 删除
              </button>
              <button
                type="button"
                onClick={() => setConfirm({ action: "hide", item: items.find(
                  (i) => i.target_type === detail.target_type && i.target_id === detail.target_id,
                )! })}
                className="btn btn-secondary"
              >
                <Eye size={15} strokeWidth={2} /> 隐藏
              </button>
              {detail.target_type === "tutorial" && (
                <button
                  type="button"
                  onClick={() => setConfirm({ action: "reject", item: items.find(
                    (i) => i.target_type === detail.target_type && i.target_id === detail.target_id,
                  )! })}
                  className="btn btn-secondary"
                >
                  <Undo2 size={15} strokeWidth={2} /> 打回
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirm({ action: "approve", item: items.find(
                  (i) => i.target_type === detail.target_type && i.target_id === detail.target_id,
                )! })}
                className="btn btn-primary"
              >
                <Check size={15} strokeWidth={2} />
                {detail.target_type === "tutorial" ? "通过发布" : "通过"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 操作确认 */}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === "approve"
            ? "通过该内容？"
            : confirm?.action === "hide"
              ? "隐藏该内容？"
              : confirm?.action === "delete"
                ? "删除该内容？"
                : "打回该教程？"
        }
        description={
          confirm?.action === "approve"
            ? confirm?.item.target_type === "tutorial"
              ? "教程将通过并发布到前台。"
              : "举报将标记为已处理。"
            : confirm?.action === "hide"
              ? "内容将隐藏（保留数据，可追溯）。"
              : confirm?.action === "delete"
                ? "内容将被删除（软删除），此操作不可恢复。"
                : "教程将回到草稿状态，作者可修改后重新提交。"
        }
        confirmLabel={
          confirm?.action === "approve"
            ? "通过"
            : confirm?.action === "hide"
              ? "隐藏"
              : confirm?.action === "delete"
                ? "删除"
                : "打回"
        }
        loading={submitting}
        reasonRequired
        reason={reason}
        onReasonChange={setReason}
        onConfirm={submitAction}
        onCancel={() => {
          setConfirm(null);
          setReason("");
        }}
      />
    </div>
  );
}

export default function AdminModerationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">加载中...</p>}>
      <ModerationContent />
    </Suspense>
  );
}
