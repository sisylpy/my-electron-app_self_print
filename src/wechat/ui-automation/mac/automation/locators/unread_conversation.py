from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from PIL import Image

from ..coordinates import Point, Rect
from ..vision import OCRItem


_TIME_TEXT = re.compile(r"^(?:\d{1,2}:\d{2}|昨天|星期[一二三四五六日天]|周[一二三四五六日天])$")


@dataclass(frozen=True)
class UnreadConversation:
    """One unread conversation row detected in the current visible page."""

    title: str
    preview: str
    title_rect: Rect
    badge_rect: Rect

    @property
    def click_point(self) -> Point:
        return self.title_rect.center

    @property
    def key(self) -> str:
        # The preview helps distinguish two conversations with the same title.
        return f"{self.title.strip()}\u241f{self.preview.strip()}"


def _connected_components(mask: np.ndarray, *, x_offset: int, y_offset: int) -> list[Rect]:
    visited = np.zeros(mask.shape, dtype=bool)
    height, width = mask.shape
    output: list[Rect] = []
    for y, x in zip(*np.nonzero(mask & ~visited)):
        if visited[y, x]:
            continue
        stack = [(int(x), int(y))]
        visited[y, x] = True
        xs: list[int] = []
        ys: list[int] = []
        while stack:
            cx, cy = stack.pop()
            xs.append(cx)
            ys.append(cy)
            for nx, ny in (
                (cx - 1, cy),
                (cx + 1, cy),
                (cx, cy - 1),
                (cx, cy + 1),
            ):
                if (
                    0 <= nx < width
                    and 0 <= ny < height
                    and mask[ny, nx]
                    and not visited[ny, nx]
                ):
                    visited[ny, nx] = True
                    stack.append((nx, ny))
        output.append(
            Rect(
                x_offset + min(xs),
                y_offset + min(ys),
                max(xs) - min(xs) + 1,
                max(ys) - min(ys) + 1,
            )
        )
    return output


def locate_unread_badges(image: Image.Image) -> list[Rect]:
    """Locate WeChat-red badge shapes in the conversation-list column.

    This is deliberately stricter than a generic "red pixel" search.  The
    geometry filter rejects red text and large red areas in avatars.  A badge
    is not actionable until it can also be paired with an OCR title.
    """
    width, height = image.size
    left = int(width * 0.055)
    right = int(width * 0.46)
    top = int(height * 0.07)
    bottom = int(height * 0.985)
    rgb = np.asarray(image.crop((left, top, right, bottom)).convert("RGB"), dtype=np.int16)
    red = rgb[:, :, 0]
    green = rgb[:, :, 1]
    blue = rgb[:, :, 2]
    mask = (
        (red >= 205)
        & (green <= 145)
        & (blue <= 150)
        & ((red - green) >= 70)
        & ((red - blue) >= 55)
    )

    badges: list[Rect] = []
    for rect in _connected_components(mask, x_offset=left, y_offset=top):
        if not (7 <= rect.width <= 72 and 7 <= rect.height <= 72):
            continue
        aspect = rect.width / rect.height
        if not 0.55 <= aspect <= 1.75:
            continue
        area = rect.width * rect.height
        if area < 70:
            continue
        badges.append(rect)
    return badges


def _is_title_candidate(item: OCRItem, badge: Rect, width: int, height: int) -> bool:
    text = item.text.strip()
    if not text or _TIME_TEXT.fullmatch(text):
        return False
    # A real unread badge sits on the avatar's top-right edge, immediately to
    # the left of the title.  Vision can start the title only 2-3 px to the
    # right of the badge center.  Conversely, red fragments inside an avatar
    # are materially farther left and must not become click targets.
    title_gap = item.rect.x - badge.center.x
    if not (-2 <= title_gap <= 42 and item.rect.x < width * 0.46):
        return False
    delta_y = item.center.y - badge.center.y
    # WeChat renders an unread @-mention in red on the preview (second) line.
    # Its red glyphs look like a notification badge to the colour detector, so
    # keep the first-line title immediately above the marker as a candidate as
    # well.  The actual title is selected below; this wider range alone never
    # makes an OCR row actionable.
    return -max(60.0, height * 0.037) <= delta_y <= max(58.0, height * 0.045)


def _has_time_peer(item: OCRItem, items: list[OCRItem], *, width: int, height: int) -> bool:
    """Return whether *item* is on a conversation header row.

    The first line of every WeChat conversation row is paired with its time at
    the right edge.  Preview text has no such peer, which lets us distinguish
    a red ``@我`` preview from the real conversation title without fuzzy text
    matching.
    """
    tolerance = max(18.0, height * 0.014)
    return any(
        peer is not item
        and _TIME_TEXT.fullmatch(peer.text.strip())
        and item.rect.x < peer.rect.x < width * 0.46
        and abs(peer.center.y - item.center.y) <= tolerance
        for peer in items
    )


def _select_title(
    candidates: list[OCRItem],
    items: list[OCRItem],
    badge: Rect,
    *,
    width: int,
    height: int,
) -> OCRItem:
    # A timestamp aligned with the text is the strongest evidence that it is
    # the first-line conversation title rather than the second-line preview.
    header_candidates = [
        item for item in candidates if _has_time_peer(item, items, width=width, height=height)
    ]
    if header_candidates:
        return min(
            header_candidates,
            key=lambda item: (abs(item.center.y - badge.center.y), item.rect.x),
        )

    nearest = min(
        candidates,
        key=lambda item: (abs(item.center.y - badge.center.y), item.rect.x),
    )
    nearest_delta = nearest.center.y - badge.center.y
    # Vision occasionally misses the time.  If the nearest OCR text is on the
    # exact same line as the red marker, the marker is usually the red @-mention
    # inside a preview.  In that case the closest text line directly above it
    # is the conversation title.
    if abs(nearest_delta) <= 12.0:
        titles_above = [
            item
            for item in candidates
            if -max(60.0, height * 0.037) <= item.center.y - badge.center.y <= -20.0
        ]
        if titles_above:
            return max(titles_above, key=lambda item: (item.center.y, -item.rect.x))
    return nearest


def _preview_for(
    items: list[OCRItem], title: OCRItem, *, width: int, height: int
) -> str:
    candidates = [
        item
        for item in items
        if item is not title
        and title.rect.x - 8 <= item.rect.x < width * 0.46
        and title.rect.bottom <= item.center.y <= title.center.y + max(85.0, height * 0.075)
        and not _TIME_TEXT.fullmatch(item.text.strip())
    ]
    if not candidates:
        return ""
    return min(candidates, key=lambda item: (item.center.y, item.rect.x)).text.strip()


def locate_unread_conversations(
    image: Image.Image, items: list[OCRItem]
) -> list[UnreadConversation]:
    """Pair visual unread badges with exact visible conversation titles."""
    width, height = image.size
    conversations: list[UnreadConversation] = []
    for badge in locate_unread_badges(image):
        title_candidates = [
            item for item in items if _is_title_candidate(item, badge, width, height)
        ]
        if not title_candidates:
            # A sidebar notification dot or a red avatar fragment is not a
            # conversation and must never become a click target.
            continue
        title = _select_title(
            title_candidates,
            items,
            badge,
            width=width,
            height=height,
        )
        preview = _preview_for(items, title, width=width, height=height)
        conversations.append(
            UnreadConversation(
                title=title.text.strip(),
                preview=preview,
                title_rect=title.rect,
                badge_rect=badge,
            )
        )

    # A white digit can split a badge into multiple red components.  Deduping
    # by title geometry makes that harmless without collapsing two same-name
    # conversations on different rows.
    deduped: dict[tuple[str, int], UnreadConversation] = {}
    for conversation in conversations:
        row_key = (conversation.title, round(conversation.title_rect.center.y / 12))
        deduped.setdefault(row_key, conversation)
    return sorted(deduped.values(), key=lambda value: value.title_rect.center.y)
