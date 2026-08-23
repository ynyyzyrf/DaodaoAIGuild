"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  reasonRequired?: boolean;
  reason?: string;
  onReasonChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 通用确认弹窗：破坏性操作二次确认 + 必填原因（docs/3.2.md §7.3 / §10.1）。 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  reasonRequired = false,
  reason = "",
  onReasonChange,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  const canSubmit = !reasonRequired || reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <AlertTriangle size={18} strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        {reasonRequired && (
          <div className="mt-4">
            <label className="label">
              操作原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange?.(e.target.value)}
              className="input mt-1 min-h-[72px] resize-none"
              placeholder="填写原因（会写入稽核日志）"
              required
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={loading}>
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn bg-brand-500 text-white hover:bg-brand-600"
            disabled={!canSubmit || loading}
          >
            {loading ? "处理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
