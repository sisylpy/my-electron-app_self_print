from __future__ import annotations

import json
import time
from collections import Counter
from collections.abc import Callable, Collection
from datetime import datetime
from pathlib import Path

from ..coordinates import Point, Rect
from ..locators.unread_conversation import (
    UnreadConversation,
    locate_unread_conversations,
)
from ..mouse import click, double_click, press_escape, scroll_vertical
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window
from ..state_detector import conversation_header
from ..vision import OCRItem, recognize_text, save_ocr
from ..window import WeChatWindow, activate_wechat, main_wechat_window


HydrationProbe = Callable[[UnreadConversation], bool]


def chat_tab_point(image_width: int, image_height: int) -> Point:
    """Return the centre of WeChat's left-rail conversation/logo button."""
    return Point(round(image_width * 0.052), round(image_height * 0.205))


def current_allowed_title(
    items: list[OCRItem],
    allowed_titles: Collection[str],
    *,
    image_width: int,
    image_height: int,
) -> str | None:
    """Return the one exact customer-bound title already open in WeChat.

    WeChat does not add an unread badge when a message arrives in the chat
    currently shown on screen.  Including that exact bound header closes the
    gap without widening the scan to unrelated/read conversations.
    """
    matches = [
        title
        for title in sorted({value.strip() for value in allowed_titles if value.strip()})
        if conversation_header(
            items,
            title,
            image_width=image_width,
            image_height=image_height,
        ).matched
    ]
    return matches[0] if len(matches) == 1 else None


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
        self.current_included = 0
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

    def _list_point(self) -> Point:
        if self._window is None:
            raise RuntimeError("微信窗口尚未初始化")
        bounds = self._window.bounds
        return Point(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.55)

    @staticmethod
    def _page_signature(items: list[OCRItem], width: int, height: int) -> tuple[str, ...]:
        values = [
            f"{item.text.strip()}@{round(item.center.y / 12)}"
            for item in items
            if item.text.strip()
            and item.rect.x < width * 0.46
            and height * 0.07 < item.center.y < height * 0.98
        ]
        return tuple(sorted(values))

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

    def _current_bound_title(self) -> str | None:
        if not self.allowed_titles:
            return None
        shot, items = self._window_shot("current-conversation")
        return current_allowed_title(
            items,
            self.allowed_titles,
            image_width=shot.image.width,
            image_height=shot.image.height,
        )

    def _focus_chat_tab(self) -> None:
        """Double-click the green WeChat logo to promote unread chats to the top."""
        shot, _ = self._window_shot("chat-tab-before")
        double_click(
            shot.transform.physical_to_global_logical(
                chat_tab_point(shot.image.width, shot.image.height)
            ),
            settle=0.8,
        )
        self.details.append("CHAT_TAB_DOUBLE_CLICKED")

    def _include_current_bound_conversation(self, title: str | None) -> None:
        if title is None or title in self._opened_titles:
            return

        synthetic = UnreadConversation(
            title=title,
            preview="",
            title_rect=Rect(0, 0, 1, 1),
            badge_rect=Rect(0, 0, 1, 1),
        )
        try:
            hydration = self._wait_for_hydration(synthetic)
        except Exception as exc:
            hydration = "PROBE_ERROR"
            self.details.append(
                f"HYDRATION_PROBE_ERROR title={title!r}: {type(exc).__name__}: {exc}"
            )
        self.opened += 1
        self.current_included += 1
        self._opened_titles.add(title)
        self.entries.append(
            {
                "title": title,
                "status": "OPENED",
                "hydration": hydration,
                "source": "CURRENT",
            }
        )
        self.details.append(
            f"CURRENT_BOUND title={title!r} hydration={hydration}"
        )

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
        reached_bottom = False
        try:
            activate_wechat()
            for _ in range(3):
                press_escape(0.15)
            self._window = main_wechat_window()

            # A message received in the chat already on screen has no unread
            # badge.  Remember that exact bound title, but defer reporting it
            # until after all visible unread rows have been opened from top to
            # bottom.  This keeps the user-visible sequence deterministic.
            current_title = self._current_bound_title()

            # Explicitly enter WeChat's conversation tab.  WeChat promotes
            # unread rows to the top when this green logo is double-clicked,
            # which is also the clearest visible starting point for the
            # operator.
            self._focus_chat_tab()

            # Visibly return to the top of the conversation list.  The wheel
            # event is pinned to the list, never to the chat transcript.
            for _ in range(4):
                scroll_vertical(self._list_point(), 18, settle=0.25)
            time.sleep(0.6)

            processed: set[str] = set()
            for page in range(1, self.max_pages + 1):
                page_shot, page_items = self._window_shot(f"page-{page:02d}-snapshot")
                snapshot = locate_unread_conversations(page_shot.image, page_items)
                snapshot = [
                    item
                    for item in snapshot
                    if item.key not in processed and item.title not in self._opened_titles
                ]
                self.detected += len(snapshot)

                if self.allowed_titles is not None:
                    unrelated = [
                        item for item in snapshot if item.title not in self.allowed_titles
                    ]
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
                        f"SKIP page={page} title={item.title!r}: duplicate title and preview"
                    )

                # The whole current page is snapshotted before the first click,
                # so clearing one red dot cannot make later rows disappear from
                # this work queue.
                for index, conversation in enumerate(actionable, start=1):
                    processed.add(conversation.key)
                    ok, reason = self._open_one(
                        conversation,
                        page=page,
                        index=index,
                    )
                    if not ok:
                        code = ResultCode.VERIFY_FAILED
                        message = reason
                        return self._finish(code, message)

                before_scroll, before_items = self._window_shot(
                    f"page-{page:02d}-before-scroll"
                )
                before_signature = self._page_signature(
                    before_items, before_scroll.image.width, before_scroll.image.height
                )
                scroll_vertical(self._list_point(), -8, settle=0.9)
                after_scroll, after_items = self._window_shot(
                    f"page-{page:02d}-after-scroll"
                )
                after_signature = self._page_signature(
                    after_items, after_scroll.image.width, after_scroll.image.height
                )
                if after_signature == before_signature:
                    reached_bottom = True
                    break

            # The initially open bound conversation may not have had a red
            # badge.  Include it only after the top-first unread sequence, and
            # never duplicate it when the same title was opened above.
            self._include_current_bound_conversation(current_title)

            if not reached_bottom:
                code = ResultCode.SCAN_LIMIT_REACHED
                message = (
                    f"已核验 {self.opened} 个已绑定会话，但达到 {self.max_pages} 页扫描上限"
                )
            else:
                code = ResultCode.SUCCESS
                message = f"已在微信窗口核验 {self.opened} 个已绑定会话"
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
            "CURRENT_BOUND_INCLUDED": str(self.current_included),
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
