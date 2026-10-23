from __future__ import annotations

import json
import time
from collections import Counter
from collections.abc import Callable, Collection
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from ..accessibility_focus import (
    activate_and_current_conversation_context,
    current_conversation_header,
    header_matches_target,
    visible_conversation_rows,
)
from ..coordinates import Point
from ..locators.unread_conversation import (
    UnreadConversation,
    locate_unread_conversations,
    locate_unread_conversations_from_accessibility,
)
from ..mouse import click, double_click, press_escape
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window, capture_window_fast
from ..state_detector import conversation_header
from ..vision import OCRItem, recognize_text, save_ocr
from ..window import WindowError, WeChatWindow, main_wechat_window


HydrationProbe = Callable[[UnreadConversation], bool]
CHAT_TAB_LOGICAL_X = 30
CHAT_TAB_LOGICAL_Y = 122


class ScreenCaptureUnavailable(RuntimeError):
    pass


def chat_tab_point(pixel_scale_x: float, pixel_scale_y: float) -> Point:
    """Return the centre of WeChat's first left-rail button: Chats.

    The rail is anchored to the top-left of the window, so its coordinates are
    fixed in logical points. A height percentage drifts downward on a tall
    docked window and lands on the second button (Contacts).
    """
    return Point(
        round(CHAT_TAB_LOGICAL_X * pixel_scale_x),
        round(CHAT_TAB_LOGICAL_Y * pixel_scale_y),
    )


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
        self._selected_title_before_scan: str | None = None
        self._started_at = time.perf_counter()
        self._screenshot_ms = 0.0
        self._accessibility_rows_ms = 0.0
        self._header_verify_ms = 0.0
        self._preparation_ms = 0.0

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

    def _wait_for_hydration(self, conversation: UnreadConversation) -> str:
        if self.hydration_probe is None:
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
        """Double-click the first Chats button to promote unread chats to the top."""
        if self._window is None:
            self._window = main_wechat_window()
        double_click(
            Point(
                self._window.bounds.x + CHAT_TAB_LOGICAL_X,
                self._window.bounds.y + CHAT_TAB_LOGICAL_Y,
            ),
            settle=0.35,
        )
        self.details.append("CHAT_TAB_DOUBLE_CLICKED")

    def _open_one(
        self,
        saved: UnreadConversation,
        *,
        shot: Screenshot,
        page: int,
        index: int,
    ) -> tuple[bool, str]:
        click(
            shot.transform.physical_to_global_logical(saved.click_point),
            settle=0.4,
        )
        visible_header = ""
        started = time.perf_counter()
        try:
            visible_header = current_conversation_header()
            if not header_matches_target(visible_header, saved.title):
                time.sleep(0.25)
                visible_header = current_conversation_header()
            matched = header_matches_target(visible_header, saved.title)
            self.details.append("ACCESSIBILITY_OPENED_HEADER_READ=1")
        except Exception as exc:
            self.details.append(
                f"ACCESSIBILITY_OPENED_HEADER_FALLBACK: {type(exc).__name__}: {exc}"
            )
            opened_shot, opened_items = self._window_shot(
                f"page-{page:02d}-item-{index:02d}-opened"
            )
            header = conversation_header(
                opened_items,
                saved.title,
                image_width=opened_shot.image.width,
                image_height=opened_shot.image.height,
            )
            matched = header.matched
            visible_header = ", ".join(header.evidence)
        finally:
            self._header_verify_ms += (time.perf_counter() - started) * 1000
        if not matched:
            self.details.append(
                f"HEADER_MISMATCH page={page} title={saved.title!r} visible={visible_header!r}"
            )
            self.entries.append(
                {"title": saved.title, "status": "HEADER_MISMATCH", "hydration": "NOT_CHECKED"}
            )
            return False, f"打开 {saved.title!r} 后未能核验聊天标题，已停止"

        self.opened += 1
        self._opened_titles.add(saved.title)
        try:
            hydration = self._wait_for_hydration(saved)
        except Exception as exc:
            hydration = "PROBE_ERROR"
            self.details.append(
                f"HYDRATION_PROBE_ERROR title={saved.title!r}: {type(exc).__name__}: {exc}"
            )
        self.entries.append(
            {"title": saved.title, "status": "OPENED", "hydration": hydration}
        )
        self.details.append(
            f"OPENED page={page} title={saved.title!r} hydration={hydration}"
        )
        return True, ""

    def run(self) -> OperationResult:
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            started = time.perf_counter()
            context = activate_and_current_conversation_context()
            self._preparation_ms += (time.perf_counter() - started) * 1000
            self._window = WeChatWindow("微信", context.bounds)
            if self.allowed_titles and context.header in self.allowed_titles:
                self._selected_title_before_scan = context.header
            self.details.append("ACCESSIBILITY_SELECTED_TITLE_READ=1")
            for _ in range(3):
                press_escape(0.15)

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
                # The whitelist is finite and controlled by the customer
                # directory, so it is also the safest completeness bound. A
                # fixed eight-round cap would silently miss the ninth unread
                # customer once a distributor grows beyond a small account.
                round_limit = max(1, len(self.allowed_titles))
            # The screenshot and AX row query are independent read-only
            # snapshots of the same visible list. Run them together so each
            # unread round pays the slower system call once, not both calls in
            # sequence. Opening and title verification remain strictly serial.
            with ThreadPoolExecutor(max_workers=2) as snapshot_pool:
                for round_index in range(1, round_limit + 1):
                    snapshot_path = self._next_path(
                        f"top-unread-{round_index:02d}-snapshot"
                    )

                    def capture_snapshot() -> tuple[Screenshot, float]:
                        started = time.perf_counter()
                        shot = capture_window_fast(self._window.bounds, snapshot_path)
                        return shot, (time.perf_counter() - started) * 1000

                    def read_rows() -> tuple[list[tuple[str, object]], float]:
                        started = time.perf_counter()
                        rows = visible_conversation_rows()
                        return rows, (time.perf_counter() - started) * 1000

                    shot_future = snapshot_pool.submit(capture_snapshot)
                    rows_future = snapshot_pool.submit(read_rows)
                    page_shot, screenshot_ms = shot_future.result()
                    self._screenshot_ms += screenshot_ms
                    try:
                        rows, accessibility_ms = rows_future.result()
                        self._accessibility_rows_ms += accessibility_ms
                        if not rows:
                            raise RuntimeError("WECHAT_VISIBLE_CONVERSATION_ROWS_EMPTY")
                        snapshot = locate_unread_conversations_from_accessibility(
                            page_shot.image,
                            page_shot.transform,
                            rows,
                        )
                        self.details.append(
                            "ACCESSIBILITY_UNREAD_SCAN "
                            f"round={round_index} rows={len(rows)} unread={len(snapshot)}"
                        )
                    except Exception as exc:
                        # Keep the proven OCR implementation as a compatibility
                        # fallback if a future WeChat version changes its AX tree.
                        # The normal path never pays this multi-second cost.
                        self.details.append(
                            "ACCESSIBILITY_UNREAD_SCAN_FALLBACK "
                            f"round={round_index}: {type(exc).__name__}: {exc}"
                        )
                        page_items = self._read(page_shot)
                        snapshot = locate_unread_conversations(
                            page_shot.image,
                            page_items,
                        )
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
                        shot=page_shot,
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
        except WindowError as exc:
            code = ResultCode.VERIFY_FAILED
            message = "微信聊天主窗口未能打开，请确认微信已经登录"
            self.details.append(f"WECHAT_MAIN_WINDOW_UNAVAILABLE: {exc}")
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
            "TOTAL_MS": f"{(time.perf_counter() - self._started_at) * 1000:.1f}",
            "SCREENSHOT_MS": f"{self._screenshot_ms:.1f}",
            "ACCESSIBILITY_ROWS_MS": f"{self._accessibility_rows_ms:.1f}",
            "HEADER_VERIFY_MS": f"{self._header_verify_ms:.1f}",
            "PREPARATION_MS": f"{self._preparation_ms:.1f}",
        }
        payload = {
            "code": code.value,
            "message": message,
            "metrics": metrics,
            # Titles are private user data; this report lives below the ignored
            # artifacts/private directory and is never a repository fixture.
            "conversations": self.entries,
            "selectedTitle": self._selected_title_before_scan,
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
