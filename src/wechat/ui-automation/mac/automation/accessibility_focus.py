from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass

_GROUP_MEMBER_COUNT = re.compile(r"\s*\(\d+\)\s*$")
_FOCUS_RESULT_SEPARATOR = "\t"


@dataclass(frozen=True)
class AccessibilityFocusResult:
    matched: bool
    already_open: bool
    retried: bool
    header: str


def header_matches_target(header: str, target: str) -> bool:
    visible = str(header or "").strip()
    expected = str(target or "").strip()
    if not visible or not expected:
        return False
    return visible == expected or _GROUP_MEMBER_COUNT.sub("", visible) == expected


def _osascript(lines: list[str], *args: str) -> str:
    command = ["osascript"]
    for line in lines:
        command.extend(["-e", line])
    if args:
        command.extend(["--", *args])
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
    # Keep activation, exact-current-title detection, safe search-field focus,
    # typing, opening, and final title verification inside one osascript
    # process. The previous implementation launched several independent
    # System Events processes per customer, each rebuilding the same deep AX
    # tree; on a real WeChat window that dominated the all-customer scan time.
    output = _osascript(
        [
            "on headerMatches(visibleTitle, expectedTitle)",
            "if visibleTitle is expectedTitle then return true",
            'set memberPrefix to expectedTitle & " ("',
            'if visibleTitle starts with memberPrefix and visibleTitle ends with ")" then return true',
            "return false",
            "end headerMatches",
            "on readHeader()",
            'tell application "System Events" to tell process "WeChat"',
            'set rootSplit to UI element 1 of UI element 7 of UI element 1 of window "微信"',
            "set chatGroup to UI element 1 of UI element 1 of UI element 1 of UI element 1 of rootSplit",
            "set chatHeader to UI element 1 of chatGroup",
            "return name of chatHeader as text",
            "end tell",
            "end readHeader",
            "on searchAndRead(expectedTitle, searchDelay, openDelay)",
            "set the clipboard to expectedTitle",
            'tell application "System Events" to tell process "WeChat"',
            'set rootSplit to UI element 1 of UI element 7 of UI element 1 of window "微信"',
            "set searchField to UI element 2 of UI element 2 of rootSplit",
            "set focused of searchField to true",
            'keystroke "a" using command down',
            "delay 0.05",
            'keystroke "v" using command down',
            "delay searchDelay",
            "key code 36",
            "delay openDelay",
            "key code 53",
            "end tell",
            "delay 0.15",
            "return my readHeader()",
            "end searchAndRead",
            "on run argv",
            "set expectedTitle to item 1 of argv",
            'tell application "WeChat" to reopen',
            'tell application "System Events" to tell process "WeChat"',
            "set frontmost to true",
            "repeat 30 times",
            'if exists window "微信" then exit repeat',
            "delay 0.1",
            "end repeat",
            'if not (exists window "微信") then error "WECHAT_MAIN_WINDOW_NOT_FOUND"',
            'perform action "AXRaise" of window "微信"',
            "end tell",
            "delay 0.1",
            "set currentHeader to my readHeader()",
            "if my headerMatches(currentHeader, expectedTitle) then",
            'return "ALREADY_OPEN" & tab & currentHeader',
            "end if",
            "set openedHeader to my searchAndRead(expectedTitle, 0.45, 0.75)",
            "if my headerMatches(openedHeader, expectedTitle) then",
            'return "OPENED" & tab & openedHeader',
            "end if",
            # A busy WeChat window can render the exact result after the first
            # Return was already sent. Retry only on a verified mismatch, with
            # longer waits; successful customers keep the original fast path.
            "delay 0.25",
            "set retryHeader to my searchAndRead(expectedTitle, 0.9, 1.0)",
            "if my headerMatches(retryHeader, expectedTitle) then",
            'return "OPENED_RETRY" & tab & retryHeader',
            "end if",
            'return "MISMATCH_RETRY" & tab & retryHeader',
            "end run",
        ],
        expected,
    )
    state, separator, opened_header = output.partition(_FOCUS_RESULT_SEPARATOR)
    if not separator:
        raise RuntimeError("WECHAT_ACCESSIBILITY_FOCUS_INVALID_RESPONSE")
    return AccessibilityFocusResult(
        header_matches_target(opened_header, expected),
        state == "ALREADY_OPEN",
        state in {"OPENED_RETRY", "MISMATCH_RETRY"},
        opened_header,
    )
