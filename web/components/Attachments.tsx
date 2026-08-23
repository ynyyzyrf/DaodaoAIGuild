import { FileText } from "lucide-react";
import type { AttachmentOut } from "@/lib/types";

function filename(url: string): string {
  return url.split("/").pop() || "附件";
}

/** 附件渲染：圖片內聯、視頻播放、其他類型顯示下載鏈接。 */
export default function Attachments({ items }: { items: AttachmentOut[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {items.map((att) => {
        if (att.kind === "image") {
          return (
            <img
              key={att.id}
              src={att.url}
              alt="附件图片"
              className="max-h-80 rounded-xl border border-slate-200"
            />
          );
        }
        if (att.kind === "video") {
          return (
            <video
              key={att.id}
              src={att.url}
              controls
              className="max-h-80 w-full rounded-xl border border-slate-200"
            />
          );
        }
        const name = filename(att.url);
        return (
          <a
            key={att.id}
            href={att.url}
            download={name}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:border-brand-200 hover:bg-slate-50"
          >
            <FileText size={15} strokeWidth={2} className="text-slate-400" />
            {name}
          </a>
        );
      })}
    </div>
  );
}
