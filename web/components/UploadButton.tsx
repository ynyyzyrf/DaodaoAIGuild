"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "@/lib/api";
import type { UploadOut } from "@/lib/types";

interface UploadButtonProps {
  onUploaded: (items: UploadOut[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  max?: number;
}

export default function UploadButton({
  onUploaded,
  accept,
  multiple = true,
  label = "上传附件",
  max = 9,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const items: UploadOut[] = [];
      for (const f of files.slice(0, max)) {
        items.push(await uploadFile(f));
      }
      onUploaded(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn btn-secondary btn-sm"
      >
        <Upload size={15} strokeWidth={2} />
        {uploading ? "上传中..." : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
