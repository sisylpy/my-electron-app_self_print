from __future__ import annotations

import json
import time
from collections import Counter
from collections.abc import Callable, Collection
from datetime import datetime
from pathlib import Path

from ..coordinates import Point
from ..locators.unread_conversation import (
    UnreadConversation,
    locate_unread_conversations,
)
from ..mouse import click, double_click, press_escape
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window
from ..state_detector import conversation_header
from ..vision import OCRItem, recognize_text, save_ocr
from ..window import WeChatWindow, activate_wechat, main_wechat_window


HydrationProbe = Callable[[UnreadConversation], bool]


class ScreenCaptureUnavailable(RuntimeError):
    pass


def chat_tab_point(image_width: int, image_height: int) -> Point:
    """Return the centre of WeChat's left-rail conversation/logo button."""
    return Point(round(image_width * 0.052), round(image_height * 0.205))


class ReadUnreadConversationsFlow:
    """Visibly open unread conversations one by one, like a human operator.

    This flow does not parse screenshots into orders.  A caller can provide a
    ``hydration_probe`` which returns True once its structured local Reader has
    observed the opened conversation.  That keeps UI navigation separate from
    message/database semantics.
    """

    def __init__(
        self,
        *,
        max_pages: int = 8,
        dwell_seconds: float = 1.8,
        hydration_probe: HydrationProbe | None = None,
        hydration_timeout: float = 8.0,
        allowed_titles: Collection[str] | None = None,
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        self.max_pages = max_pages
        self.dwell_seconds = dwell_seconds
        self.hydration_probe = hydration_probe
        self.hydration_timeout = hydration_timeout
        self.allowed_titles = (
            {title.strip() for title in allowed_titles if title.strip()}
            if allowed_titles is not None
            else None
        )
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self._counter = 0
        self._window: WeChatWindow | None = None
        self.details: list[str] = []
        self.entries: list[dict[str, str]] = []
        self.detected = 0
        self.opened = 0
        self.hydrated = 0
        self.skipped = 0
        self.filtered = 0
        self._opened_titles: set[str] = set()

    def _next_path(self, name: str) -> Path:
        self._counter += 1
        return self.artifact_dir / f"{self._counter:03d}-{name}.png"

    def _read(self, shot: Screenshot) -> list[OCRItem]:
        items = recognize_text(shot.path, shot.image.size)
        save_ocr(items, shot.path.with_suffix(".ocr.json"))
        return items

    def _window_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        if self._window is None:
            self._window = main_wechat_window()
        shot = capture_window(self._window.bounds, self._next_path(name))
        return shot, self._read(shot)

    @staticmethod
    def _resolve_candidate(
        saved: UnreadConversation,
        current: list[UnreadConversation],
    ) -> UnreadConversation | None:
        exact = [item for item in current if item.key == saved.key]
        if exact:
            return min(
                exact,
                key=lambda item: abs(item.title_rect.center.y - saved.title_rect.center.y),
            )
        # Preview OCR can change slightly between captures.  A unique exact
        # title near the same row is a safe fallback; fuzzy title matching is
        # intentionally forbidden.
        same_title = [item for item in current if item.title == saved.title]
        near = [
            item
            for item in same_title
            if abs(item.title_rect.center.y - saved.title_rect.center.y) <= 42
        ]
        return near[0] if len(near) == 1 else None

    def _wait_for_hydration(self, conversation: UnreadConversation) -> str:
        if self.hydration_probe is None:
            time.sleep(self.dwell_seconds)
            return "NOT_CHECKED"

        deadline = time.monotonic() + self.hydration_timeout
        while True:
            if self.hydration_probe(conversation):
                self.hydrated += 1
                # Keep a short visible dwell even when the Reader responds
                # immediately; users should be able to follow the sequence.
                time.sleep(min(self.dwell_seconds, 0.8))
                return "PASS"
            if time.monotonic() >= deadline:
                return "TIMEOUT"
            time.sleep(min(0.5, max(0.1, deadline - time.monotonic())))

    def _focus_chat_tab(self) -> None:
        """Double-click the green WeChat logo to promote unread chats to the top."""
        shot, items = self._window_shot("chat-tab-before")
        if not items:
            raise ScreenCaptureUnavailable(
                "微信窗口截图没有任何可识别文字，通常表示 GrainPrint 没有屏幕录制权限"
            )
        double_click(
            shot.transform.physical_to_global_logical(
                chat_tab_point(shot.image.width, shot.image.height)
            ),
            settle=0.8,
        )
        self.details.append("CHAT_TAB_DOUBLE_CLICKED")

    def _open_one(
        self,
        saved: UnreadConversation,
        *,
        page: int,
        index: int,
    ) -> tuple[bool, str]:
        current_shot, current_items = self._window_shot(
            f"page-{page:02d}-item-{index:02d}-before"
        )
        visible = locate_unread_conversations(current_shot.image, current_items)
        candidate = self._resolve_candidate(saved, visible)
        if candidate is None:
            self.skipped += 1
            self.details.append(
                f"SKIP page={page} title={saved.title!r}: unread row no longer uniquely visible"
            )
            self.entries.append(
                {"title": saved.title, "status": "SKIPPED", "hydration": "NOT_CHECKED"}
            )
            return True, ""

        click(
            current_shot.transform.physical_to_global_logical(candidate.click_point),
            settle=0.7,
        )
        opened_shot, opened_items = self._window_shot(
            f"page-{page:02d}-item-{index:02d}-opened"
        )
        header = conversation_header(
            opened_items,
            candidate.title,
            image_width=opened_shot.image.width,
            image_height=opened_shot.image.height,
        )
        if not header.matched:
            self.details.append(
                f"HEADER_MISMATCH page={page} title={candidate.title!r} evidence={header.evidence}"
            )
            self.entries.append(
                {"title": candidate.title, "status": "HEADER_MISMATCH", "hydration": "NOT_CHECKED"}
            )
            return False, f"打开 {candidate.title!r} 后未能核验聊天标题，已停止"

        self.opened += 1
        self._opened_titles.add(candidate.title)
        try:
            hydration = self._wait_for_hydration(candidate)
        except Exception as exc:
            hydration = "PROBE_ERROR"
            self.details.append(
                f"HYDRATION_PROBE_ERROR title={candidate.title!r}: {type(exc).__name__}: {exc}"
            )
        self.entries.append(
            {"title": candidate.title, "status": "OPENED", "hydration": hydration}
        )
        self.details.append(
            f"OPENED page={page} title={candidate.title!r} hydration={hydration}"
        )
        return True, ""

    def run(self) -> OperationResult:
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            activate_wechat()
            for _ in range(3):
                press_escape(0.15)
            self._window = main_wechat_window()

            # Explicitly enter WeChat's conversation tab.  WeChat promotes
            # unread rows to the top when this green logo is double-clicked,
            # which is also the clearest visible starting point for the
            # operator.
            self._focus_chat_tab()

            processed: set[str] = set()
            # Double-clicking the chat logo promotes unread conversations to
            # the top.  Re-snapshot that top region after each opened chat;
            # never scroll through the user's full conversation history.
            round_limit = self.max_pages
            if self.allowed_titles is not None:
                round_limit = min(round_limit, max(1, len(self.allowed_titles)))
            for round_index in range(1, round_limit + 1):
                page_shot, page_items = self._window_shot(
                    f"top-unread-{round_index:02d}-snapshot"
                )
                snapshot = locate_unread_conversations(page_shot.image, page_items)
                snapshot = [
                    item
                    for item in snapshot
                    if item.key not in processed and item.title not in self._opened_titles
                ]
                unseen = [item for item in snapshot if item.key not in processed]
                self.detected += len(unseen)

                if self.allowed_titles is not None:
                    unrelated = [item for item in unseen if item.title not in self.allowed_titles]
                    for item in unrelated:
                        processed.add(item.key)
                        self.filtered += 1
                        self.entries.append(
                            {
                                "title": item.title,
                                "status": "FILTERED",
                                "hydration": "NOT_CHECKED",
                            }
                        )
                    snapshot = [
                        item for item in snapshot if item.title in self.allowed_titles
                    ]

                key_counts = Counter(item.key for item in snapshot)
                actionable = [item for item in snapshot if key_counts[item.key] == 1]
                ambiguous = [item for item in snapshot if key_counts[item.key] > 1]
                for item in ambiguous:
                    processed.add(item.key)
                    self.skipped += 1
                    self.entries.append(
                        {"title": item.title, "status": "AMBIGUOUS", "hydration": "NOT_CHECKED"}
                    )
                    self.details.append(
                        f"SKIP top={round_index} title={item.title!r}: duplicate title and preview"
                    )

                if not actionable:
                    break

                # Open only the topmost bound unread conversation.  Opening it
                # may reorder the list, so the next round locates everything
                # again instead of reusing stale row coordinates.
                conversation = min(actionable, key=lambda item: item.title_rect.center.y)
                processed.add(conversation.key)
                ok, reason = self._open_one(
                    conversation,
                    page=round_index,
                    index=1,
                )
                if not ok:
                    code = ResultCode.VERIFY_FAILED
                    message = reason
                    return self._finish(code, message)
                if self.allowed_titles is not None and self.allowed_titles.issubset(
                    self._opened_titles
                ):
                    break

            if self.opened:
                code = ResultCode.SUCCESS
                message = f"已在微信顶部未读区核验 {self.opened} 个已绑定会话"
            else:
                code = ResultCode.NO_UNREAD
                message = "没有未读信息"
        except ScreenCaptureUnavailable as exc:
            code = ResultCode.SCREEN_RECORDING_PERMISSION_REQUIRED
            message = (
                "请在“系统设置 → 隐私与安全性 → 屏幕录制”中允许 GrainPrint，"
                "完全退出 GrainPrint 后重新打开"
            )
            self.details.append(f"SCREEN_CAPTURE_UNAVAILABLE: {exc}")
        except Exception as exc:  # pragma: no cover - real UI failure path
            code = ResultCode.INTERNAL_ERROR
            message = "未读会话自动化内部错误；请查看私有诊断产物"
            self.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
        return self._finish(code, message)

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        metrics = {
            "UNREAD_DETECTED": str(self.detected),
            "UNREAD_OPENED": str(self.opened),
            "DB_HYDRATED": str(self.hydrated),
            "SKIPPED": str(self.skipped),
            "FILTERED": str(self.filtered),
        }
        payload = {
            "code": code.value,
            "message": message,
            "metrics": metrics,
            # Titles are private user data; this report lives below the ignored
            # artifacts/private directory and is never a repository fixture.
            "conversations": self.entries,
            "details": self.details,
        }
        (self.artifact_dir / "report.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return OperationResult(
            code=code,
            action="read_unread_conversations",
            target="wechat_unread",
            message=message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.details),
            metrics=metrics,
        )
