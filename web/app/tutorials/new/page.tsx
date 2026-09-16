"use client";

import gfm from "@bytemd/plugin-gfm";
import { Editor } from "@bytemd/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import zhHans from "bytemd/locales/zh_Hans.json";
import { createTutorial, listCategories, uploadFile } from "@/lib/api";
import UploadButton from "@/components/UploadButton";
import type { UploadOut } from "@/lib/types";

const DIRECT_VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];

function markdownFor(item: UploadOut): string {
  const name = item.url.split("/").pop() ?? "附件";
  if (item.kind === "image") return `![${name}](${item.url})`;
  if (item.kind === "video") return `[▶ 视频：${name}](${item.url})`;
  return `[${name}](${item.url})`;
}

function getVideoPreview(url: string): { provider: "direct" | "unknown"; url: string } | null {
  const value = url.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const path = parsed.pathname.toLowerCase();
    if (DIRECT_VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))) {
      return { provider: "direct", url: value };
    }
    return { provider: "unknown", url: value };
  } catch {
    return null;
  }
}

export default function NewTutorialPage() {
  const router = useRouter();
  const plugins = useMemo(() => [gfm()], []);
  const [categories, setCategories] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const videoPreview = getVideoPreview(videoUrl);

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
    setContent((prev) => (prev ? `${prev.trimEnd()}\n\n${snippet}\n` : `${snippet}\n`));
  }

  async function handleImageUpload(files: File[]) {
    const images = await Promise.all(
      files.map(async (file) => {
        const item = await uploadFile(file);
        return {
          url: item.url,
          alt: file.name,
          title: file.name,
        };
      }),
    );
    return images;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (videoUrl.trim() && !videoPreview) {
      setError("请输入有效的 http 或 https 视频链接");
      return;
    }
    setLoading(true);
    try {
      const t = await createTutorial({
        title,
        summary,
        category,
        content,
        video_url: videoUrl.trim() || undefined,
        video_title: videoTitle.trim() || undefined,
      });
      router.push(`/tutorials/${t.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
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
          <label className="label" htmlFor="t-video-url">
            视频链接
          </label>
          <input
            id="t-video-url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="input mt-1"
            placeholder="粘贴 mp4、webm 或支持嵌入的视频链接"
          />
          <input
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            className="input mt-3"
            placeholder="视频标题（可选）"
          />
          {videoUrl.trim() && (
            <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-slate-50">
              {videoPreview?.provider === "direct" ? (
                <video
                  src={videoPreview.url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black"
                />
              ) : videoPreview ? (
                <div className="p-4 text-sm text-slate-500">
                  这个链接会作为外部视频保存，当前类型暂不支持站内预览。
                </div>
              ) : (
                <div className="p-4 text-sm text-red-500">请输入有效的 http 或 https 视频链接。</div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="t-content">
            正文（Markdown）<span className="text-brand-500">*</span>
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <UploadButton
              onUploaded={handleUploaded}
              accept="video/*"
              label="上传视频并追加正文"
            />
            <span className="text-xs text-slate-400">图片可直接用编辑器工具栏、粘贴或拖拽上传</span>
          </div>
          <div id="t-content" className="tutorial-editor mt-2">
            <Editor
              value={content}
              plugins={plugins}
              locale={zhHans}
              mode="split"
              previewDebounce={250}
              uploadImages={handleImageUpload}
              onChange={setContent}
              placeholder={"# 标题\n\n支持 **粗体**、代码块、列表、表格、任务清单等 Markdown 语法。\n\n```python\nprint('hello')\n```"}
            />
          </div>
          <input
            tabIndex={-1}
            aria-hidden="true"
            value={content.trim() ? content : ""}
            onChange={() => {}}
            className="sr-only"
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
