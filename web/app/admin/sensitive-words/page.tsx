"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import {
  createSensitiveWord,
  deleteSensitiveWord,
  importSensitiveWords,
  listSensitiveWords,
  updateSensitiveWord,
} from "@/lib/admin-api";
import type { SensitiveWord } from "@/lib/admin-api";
import ConfirmDialog from "../ConfirmDialog";

const ACTION_LABELS: Record<string, string> = {
  warn: "警告",
  auto_hide: "自动隐藏",
};

export default function AdminSensitiveWordsPage() {
  const [items, setItems] = useState<SensitiveWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 新增表单
  const [word, setWord] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState<"warn" | "auto_hide">("warn");
  const [creating, setCreating] = useState(false);

  // 批量导入
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // 删除确认
  const [toDelete, setToDelete] = useState<SensitiveWord | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSensitiveWords({ page: 1 });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createSensitiveWord({ word: word.trim(), category: category || undefined, action });
      setWord("");
      setCategory("");
      setAction("warn");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleImport() {
    const words = importText.split("\n").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await importSensitiveWords({ words, action: "warn" });
      alert(`导入成功：新增 ${data.added} 条，跳过 ${data.duplicates} 条重复`);
      setImportOpen(false);
      setImportText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setSubmitting(true);
    try {
      await deleteSensitiveWord(toDelete.id);
      setToDelete(null);
      setReason("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(sw: SensitiveWord) {
    try {
      await updateSensitiveWord(sw.id, { is_active: !sw.is_active });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">敏感词管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          命中 warn → 标红警告进审核队列；命中 auto_hide → 自动隐藏。共 {total} 个词
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 新增 + 导入 */}
      <div className="card p-5">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="label">敏感词</label>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="input mt-1"
              placeholder="输入敏感词"
            />
          </div>
          <div className="w-32">
            <label className="label">分类</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input mt-1"
              placeholder="如：广告"
            />
          </div>
          <div className="w-32">
            <label className="label">策略</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as "warn" | "auto_hide")}
              className="input mt-1"
            >
              <option value="warn">警告</option>
              <option value="auto_hide">自动隐藏</option>
            </select>
          </div>
          <button type="submit" disabled={creating || !word.trim()} className="btn btn-primary">
            <Plus size={15} strokeWidth={2} /> 添加
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn btn-secondary"
          >
            <Upload size={15} strokeWidth={2} /> 批量导入
          </button>
        </form>
      </div>

      {/* 敏感词列表 */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
              <th className="px-5 py-3">词</th>
              <th className="px-5 py-3">分类</th>
              <th className="px-5 py-3">策略</th>
              <th className="px-5 py-3">状态</th>
              <th className="px-5 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">加载中...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <span className="text-3xl">🦞</span>
                  <p className="mt-2 text-sm text-slate-400">暂无敏感词</p>
                </td>
              </tr>
            ) : (
              items.map((sw) => (
                <tr key={sw.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-800">{sw.word}</td>
                  <td className="px-5 py-3 text-slate-600">{sw.category || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${sw.action === "auto_hide" ? "badge-red" : "badge-gray"}`}>
                      {ACTION_LABELS[sw.action] ?? sw.action}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${sw.is_active ? "badge-green" : "badge-gray"}`}>
                      {sw.is_active ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleActive(sw)}
                        className="btn btn-secondary btn-sm"
                      >
                        {sw.is_active ? "停用" : "启用"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(sw)}
                        className="btn btn-secondary btn-sm text-red-500"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 批量导入弹窗 */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-base font-bold text-slate-900">批量导入敏感词</h3>
            <p className="mt-1 text-sm text-slate-500">每行一个词，自动去重；导入后默认为「警告」策略</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="input mt-4 min-h-[160px] font-mono text-xs"
              placeholder={"词A\n词B\n词C"}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportText("");
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={submitting || !importText.trim()}
                className="btn btn-primary"
              >
                {submitting ? "导入中..." : "导入"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={toDelete !== null}
        title={`删除敏感词「${toDelete?.word}」？`}
        description="删除后不再拦截该词，操作会写入稽核日志。"
        confirmLabel="删除"
        loading={submitting}
        reasonRequired
        reason={reason}
        onReasonChange={setReason}
        onConfirm={handleDelete}
        onCancel={() => {
          setToDelete(null);
          setReason("");
        }}
      />
    </div>
  );
}
