#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from automation.api import current_conversation  # noqa: E402


def build_output(result) -> dict:
    payload = result.to_dict()
    payload["conversationTitle"] = ""
    if result.artifact_dir is None:
        return payload
    try:
        report = json.loads(
            (result.artifact_dir / "report.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return payload
    title = report.get("conversationTitle")
    if isinstance(title, str):
        payload["conversationTitle"] = title
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Identify the visible WeChat conversation among bound titles."
    )
    parser.add_argument("--include-title", action="append", dest="allowed_titles")
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()
    result = current_conversation(
        args.allowed_titles or [],
        artifact_root=args.artifact_root,
    )
    print(json.dumps(build_output(result), ensure_ascii=False, indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
