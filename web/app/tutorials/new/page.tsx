"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createTutorial, listCategories } from "@/lib/api";
import UploadButton from "@/components/UploadButton";
import type { UploadOut } from "@/lib/types";function markdownFor(item: UploadOut): string {
  const name = item.url.split("/").pop() ?? "附件";
  if (item.kind === "image") return `![${name}](${item.url})`;
  if (item.kind === "video") return `[▶ 视频：${name}](${item.url})`;
  return `[${name}](${item.url})`;
}

export default function NewTutorialPage() {
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setCategory(cats[0]);
      })
      .catch(() => {});
  }, []);

  function handleUploaded(items: UploadOut[]) {
    const snippet = items.map(markdownFor).join("\n");
    setContent((prev) => {
      const el = contentRef.current;
      if (!el) return prev ? `${prev}\n\n${snippet}\n` : snippet;
      const start = el.selectionStart ?? prev.length;
      const end = el.selectionEnd ?? prev.length;
      const prefix = start === 0 ? "" : prev.slice(0, start) + "\n";
      const suffix = end === prev.length ? "" : "\n" + prev.slice(end);
      const next = prev.slice(0, start) + "\n" + snippet + "\n" + prev.slice(end);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length + 2;
        el.setSelectionRange(pos, pos);
      });
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const t = await createTutorial({ title, summary, category, content });
      router.push(`/tutorials/${t.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">发布教程</h1>
      <p className="mt-1 text-sm text-slate-500">
        沉淀实战经验，帮助其他騎士少踩坑。支持 Markdown 语法。
      </p>
      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        <div>
          <label className="label" htmlFor="t-title">
            标题 <span className="text-brand-500">*</span>
          </label>
          <input
            id="t-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input mt-1"
            placeholder="例如：从零搭建企业微信 AI 客服"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="t-summary">
            摘要
          </label>
          <input
            id="t-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="input mt-1"
            placeholder="一句话概括这篇教程"
          />
        </div>
        <div>
          <label className="label" htmlFor="t-category">
            技术分区 <span className="text-brand-500">*</span>
          </label>
          <select
            id="t-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input mt-1"
            required
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="t-content">
            正文（Markdown）<span className="text-brand-500">*</span>
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <UploadButton
              onUploaded={handleUploaded}
              accept="image/*,video/*"
              label="上传图片 / 视频并插入正文"
            />
            <span className="text-xs text-slate-400">上传后以 Markdown 形式插入光标处</span>
          </div>
          <textarea
            id="t-content"
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="input mt-2 font-mono text-xs"
            placeholder={"# 标题\n\n支持 **粗体**、代码块、列表等 Markdown 语法。\n\n```python\nprint('hello')\n```"}
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? "发布中..." : "发布教程"}
        </button>
      </form>
    </main>
  );
}
