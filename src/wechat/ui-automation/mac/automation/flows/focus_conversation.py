from __future__ import annotations

from datetime import datetime
from pathlib import Path

from ..mouse import click, press_escape
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window
from ..state_detector import exact_chat_header
from ..vision import OCRItem, find_text, recognize_text, save_ocr
from ..window import WeChatWindow, activate_wechat, main_wechat_window


class FocusConversationFlow:
    """Open one exact visible WeChat conversation and verify its header."""

    def __init__(
        self,
        *,
        target: str,
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        self.target = target.strip()
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self._counter = 0
        self._window: WeChatWindow | None = None
        self.details: list[str] = []

    def _next_path(self, name: str) -> Path:
        self._counter += 1
        return self.artifact_dir / f"{self._counter:02d}-{name}.png"

    def _read(self, shot: Screenshot) -> list[OCRItem]:
        items = recognize_text(shot.path, shot.image.size)
        save_ocr(items, shot.path.with_suffix(".ocr.json"))
        return items

    def _window_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        if self._window is None:
            self._window = main_wechat_window()
        shot = capture_window(self._window.bounds, self._next_path(name))
        return shot, self._read(shot)

    def _header_matches(self, shot: Screenshot, items: list[OCRItem]) -> bool:
        return exact_chat_header(
            items,
            self.target,
            image_width=shot.image.width,
            image_height=shot.image.height,
        ).matched

    def run(self) -> OperationResult:
        try:
            activate_wechat()
            for _ in range(2):
                press_escape(0.1)
            self._window = main_wechat_window()
            shot, items = self._window_shot("conversation-before")
            if self._header_matches(shot, items):
                return self._finish(ResultCode.SUCCESS, f"微信已显示会话“{self.target}”")

            candidates = [
                item
                for item in find_text(items, self.target, exact=True)
                if item.rect.x < shot.image.width * 0.45
                and shot.image.height * 0.12 <= item.rect.center.y <= shot.image.height * 0.99
            ]
            self.details.append(f"LIST_CANDIDATES={len(candidates)}")
            if len(candidates) != 1:
                code = ResultCode.TARGET_AMBIGUOUS if len(candidates) > 1 else ResultCode.TARGET_NOT_FOUND
                return self._finish(code, f"无法在微信会话列表中唯一找到“{self.target}”")

            click(shot.transform.physical_to_global_logical(candidates[0].rect.center), 0.8)
            self._window = main_wechat_window()
            reopened, reopened_items = self._window_shot("conversation-after")
            if not self._header_matches(reopened, reopened_items):
                return self._finish(ResultCode.VERIFY_FAILED, f"微信切换后未能核验会话“{self.target}”")
            return self._finish(ResultCode.SUCCESS, f"已切换到微信会话“{self.target}”")
        except Exception as exc:  # pragma: no cover - real UI failure path
            self.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
            return self._finish(ResultCode.INTERNAL_ERROR, "切换微信会话失败")

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        return OperationResult(
            code=code,
            action="focus_conversation",
            target=self.target,
            message=message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.details),
        )
