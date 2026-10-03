from __future__ import annotations

import ctypes
import subprocess
import time
from ctypes import c_double, c_int32, c_uint32, c_void_p

from .coordinates import Point


class _CGPoint(ctypes.Structure):
    _fields_ = [("x", c_double), ("y", c_double)]


_CG = ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
_CF = ctypes.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
_CG.CGEventCreateMouseEvent.argtypes = [c_void_p, c_uint32, _CGPoint, c_uint32]
_CG.CGEventCreateMouseEvent.restype = c_void_p
_CG.CGEventPost.argtypes = [c_uint32, c_void_p]
_CG.CGEventSetIntegerValueField.argtypes = [c_void_p, c_uint32, ctypes.c_int64]
_CG.CGEventCreateKeyboardEvent.argtypes = [c_void_p, c_uint32, ctypes.c_bool]
_CG.CGEventCreateKeyboardEvent.restype = c_void_p
_CG.CGEventSetFlags.argtypes = [c_void_p, ctypes.c_uint64]
_CG.CGEventCreateScrollWheelEvent.restype = c_void_p
_CF.CFRelease.argtypes = [c_void_p]

_K_CG_HID_EVENT_TAP = 0
_MOUSE_MOVED = 5
_LEFT_DOWN = 1
_LEFT_UP = 2
_LEFT_BUTTON = 0
_MOUSE_EVENT_CLICK_STATE = 1
_COMMAND_FLAG = 1 << 20
_KEY_A = 0
_KEY_V = 9
_KEY_ESCAPE = 53
_KEY_RETURN = 36
_SCROLL_UNIT_LINE = 1


def _post(event: c_void_p) -> None:
    if not event:
        raise RuntimeError("CoreGraphics 未能创建输入事件")
    _CG.CGEventPost(_K_CG_HID_EVENT_TAP, event)
    _CF.CFRelease(event)


def _move_mouse(cg_point: _CGPoint) -> None:
    _post(_CG.CGEventCreateMouseEvent(None, _MOUSE_MOVED, cg_point, _LEFT_BUTTON))
    time.sleep(0.05)


def _click_button(cg_point: _CGPoint, click_state: int) -> None:
    for event_type in (_LEFT_DOWN, _LEFT_UP):
        event = _CG.CGEventCreateMouseEvent(None, event_type, cg_point, _LEFT_BUTTON)
        if not event:
            raise RuntimeError("CoreGraphics 未能创建鼠标点击事件")
        _CG.CGEventSetIntegerValueField(
            event,
            _MOUSE_EVENT_CLICK_STATE,
            click_state,
        )
        _post(event)
        time.sleep(0.05)


def click(point: Point, settle: float = 0.8) -> None:
    cg_point = _CGPoint(point.x, point.y)
    _move_mouse(cg_point)
    _click_button(cg_point, click_state=1)
    time.sleep(settle)


def double_click(point: Point, settle: float = 0.8) -> None:
    """Send a genuine macOS double-click at one explicit point."""
    cg_point = _CGPoint(point.x, point.y)
    _move_mouse(cg_point)
    _click_button(cg_point, click_state=1)
    time.sleep(0.12)
    _click_button(cg_point, click_state=2)
    time.sleep(settle)


def _key(keycode: int, flags: int = 0) -> None:
    down = _CG.CGEventCreateKeyboardEvent(None, keycode, True)
    up = _CG.CGEventCreateKeyboardEvent(None, keycode, False)
    if flags:
        _CG.CGEventSetFlags(down, flags)
        _CG.CGEventSetFlags(up, flags)
    _post(down)
    _post(up)


def set_clipboard(text: str) -> None:
    # `pbcopy` inherits the launcher locale. The packaged desktop app can run
    # with a C locale, under which pbcopy silently stores an empty value for
    # Chinese text even though it exits successfully. AppleScript writes a
    # proper Unicode pasteboard item; passing the value in argv also avoids
    # interpolating customer-controlled text into source code.
    subprocess.run(
        [
            "osascript",
            "-e",
            "on run argv",
            "-e",
            "set the clipboard to item 1 of argv",
            "-e",
            "end run",
            "--",
            text,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def paste_clipboard(settle: float = 0.8) -> None:
    _key(_KEY_V, _COMMAND_FLAG)
    time.sleep(settle)


def select_all(settle: float = 0.2) -> None:
    _key(_KEY_A, _COMMAND_FLAG)
    time.sleep(settle)


def press_escape(settle: float = 0.5) -> None:
    _key(_KEY_ESCAPE)
    time.sleep(settle)


def press_return(settle: float = 0.5) -> None:
    _key(_KEY_RETURN)
    time.sleep(settle)


def scroll_vertical(point: Point, lines: int, settle: float = 0.8) -> None:
    """Scroll at one explicit screen point.

    Positive values move toward the top of a macOS scroll view; negative
    values move toward the bottom.  Moving the pointer first makes sure the
    wheel event is delivered to the conversation list rather than the chat
    transcript.
    """
    if lines == 0:
        return
    cg_point = _CGPoint(point.x, point.y)
    _post(_CG.CGEventCreateMouseEvent(None, _MOUSE_MOVED, cg_point, _LEFT_BUTTON))
    event = _CG.CGEventCreateScrollWheelEvent(
        None,
        _SCROLL_UNIT_LINE,
        1,
        c_int32(lines),
    )
    _post(event)
    time.sleep(settle)
