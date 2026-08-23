import os
import uuid
from datetime import datetime
from pathlib import Path

from app.core.config import get_settings

# 附件 kind 判定：按扩展名（其次 mime）归类
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"}
LOG_EXTS = {".log"}


def detect_kind(filename: str, mime_type: str) -> str:
    """按扩展名 / mime 判定附件类型（image/video/file/log）。"""
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS or mime_type.startswith("image/"):
        return "image"
    if ext in VIDEO_EXTS or mime_type.startswith("video/"):
        return "video"
    if ext in LOG_EXTS:
        return "log"
    return "file"


class LocalStorageBackend:
    """把上传内容落盘到 media_dir，返回可访问的 /media/... URL。"""

    def __init__(self, base_dir: str | os.PathLike | None = None):
        self.base_dir = Path(base_dir or get_settings().media_dir)

    def _ensure_root(self) -> None:
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, content: bytes, original_filename: str, content_type: str) -> str:
        self._ensure_root()
        ext = Path(original_filename).suffix.lower()
        now = datetime.now()
        rel = f"{now.year:04d}/{now.month:02d}/{uuid.uuid4().hex}{ext}"
        full = self.base_dir / rel
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(content)
        return f"/media/{rel}"

    def delete(self, url: str) -> None:
        """按 URL 删除本地文件（用于后续软删除扩展）。"""
        if not url.startswith("/media/"):
            return
        full = self.base_dir / url[len("/media/") :]
        try:
            full.unlink(missing_ok=True)
        except OSError:
            pass
