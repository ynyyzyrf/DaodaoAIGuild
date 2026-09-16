"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, Settings2, XCircle } from "lucide-react";
import {
  getQuestionAssistantSettings,
  updateQuestionAssistantSettings,
} from "@/lib/admin-api";
import type { QuestionAssistantSettings } from "@/lib/admin-api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<QuestionAssistantSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getQuestionAssistantSettings();
      setSettings(data);
      setEnabled(data.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setSaving(true);
    setError("");
    try {
      const data = await updateQuestionAssistantSettings({
        enabled: nextEnabled,
      });
      setSettings(data);
      setEnabled(data.enabled);
    } catch (e) {
      setEnabled(!nextEnabled);
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">加载中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">平台配置</h1>
        <p className="mt-1 text-sm text-slate-500">管理问题广场的自动回答能力和平台级开关。</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section className="card max-w-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
              <Bot size={21} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                问题广场回答小助手
                <span className={`badge ${enabled ? "badge-green" : "badge-gray"}`}>
                  {enabled ? "已开启" : "已关闭"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
              enabled ? "bg-brand-500" : "bg-slate-300"
            }`}
            aria-pressed={enabled}
            title={enabled ? "关闭" : "开启"}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Settings2 size={15} strokeWidth={2} />
            运行状态
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`badge ${settings?.api_key_configured ? "badge-green" : "badge-red"}`}>
              {settings?.api_key_configured ? (
                <CheckCircle2 size={13} strokeWidth={2} />
              ) : (
                <XCircle size={13} strokeWidth={2} />
              )}
              {settings?.api_key_configured ? "Dify API Key 已配置" : "Dify API Key 未配置"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
