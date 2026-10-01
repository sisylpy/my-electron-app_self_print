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
    windows = list_wechat_windows()
    titled = [window for window in windows if window.title == "微信"]
    if not titled:
        raise WindowError("没有找到标题为“微信”的主窗口")
    return max(titled, key=lambda window: window.bounds.width * window.bounds.height)


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
