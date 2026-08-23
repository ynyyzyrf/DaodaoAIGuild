"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Film, ImageIcon, Trash2 } from "lucide-react";
import { createQuestion } from "@/lib/api";
import type { UploadOut } from "@/lib/types";
import UploadButton from "@/components/UploadButton";

function attachmentIcon(a: UploadOut) {
  if (a.kind === "image") return <ImageIcon size={16} strokeWidth={2} className="text-slate-400" />;
  if (a.kind === "video") return <Film size={16} strokeWidth={2} className="text-slate-400" />;
  return <FileText size={16} strokeWidth={2} className="text-slate-400" />;
}

export default function NewQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scenario, setScenario] = useState("");
  const [tools, setTools] = useState("");
  const [errorInfo, setErrorInfo] = useState("");
  const [tags, setTags] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [attachments, setAttachments] = useState<UploadOut[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleUploaded(items: UploadOut[]) {
    setAttachments((prev) => [...prev, ...items]);
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const q = await createQuestion({
        title,
        description,
        scenario,
        tools: tools ? tools.split(",").map((s) => s.trim()).filter(Boolean) : [],
        error_info: errorInfo,
        tags: tags ? tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
        is_anonymous: isAnonymous,
        attachments: attachments.map((a) => a.url),
      });
      router.push(`/questions/${q.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">提出新问题</h1>
      <p className="mt-1 text-sm text-slate-500">
        描述清楚背景与已尝试的步骤，騎士才能更快地帮你。
      </p>
      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label" htmlFor="q-title">
            标题 <span className="text-brand-500">*</span>
          </label>
          <input
            id="q-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input mt-1"
            placeholder="一句话描述你的问题"
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAnonymous((v) => !v)}
            className={`chip ${isAnonymous ? "chip-active" : "chip-idle"}`}
            aria-pressed={isAnonymous}
          >
            🦞 匿名提问
          </button>
          <p className="text-xs text-slate-500">
            开启后显示为「龍蝦騎士xxxx號」，保护你的身份。
          </p>
        </div>

        <div>
          <label className="label" htmlFor="q-desc">
            详细描述
          </label>
          <textarea
            id="q-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="input mt-1"
            placeholder="背景、现象、你已经尝试过什么..."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="q-scenario">
              应用场景
            </label>
            <input
              id="q-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="input mt-1"
              placeholder="例如：企业微信客服机器人"
            />
          </div>
          <div>
            <label className="label" htmlFor="q-tools">
              涉及工具（逗号分隔）
            </label>
            <input
              id="q-tools"
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              className="input mt-1"
              placeholder="Docker, OpenClaw, FastAPI"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="q-error">
            报错信息
          </label>
          <textarea
            id="q-error"
            value={errorInfo}
            onChange={(e) => setErrorInfo(e.target.value)}
            rows={3}
            className="input mt-1 font-mono text-xs"
            placeholder="粘贴报错日志或截图说明"
          />
        </div>

        <div>
          <label className="label" htmlFor="q-tags">
            标签（逗号分隔）
          </label>
          <input
            id="q-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="input mt-1"
            placeholder="agent, 企业微信"
          />
        </div>

        <div>
          <label className="label">附件（图片 / 视频 / 日志 / 文件）</label>
          <div className="mt-2">
            <UploadButton
              onUploaded={handleUploaded}
              accept="image/*,video/*,.log,.txt,.zip,.pdf,.doc,.docx,.xls,.xlsx"
              label="选择文件上传"
            />
          </div>
          {attachments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {attachments.map((a) => (
                <li
                  key={a.url}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"
                >
                  {a.kind === "image" ? (
                    <img src={a.url} alt="预览" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded bg-slate-50">
                      {attachmentIcon(a)}
                    </span>
                  )}
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {a.url.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.url)}
                    title="移除"
                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-500"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "发布中..." : "发布问题"}
        </button>
      </form>
    </main>
  );
}
