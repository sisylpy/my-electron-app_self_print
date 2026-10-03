from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass

from .coordinates import Rect


class WindowError(RuntimeError):
    pass


@dataclass(frozen=True)
class WeChatWindow:
    title: str
    bounds: Rect


def _osascript(lines: list[str]) -> str:
    command = ["osascript"]
    for line in lines:
        command.extend(["-e", line])
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def activate_wechat() -> None:
    _osascript(['tell application "WeChat" to activate'])
    _osascript(
        [
            'tell application "System Events" to tell process "WeChat"',
            'set frontmost to true',
            'if exists window "微信" then perform action "AXRaise" of window "微信"',
            'end tell',
        ]
    )
    time.sleep(0.6)


def list_wechat_windows() -> list[WeChatWindow]:
    output = _osascript(
        [
            'tell application "System Events" to tell process "WeChat"',
            'set out to ""',
            'repeat with i from 1 to count of windows',
            'set w to window i',
            'set p to position of w',
            'set s to size of w',
            'set out to out & (name of w as text) & "\\t" & (item 1 of p as text) & "\\t" & (item 2 of p as text) & "\\t" & (item 1 of s as text) & "\\t" & (item 2 of s as text) & linefeed',
            'end repeat',
            'return out',
            'end tell',
        ]
    )
    windows: list[WeChatWindow] = []
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) != 5:
            continue
        title, x, y, width, height = parts
        windows.append(
            WeChatWindow(title, Rect(float(x), float(y), float(width), float(height)))
        )
    return windows


def main_wechat_window() -> WeChatWindow:
    # Docking and raising the Electron/WeChat windows happen in separate
    # processes. macOS can briefly expose an empty AX window list while that
    # transition is in progress even though the visible chat window is already
    # on screen. Treat that as transient instead of telling the user to log in.
    last_windows: list[WeChatWindow] = []
    for attempt in range(6):
        last_windows = list_wechat_windows()
        titled = [window for window in last_windows if window.title == "微信"]
        if titled:
            return max(titled, key=lambda window: window.bounds.width * window.bounds.height)
        if attempt < 5:
            time.sleep(0.15)
    visible_titles = ", ".join(window.title or "(无标题)" for window in last_windows)
    detail = f"；当前窗口: {visible_titles}" if visible_titles else ""
    raise WindowError(f"没有找到标题为“微信”的主窗口{detail}")


def close_auxiliary_window(title: str) -> None:
    if not title or title == "微信":
        raise WindowError(f"拒绝关闭非辅助窗口: {title!r}")
    escaped = title.replace('\\', '\\\\').replace('"', '\\"')
    _osascript(
        [
            'tell application "System Events" to tell process "WeChat"',
            'set frontmost to true',
            f'if exists window "{escaped}" then',
            f'perform action "AXRaise" of window "{escaped}"',
            'delay 0.2',
            'keystroke "w" using command down',
            'end if',
            'end tell',
        ]
    )
    activate_wechat()
