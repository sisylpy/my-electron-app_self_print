#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from automation.api import read_unread_conversations  # noqa: E402


def build_output(result) -> dict:
    """Return the safe machine-readable result used by the desktop app.

    The flow keeps its detailed report in the private artifact directory.
    Only the per-conversation status rows are copied to stdout so the caller
    can map successfully opened, already-bound chats back to customers.
    """
    payload = result.to_dict()
    payload["conversations"] = []
    if result.artifact_dir is None:
        return payload

    report_path = result.artifact_dir / "report.json"
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return payload

    conversations = report.get("conversations")
    if isinstance(conversations, list):
        payload["conversations"] = conversations
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Visibly open unread WeChat conversations one by one."
    )
    parser.add_argument("--max-pages", type=int, default=8)
    parser.add_argument("--dwell-seconds", type=float, default=1.8)
    parser.add_argument(
        "--include-title",
        action="append",
        dest="allowed_titles",
        help="Only open this exact bound friend/group title; may be repeated.",
    )
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()

    result = read_unread_conversations(
        max_pages=args.max_pages,
        dwell_seconds=args.dwell_seconds,
        allowed_titles=args.allowed_titles,
        artifact_root=args.artifact_root,
    )
    print(json.dumps(build_output(result), ensure_ascii=False, indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
