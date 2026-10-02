#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from automation.api import focus_conversation  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Open one exact visible WeChat conversation.")
    parser.add_argument("--title", required=True)
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()

    result = focus_conversation(args.title, artifact_root=args.artifact_root)
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
