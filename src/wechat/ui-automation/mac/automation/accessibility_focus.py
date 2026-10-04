from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass

from .mouse import paste_clipboard, press_escape, press_return, select_all, set_clipboard
from .window import activate_wechat


_GROUP_MEMBER_COUNT = re.compile(r"\s*\(\d+\)\s*$")


@dataclass(frozen=True)
class AccessibilityFocusResult:
    matched: bool
    already_open: bool
    header: str


def header_matches_target(header: str, target: str) -> bool:
    visible = str(header or "").strip()
    expected = str(target or "").strip()
    if not visible or not expected:
        return False
    return visible == expected or _GROUP_MEMBER_COUNT.sub("", visible) == expected


def _osascript(lines: list[str]) -> str:
    command = ["osascript"]
    for line in lines:
        command.extend(["-e", line])
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def _conversation_header(*, focus_search: bool = False) -> str:
    lines = [
        'tell application "System Events" to tell process "WeChat"',
        'set rootSplit to UI element 1 of UI element 7 of UI element 1 of window "微信"',
        'set chatGroup to UI element 1 of UI element 1 of UI element 1 of UI element 1 of rootSplit',
        'set chatHeader to UI element 1 of chatGroup',
    ]
    if focus_search:
        lines.extend([
            'set searchField to UI element 2 of UI element 2 of rootSplit',
            'set focused of searchField to true',
        ])
    lines.extend([
        'return name of chatHeader as text',
        'end tell',
    ])
    return _osascript(lines)


def current_conversation_header() -> str:
    visible = _conversation_header(focus_search=False).strip()
    if visible.casefold() == "missing value":
        return ""
    return _GROUP_MEMBER_COUNT.sub("", visible).strip()


def focus_conversation_with_accessibility(target: str) -> AccessibilityFocusResult:
    """Open one exact conversation through WeChat's accessibility search field.

    This path avoids three full-window OCR passes for every customer. The
    opened header is still verified exactly, and any accessibility-tree change
    raises so the caller can fall back to the vision implementation.
    """

    expected = str(target or "").strip()
    activate_wechat()
    current_header = _conversation_header(focus_search=False)
    if header_matches_target(current_header, expected):
        return AccessibilityFocusResult(True, True, current_header)

    # Focusing the actual AXTextArea is both faster and safer than clicking a
    # coordinate: a customer name can never land in the message composer.
    _conversation_header(focus_search=True)
    select_all(0.05)
    set_clipboard(expected)
    paste_clipboard(0.45)
    press_return(0.75)
    press_escape(0.15)
    opened_header = _conversation_header(focus_search=False)
    return AccessibilityFocusResult(
        header_matches_target(opened_header, expected),
        False,
        opened_header,
    )
