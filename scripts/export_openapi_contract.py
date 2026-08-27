"""匯出 daostore-fde OpenAPI contract → lobster-sdk/contracts/openapi.generated.json

P1-3：Server 為 contract source of truth；本腳本為 additive 工具，不改 server 本體。

Usage:
    python scripts/export_openapi_contract.py [--server URL] [--out PATH]

    --server  daostore-fde base URL（default: http://localhost:8000）
    --out     輸出檔案路徑（default: ../../lobster-sdk/contracts/openapi.generated.json）
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = (
    SCRIPT_DIR.parent.parent / "lobster-sdk" / "contracts" / "openapi.generated.json"
)


def fetch_openapi(server_url: str) -> dict:
    url = server_url.rstrip("/") + "/openapi.json"
    with urllib.request.urlopen(url, timeout=15) as resp:  # noqa: S310
        data = json.loads(resp.read().decode("utf-8"))
    if "openapi" not in data or "paths" not in data:
        raise ValueError(f"回應不是合法 OpenAPI 3.x：{url}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default="http://localhost:8000")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    spec = fetch_openapi(args.server)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"exported OpenAPI {spec.get('openapi')} "
        f"({len(spec.get('paths', {}))} paths) → {args.out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
