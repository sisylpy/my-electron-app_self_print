from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
from time import perf_counter

from ..accessibility_focus import (
    current_conversation_header,
    raise_and_current_conversation_header,
)
from ..coordinates import Rect
from ..results import OperationResult, ResultCode
from ..window import WindowError, activate_wechat, main_wechat_window


class CurrentConversationFlow:
    """Identify the visible chat title without requiring customer bindings."""

    def __init__(
        self,
        *,
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.details: list[str] = []
        self.conversation_title = ""
        self.metrics: dict[str, str] = {}

    def _timed(self, name: str, operation):
        started_at = perf_counter()
        try:
            return operation()
        finally:
            self.metrics[name] = f"{(perf_counter() - started_at) * 1000:.1f}"

    def _raise_wechat(self) -> None:
        """Raise WeChat before reading or capturing its title bar.

        ``screencapture -R`` captures visible screen pixels rather than an
        off-screen window surface. Raising WeChat prevents another application
        from covering the small title crop and being mistaken for a chat name.
        """

        def raise_existing_window() -> None:
            subprocess.run(
                [
                    "osascript",
                    "-e",
                    'tell application "WeChat" to activate',
                    "-e",
                    'tell application "System Events" to tell process "WeChat"',
                    "-e",
                    "set frontmost to true",
                    "-e",
                    'perform action "AXRaise" of window "微信"',
                    "-e",
                    "end tell",
                ],
                check=True,
                capture_output=True,
            )
            time.sleep(0.2)

        try:
            self._timed("raiseVisibleWindowMs", raise_existing_window)
            self.details.append("VISIBLE_WINDOW_RAISED=1")
        except subprocess.CalledProcessError:
            self._timed("activateWechatMs", activate_wechat)
            self.details.append("WECHAT_WINDOW_REOPENED=1")

    @staticmethod
    def _header_region(window_bounds: Rect) -> Rect:
        # WeChat's fixed conversation list occupies about 240 points. Keep a
        # small leading margin before the chat title, while excluding the search
        # field and add button that can confuse OCR. The title itself stays
        # within the first 48 points of the window.
        left_offset = min(window_bounds.width * 0.45, 230.0)
        height = min(window_bounds.height * 0.06, 48.0)
        return Rect(
            window_bounds.x + left_offset,
            window_bounds.y,
            window_bounds.width - left_offset,
            height,
        )

    def _title_from_header(self, window_bounds: Rect) -> str:
        from ..screenshot import capture_region
        from ..state_detector import current_conversation_title_from_header
        from ..vision import recognize_text, save_ocr

        screenshot = self._timed(
            "captureHeaderMs",
            lambda: capture_region(
                self._header_region(window_bounds),
                self.artifact_dir / "current-conversation-header.png",
            ),
        )
        accurate_items = self._timed(
            "accurateHeaderOcrMs",
            lambda: recognize_text(screenshot.path, screenshot.image.size),
        )
        save_ocr(
            accurate_items,
            screenshot.path.with_name("current-conversation-header.ocr.json"),
        )
        title = current_conversation_title_from_header(
            accurate_items,
            image_height=screenshot.image.height,
        )
        self.details.append(f"ACCURATE_HEADER_FOUND={1 if title else 0}")
        return title

    def _title_from_full_window(self):
        from ..screenshot import capture_window
        from ..state_detector import current_conversation_title
        from ..vision import recognize_text, save_ocr

        # Preserve the original high-accuracy implementation as the final
        # compatibility path for unusual layouts or partially covered windows.
        self.details.append("FULL_WINDOW_FALLBACK=1")
        self._timed("fallbackActivateWechatMs", activate_wechat)
        window = self._timed("fallbackFindWindowMs", main_wechat_window)
        screenshot = self._timed(
            "captureFullWindowMs",
            lambda: capture_window(
                window.bounds,
                self.artifact_dir / "current-conversation.png",
            ),
        )
        items = self._timed(
            "accurateFullWindowOcrMs",
            lambda: recognize_text(screenshot.path, screenshot.image.size),
        )
        save_ocr(items, screenshot.path.with_suffix(".ocr.json"))
        title = current_conversation_title(
            items,
            image_width=screenshot.image.width,
            image_height=screenshot.image.height,
        )
        return title, bool(items)

    def run(self) -> OperationResult:
        started_at = perf_counter()
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            try:
                self.conversation_title = self._timed(
                    "accessibilityHeaderMs",
                    current_conversation_header,
                )
                if not self.conversation_title:
                    raise RuntimeError("WECHAT_ACCESSIBILITY_HEADER_EMPTY")
                self.details.append(
                    "ACCESSIBILITY_HEADER_FOUND=1"
                )
            except Exception as exc:
                self.details.append(
                    f"BACKGROUND_ACCESSIBILITY_FALLBACK: {type(exc).__name__}: {exc}"
                )
                try:
                    self.conversation_title = self._timed(
                        "raiseAndAccessibilityHeaderMs",
                        raise_and_current_conversation_header,
                    )
                    if not self.conversation_title:
                        raise RuntimeError("WECHAT_ACCESSIBILITY_HEADER_EMPTY")
                    self.details.append("VISIBLE_WINDOW_RAISED=1")
                    self.details.append(
                        "COMBINED_ACCESSIBILITY_HEADER_FOUND=1"
                    )
                except Exception as combined_exc:
                    self.details.append(
                        "COMBINED_ACCESSIBILITY_FALLBACK: "
                        f"{type(combined_exc).__name__}: {combined_exc}"
                    )
                    # Preserve the proven two-step implementation verbatim as
                    # the final accessibility compatibility path. Every path
                    # reads the live AX title; none uses an observed/cache value.
                    self._raise_wechat()
                    try:
                        self.conversation_title = self._timed(
                            "legacyAccessibilityHeaderMs",
                            current_conversation_header,
                        )
                        self.details.append(
                            "LEGACY_ACCESSIBILITY_HEADER_FOUND="
                            f"{1 if self.conversation_title else 0}"
                        )
                    except Exception as fallback_exc:
                        self.details.append(
                            "ACCESSIBILITY_HEADER_FALLBACK: "
                            f"{type(fallback_exc).__name__}: {fallback_exc}"
                        )

            recognized_text = True
            if not self.conversation_title:
                window = self._timed("findVisibleWindowMs", main_wechat_window)
                self.conversation_title = self._title_from_header(window.bounds)
                if not self.conversation_title:
                    self.conversation_title, recognized_text = (
                        self._title_from_full_window()
                    )

            if not recognized_text:
                code = ResultCode.SCREEN_RECORDING_PERMISSION_REQUIRED
                message = "无法识别当前微信会话，请检查 GrainPrint 的屏幕录制权限"
            elif self.conversation_title:
                code = ResultCode.SUCCESS
                message = f"已识别当前微信会话“{self.conversation_title}”"
            else:
                # Unlike conversation_header, this detector does not need a
                # customer-title whitelist and can surface an unmatched friend.
                # The renderer decides whether that friend means
                # “此微信好友没有关联客户” after the visible title is returned.
                code = ResultCode.TARGET_NOT_FOUND
                message = "没有识别到当前微信好友名称，请确认微信聊天窗口已打开"
        except WindowError as exc:
            code = ResultCode.VERIFY_FAILED
            message = "微信聊天主窗口未能打开，请确认微信已经登录"
            self.details.append(f"WECHAT_MAIN_WINDOW_UNAVAILABLE: {exc}")
        except Exception as exc:  # pragma: no cover - real UI failure path
            code = ResultCode.INTERNAL_ERROR
            message = "读取当前微信好友失败"
            self.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
        finally:
            self.metrics["totalMs"] = f"{(perf_counter() - started_at) * 1000:.1f}"
        return self._finish(code, message)

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        report = {
            "code": code.value,
            "message": message,
            "conversationTitle": self.conversation_title,
            "details": self.details,
            "metrics": self.metrics,
        }
        (self.artifact_dir / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return OperationResult(
            code=code,
            action="current_conversation",
            target="wechat_current",
            message=message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.details),
            metrics=self.metrics,
        )
