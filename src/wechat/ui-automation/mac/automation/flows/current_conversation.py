from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ..results import OperationResult, ResultCode
from ..screenshot import capture_window
from ..state_detector import current_conversation_title
from ..vision import recognize_text, save_ocr
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

    def run(self) -> OperationResult:
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            activate_wechat()
            window = main_wechat_window()
            screenshot = capture_window(
                window.bounds,
                self.artifact_dir / "current-conversation.png",
            )
            items = recognize_text(screenshot.path, screenshot.image.size)
            save_ocr(items, screenshot.path.with_suffix(".ocr.json"))
            if not items:
                code = ResultCode.SCREEN_RECORDING_PERMISSION_REQUIRED
                message = "无法识别当前微信会话，请检查 GrainPrint 的屏幕录制权限"
            else:
                # Unlike conversation_header, this detector does not need a
                # customer-title whitelist and can surface an unmatched friend.
                # The renderer decides whether that friend means
                # “此微信好友没有关联客户” after the visible title is returned.
                self.conversation_title = current_conversation_title(
                    items,
                    image_width=screenshot.image.width,
                    image_height=screenshot.image.height,
                )
                self.details.append(
                    f"VISIBLE_HEADER_FOUND={1 if self.conversation_title else 0}"
                )
                if self.conversation_title:
                    code = ResultCode.SUCCESS
                    message = f"已识别当前微信会话“{self.conversation_title}”"
                else:
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
        return self._finish(code, message)

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        report = {
            "code": code.value,
            "message": message,
            "conversationTitle": self.conversation_title,
            "details": self.details,
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
        )
