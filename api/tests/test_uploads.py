from app.core.config import Settings
from app.services import storage

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def _use_tmp_media(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(media_dir=str(tmp_path)))


async def test_upload_requires_auth(client):
    resp = await client.post("/api/v1/uploads", files={"file": ("a.png", b"x", "image/png")})
    assert resp.status_code == 401
    assert resp.json()["code"] == 41001


async def test_upload_image(client, auth_headers, tmp_path, monkeypatch):
    _use_tmp_media(tmp_path, monkeypatch)
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("screenshot.png", PNG_BYTES, "image/png")},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["kind"] == "image"
    assert data["url"].startswith("/media/")
    assert data["size"] == len(PNG_BYTES)
    assert data["mime_type"] == "image/png"


async def test_upload_video_kind(client, auth_headers, tmp_path, monkeypatch):
    _use_tmp_media(tmp_path, monkeypatch)
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("clip.mp4", b"\x00" * 100, "video/mp4")},
        headers=auth_headers,
    )
    assert resp.json()["data"]["kind"] == "video"


async def test_upload_too_large_rejected(client, auth_headers, tmp_path, monkeypatch):
    _use_tmp_media(tmp_path, monkeypatch)
    big = b"a" * (10 * 1024 * 1024 + 1)
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("big.png", big, "image/png")},
        headers=auth_headers,
    )
    assert resp.status_code == 413


async def test_question_links_uploaded_attachment(client, auth_headers, tmp_path, monkeypatch):
    _use_tmp_media(tmp_path, monkeypatch)
    up = await client.post(
        "/api/v1/uploads",
        files={"file": ("pic.png", PNG_BYTES, "image/png")},
        headers=auth_headers,
    )
    url = up.json()["data"]["url"]

    resp = await client.post(
        "/api/v1/questions",
        json={"title": "带图问题", "attachments": [url]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    attachments = resp.json()["data"]["attachments"]
    assert len(attachments) == 1
    assert attachments[0]["url"] == url
    assert attachments[0]["kind"] == "image"
