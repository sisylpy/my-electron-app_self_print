from __future__ import annotations

import json
from collections.abc import Collection
from datetime import datetime
from pathlib import Path

from ..coordinates import Point
from ..locators.unread_conversation import (
    UnreadConversation,
    locate_unread_conversations,
)
from ..mouse import double_click, press_escape
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window
from ..state_detector import current_conversation_title
from ..vision import OCRItem, recognize_text, save_ocr
from ..window import WindowError, WeChatWindow, activate_wechat, main_wechat_window


CHAT_TAB_LOGICAL_X = 30
CHAT_TAB_LOGICAL_Y = 122


def matching_unread_conversations(
    conversations: list[UnreadConversation],
    allowed_titles: Collection[str],
) -> list[UnreadConversation]:
    """Return one visible unread row per exact customer-bound title."""
    allowed = {title.strip() for title in allowed_titles if title.strip()}
    matched: dict[str, UnreadConversation] = {}
    for conversation in conversations:
        if conversation.title in allowed:
            matched.setdefault(conversation.title, conversation)
    return sorted(matched.values(), key=lambda item: item.title_rect.center.y)


class InspectUnreadConversationsFlow:
    """Count bound unread chats without opening them or changing read state."""

    def __init__(
        self,
        *,
        allowed_titles: Collection[str],
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        self.allowed_titles = {title.strip() for title in allowed_titles if title.strip()}
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self._counter = 0
        self._window: WeChatWindow | None = None
        self.details: list[str] = []
        self.entries: list[dict[str, str]] = []
        self.selected_title = ""
        self.detected_count = 0

    def _next_path(self, name: str) -> Path:
        self._counter += 1
        return self.artifact_dir / f"{self._counter:03d}-{name}.png"

    def _window_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        if self._window is None:
            self._window = main_wechat_window()
        shot = capture_window(self._window.bounds, self._next_path(name))
        items = recognize_text(shot.path, shot.image.size)
        save_ocr(items, shot.path.with_suffix(".ocr.json"))
        return shot, items

    @staticmethod
    def _chat_tab_point(scale_x: float, scale_y: float) -> Point:
        return Point(
            round(CHAT_TAB_LOGICAL_X * scale_x),
            round(CHAT_TAB_LOGICAL_Y * scale_y),
        )

    def run(self) -> OperationResult:
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            activate_wechat()
            for _ in range(3):
                press_escape(0.12)
            self._window = main_wechat_window()

            before_shot, before_items = self._window_shot("before-inspection")
            if not before_items:
                code = ResultCode.SCREEN_RECORDING_PERMISSION_REQUIRED
                message = "无法识别微信窗口，请检查 GrainPrint 的屏幕录制权限"
                return self._finish(code, message)
            self.selected_title = current_conversation_title(
                before_items,
                image_width=before_shot.image.width,
                image_height=before_shot.image.height,
            )

            # Promoting unread rows to the top changes only their display order.
            # It never opens a conversation, so every unread badge stays unread.
            double_click(
                before_shot.transform.physical_to_global_logical(
                    self._chat_tab_point(
                        before_shot.transform.scale_x,
                        before_shot.transform.scale_y,
                    )
                ),
                settle=0.55,
            )
            unread_shot, unread_items = self._window_shot("unread-summary")
            if not unread_items:
                code = ResultCode.SCREEN_RECORDING_PERMISSION_REQUIRED
                message = "无法识别微信未读列表，请检查 GrainPrint 的屏幕录制权限"
                return self._finish(code, message)

            visible = locate_unread_conversations(unread_shot.image, unread_items)
            self.detected_count = len(visible)
            matched = matching_unread_conversations(visible, self.allowed_titles)
            self.entries = [
                {"title": item.title, "status": "UNREAD"}
                for item in matched
            ]
            self.details.append(f"VISIBLE_UNREAD={self.detected_count}")
            self.details.append(f"BOUND_UNREAD={len(self.entries)}")
            if self.entries:
                code = ResultCode.SUCCESS
                message = f"当前有 {len(self.entries)} 位未读客户"
            else:
                code = ResultCode.NO_UNREAD
                message = "当前没有未读客户"
        except WindowError as exc:
            code = ResultCode.VERIFY_FAILED
            message = "微信聊天主窗口未能打开，请确认微信已经登录"
            self.details.append(f"WECHAT_MAIN_WINDOW_UNAVAILABLE: {exc}")
        except Exception as exc:  # pragma: no cover - real UI failure path
            code = ResultCode.INTERNAL_ERROR
            message = "统计微信未读客户失败"
            self.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
        return self._finish(code, message)

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        metrics = {
            "UNREAD_DETECTED": str(self.detected_count),
            "UNREAD_MATCHED": str(len(self.entries)),
        }
        report = {
            "code": code.value,
            "message": message,
            "metrics": metrics,
            "conversations": self.entries,
            "selectedTitle": self.selected_title,
            "details": self.details,
        }
        (self.artifact_dir / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return OperationResult(
            code=code,
            action="inspect_unread_conversations",
            target="wechat_unread",
            message=message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.details),
            metrics=metrics,
        )
