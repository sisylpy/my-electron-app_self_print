from __future__ import annotations

from datetime import datetime
from pathlib import Path

from ..coordinates import CoordinateTransformer, Point
from ..mouse import click, paste_clipboard, press_escape, select_all, set_clipboard
from ..results import OperationResult, ResultCode
from ..screenshot import Screenshot, capture_window
from ..state_detector import conversation_header
from ..vision import OCRItem, find_text, recognize_text, save_ocr
from ..window import WeChatWindow, activate_wechat, main_wechat_window


_SEARCH_COLUMN_MAX_X_RATIO = 0.45
_SEARCH_FIELD_MAX_X_RATIO = 0.38
_SEARCH_FIELD_MAX_Y_RATIO = 0.075


def _compact_text(value: str) -> str:
    return "".join(str(value or "").split()).casefold()


def search_box_candidates(
    items: list[OCRItem], *, image_width: int, image_height: int
) -> list[OCRItem]:
    """Return only OCR labels inside WeChat's top-left search field.

    Vision commonly reads the magnifying-glass glyph together with the
    placeholder (for example ``Q搜索``), so requiring an exact ``搜索`` match
    incorrectly sends the click to the positional fallback.
    """

    candidates = [
        item
        for item in items
        if "搜索" in _compact_text(item.text)
        and item.rect.center.x < image_width * _SEARCH_FIELD_MAX_X_RATIO
        and item.rect.center.y < image_height * _SEARCH_FIELD_MAX_Y_RATIO
    ]
    return sorted(candidates, key=lambda item: (item.rect.center.y, item.rect.center.x))


def fallback_search_point(image_width: int, image_height: int) -> Point:
    """Use the center of WeChat's search field, never a conversation row."""

    return Point(image_width * 0.18, image_height * 0.035)


def query_visible_in_search_field(
    items: list[OCRItem], target: str, *, image_width: int, image_height: int
) -> bool:
    normalized_target = _compact_text(target)
    return any(
        # Vision often merges the magnifying-glass glyph into the field text
        # (for example ``Q金调料``). Geometry proves this is the search field,
        # so containing the exact query is the correct focus verification.
        normalized_target in _compact_text(item.text)
        and item.rect.center.x < image_width * _SEARCH_FIELD_MAX_X_RATIO
        and item.rect.center.y < image_height * _SEARCH_FIELD_MAX_Y_RATIO
        for item in items
    )


class FocusConversationFlow:
    """Search, click, and verify one exact WeChat conversation.

    The flow deliberately follows the visible interaction a person would use:
    click WeChat's search box, enter the friend's name, click the exact result,
    then verify the opened chat.  This works even when the friend has scrolled
    out of the visible conversation list and clears WeChat's unread badge before
    GrainPrint reads the local message database.
    """

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

    def _foreground_window(self) -> WeChatWindow:
        """Raise WeChat immediately before reading or interacting with it."""

        activate_wechat()
        self._window = main_wechat_window()
        return self._window

    def _window_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        window = self._foreground_window()
        shot = capture_window(window.bounds, self._next_path(name))
        return shot, self._read(shot)

    def _click_in_window(self, shot: Screenshot, point: Point, settle: float) -> None:
        """Click a screenshot point after revalidating the live WeChat window.

        Vision OCR can take several seconds. During that gap another desktop
        window may become frontmost; clicking with the old focus would type the
        query into whichever text field was previously active. Re-raising
        WeChat and rebuilding the coordinate transform makes the click belong
        to the current WeChat window.
        """

        window = self._foreground_window()
        transform = CoordinateTransformer(
            window.bounds,
            shot.image.width,
            shot.image.height,
        )
        click(transform.physical_to_global_logical(point), settle)

    def _header_matches(self, shot: Screenshot, items: list[OCRItem]) -> bool:
        return conversation_header(
            items,
            self.target,
            image_width=shot.image.width,
            image_height=shot.image.height,
        ).matched

    def run(self) -> OperationResult:
        try:
            activate_wechat()
            self._window = main_wechat_window()
            # Close a stale search/menu so the standard search placeholder is
            # visible and can be located without relying on a fixed coordinate.
            press_escape(0.2)
            shot, items = self._window_shot("search-before")

            # Manual refresh calls this flow once before reading the local
            # database and once again after new messages have arrived. If the
            # intended chat is already open, raising WeChat and keeping that
            # verified conversation active is enough for WeChat to clear its
            # unread badge. Avoid reopening search, which would temporarily
            # take focus away from the current conversation.
            if self._header_matches(shot, items):
                self.details.append("CURRENT_CONVERSATION_ACTIVATED")
                return self._finish(
                    ResultCode.SUCCESS,
                    f"微信当前会话“{self.target}”已激活",
                )

            search_boxes = search_box_candidates(
                items,
                image_width=shot.image.width,
                image_height=shot.image.height,
            )
            self.details.append(f"SEARCH_BOX_CANDIDATES={len(search_boxes)}")
            if search_boxes:
                search_point = search_boxes[0].rect.center
                self.details.append("SEARCH_BOX_OCR_LOCATED")
            else:
                # The placeholder's two light-gray characters are occasionally
                # missed by Vision OCR. WeChat's main-window search field is a
                # stable, reserved area at the top of the conversation column;
                # this relative center is safely above all conversation rows.
                search_point = fallback_search_point(
                    shot.image.width,
                    shot.image.height,
                )
                self.details.append("SEARCH_BOX_POSITION_FALLBACK")

            self._click_in_window(shot, search_point, 0.25)
            select_all(0.1)
            set_clipboard(self.target)
            paste_clipboard(0.9)
            self.details.append("SEARCH_QUERY_ENTERED")

            results_shot, result_items = self._window_shot("search-results")
            if not query_visible_in_search_field(
                result_items,
                self.target,
                image_width=results_shot.image.width,
                image_height=results_shot.image.height,
            ):
                # Do not trust the current keyboard focus. If the initial OCR
                # click missed, Cmd+V could otherwise write the customer's name
                # into the message composer. Retry once at the tightly bounded
                # top search-field center and verify before reading results.
                self.details.append("SEARCH_FIELD_FOCUS_NOT_VERIFIED")
                retry_point = fallback_search_point(
                    results_shot.image.width,
                    results_shot.image.height,
                )
                self._click_in_window(results_shot, retry_point, 0.25)
                select_all(0.1)
                set_clipboard(self.target)
                paste_clipboard(0.9)
                results_shot, result_items = self._window_shot("search-results-retry")
                if not query_visible_in_search_field(
                    result_items,
                    self.target,
                    image_width=results_shot.image.width,
                    image_height=results_shot.image.height,
                ):
                    press_escape(0.2)
                    return self._finish(
                        ResultCode.VERIFY_FAILED,
                        "未能定位微信左上角搜索栏，请重试",
                    )
                self.details.append("SEARCH_FIELD_FOCUS_RETRY_VERIFIED")

            candidates = [
                item
                for item in find_text(result_items, self.target, exact=True)
                # Exclude the query inside the search field and any matching
                # sender label in the message pane. Only search-result rows in
                # the left column are valid click targets.
                if item.rect.center.x < results_shot.image.width * _SEARCH_COLUMN_MAX_X_RATIO
                and results_shot.image.height * _SEARCH_FIELD_MAX_Y_RATIO
                <= item.rect.center.y
                <= results_shot.image.height * 0.92
            ]
            candidates.sort(key=lambda item: (item.rect.center.y, item.rect.center.x))
            self.details.append(f"SEARCH_RESULT_CANDIDATES={len(candidates)}")
            if not candidates:
                press_escape(0.2)
                return self._finish(ResultCode.TARGET_NOT_FOUND, f"微信搜索不到“{self.target}”")
            if len(candidates) > 1:
                # WeChat may repeat the same title again under chat-history
                # results. The first exact row is the direct friend/chat result
                # a person would click; the opened header is still verified.
                self.details.append("SEARCH_RESULT_FIRST_EXACT_SELECTED")

            self._click_in_window(results_shot, candidates[0].rect.center, 0.9)
            self.details.append("SEARCH_RESULT_CLICKED")
            # Leave WeChat in its normal conversation-list state while keeping
            # the selected chat open, just as a user would after searching.
            press_escape(0.3)
            self._window = main_wechat_window()
            reopened, reopened_items = self._window_shot("conversation-after")
            if not self._header_matches(reopened, reopened_items):
                return self._finish(ResultCode.VERIFY_FAILED, f"微信切换后未能核验会话“{self.target}”")
            return self._finish(ResultCode.SUCCESS, f"已搜索并打开微信会话“{self.target}”")
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
