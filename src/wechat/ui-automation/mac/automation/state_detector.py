from __future__ import annotations

import re
from dataclasses import dataclass

from .vision import OCRItem, find_text


@dataclass(frozen=True)
class StateResult:
    matched: bool
    evidence: tuple[str, ...]


def _aligned_below(title: OCRItem, item: OCRItem) -> bool:
    max_x_delta = max(150.0, title.rect.height * 4.0)
    max_y_delta = max(520.0, title.rect.height * 14.0)
    return (
        abs(item.rect.x - title.rect.x) <= max_x_delta
        and item.center.y > title.center.y
        and item.center.y - title.center.y <= max_y_delta
    )


def profile_context(items: list[OCRItem], *, minimum_anchors: int = 4) -> dict[str, OCRItem] | None:
    """Return one geometrically coherent profile column, never global keyword hits."""
    titles = find_text(items, "朋友资料", exact=True)
    names = ("备注", "标签", "朋友圈", "更多信息")
    best: dict[str, OCRItem] | None = None
    for title in titles:
        context: dict[str, OCRItem] = {"朋友资料": title}
        for name in names:
            aligned = [item for item in find_text(items, name, exact=True) if _aligned_below(title, item)]
            if aligned:
                context[name] = min(aligned, key=lambda item: item.center.y)
        if best is None or len(context) > len(best):
            best = context
    if best is None or len(best) - 1 < minimum_anchors:
        return None
    ordered = [best[name].center.y for name in names if name in best]
    if ordered != sorted(ordered):
        return None
    return best


def profile_tag_matches(items: list[OCRItem], text: str) -> list[OCRItem]:
    if text not in extract_profile_tags(items):
        return []
    return [item for item in profile_tag_value_items(items) if text in item.text]


def profile_tag_value_items(items: list[OCRItem]) -> list[OCRItem]:
    context = profile_context(items)
    if not context or "标签" not in context:
        return []
    label = context["标签"]
    matches: list[OCRItem] = []
    for item in items:
        same_row = abs(item.center.y - label.center.y) <= max(34.0, label.rect.height * 1.35)
        to_right = label.rect.right < item.center.x < label.rect.right + max(560.0, label.rect.height * 15)
        if same_row and to_right:
            matches.append(item)
    return matches


def extract_profile_tags(items: list[OCRItem]) -> set[str]:
    tags: set[str] = set()
    value_items = sorted(profile_tag_value_items(items), key=lambda item: (item.rect.y, item.rect.x))
    # WeChat wraps a long tag value without repeating the row label. Vision may
    # return one wrapped tag name as two observations, so rebuild the visual
    # row before splitting its comma-separated values.
    combined = "".join(item.text.strip() for item in value_items)
    for value in re.split(r"[,，、;；]+", combined):
        normalized = value.strip()
        if normalized:
            tags.add(normalized)
    return tags


def profile_tag_visible(items: list[OCRItem], text: str) -> StateResult:
    tags = extract_profile_tags(items)
    return StateResult(text in tags, tuple(sorted(tags)))


def editor_scoped_text(items: list[OCRItem], needle: str, *, exact: bool = False) -> list[OCRItem]:
    context = profile_context(items, minimum_anchors=2)
    if not context or "标签" not in context:
        return []
    title = context["朋友资料"]
    label = context["标签"]
    output: list[OCRItem] = []
    for item in find_text(items, needle, exact=exact):
        in_x = title.rect.x - 40 <= item.center.x <= title.rect.x + 620
        in_y = label.center.y < item.center.y <= label.center.y + 520
        if in_x and in_y:
            output.append(item)
    return output


def chat_info_panel(items: list[OCRItem]) -> StateResult:
    anchors = ("查找聊天内容", "消息免打扰", "置顶聊天")
    found = tuple(anchor for anchor in anchors if find_text(items, anchor))
    return StateResult(len(found) >= 2, found)


def exact_chat_header(
    items: list[OCRItem], target: str, *, image_width: int, image_height: int
) -> StateResult:
    matches = [
        item
        for item in find_text(items, target, exact=True)
        if item.rect.y < image_height * 0.13 and item.rect.x > image_width * 0.45
    ]
    return StateResult(bool(matches), tuple(item.text for item in matches))


def conversation_header(
    items: list[OCRItem], target: str, *, image_width: int, image_height: int
) -> StateResult:
    """Match a conversation title, allowing WeChat's group member suffix.

    The conversation list displays ``测试`` while the opened group header may
    display ``测试 (3)``.  Only that trailing numeric suffix is ignored; no
    substring or fuzzy matching is performed.  WeChat's conversation column
    keeps an almost fixed pixel width while the whole window is resized, so a
    pure percentage boundary wrongly rejects the header in a narrow docked
    window.  Cap the boundary at 320 physical pixels to keep list rows out
    while still accepting the real chat header.
    """
    target_value = target.strip().casefold()
    header_min_x = min(image_width * 0.45, 320.0)
    matched: list[str] = []
    for item in items:
        if not (item.rect.y < image_height * 0.14 and item.rect.x > header_min_x):
            continue
        raw = item.text.strip()
        normalized = re.sub(r"\s*[（(]\d+[）)]\s*$", "", raw).strip()
        # Vision occasionally combines WeChat's small leading header glyph
        # with the title and recognizes it as a circled digit. Keep the exact
        # raw match first, then discard only that known one-character artifact.
        normalized = re.sub(r"^[\u2460-\u2473\u24ea]\s*", "", normalized).casefold()
        if raw.casefold() == target_value or normalized == target_value:
            matched.append(raw)
    return StateResult(bool(matched), tuple(matched))


def current_conversation_title(
    items: list[OCRItem], *, image_width: int, image_height: int
) -> str:
    """Return the visible chat title without needing a customer-name whitelist.

    The opened conversation header is the left-most OCR text in WeChat's
    right-hand header area. Conversation-list rows stay left of ``header_min_x``;
    call and menu icons normally produce no alphanumeric OCR text. Group member
    counts and Vision's occasional leading circled-number artifact are removed
    so the returned value matches the name shown in the conversation list.
    """
    header_min_x = min(image_width * 0.45, 320.0)
    header_max_y = min(image_height * 0.075, 120.0)
    timestamp = re.compile(
        r"^(?:(?:今天|昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天])\s*)?"
        r"(?:(?:上午|下午)\s*)?\d{1,2}:\d{2}$"
    )
    candidates: list[OCRItem] = []
    for item in items:
        raw = item.text.strip()
        if not raw or item.rect.y >= header_max_y or item.rect.x <= header_min_x:
            continue
        if timestamp.fullmatch(raw):
            continue
        if not any(character.isalnum() or "\u4e00" <= character <= "\u9fff" for character in raw):
            continue
        candidates.append(item)
    if not candidates:
        return ""
    raw = min(candidates, key=lambda item: (item.rect.y, item.rect.x)).text.strip()
    normalized = re.sub(r"\s*[（(]\d+[）)]\s*$", "", raw).strip()
    return re.sub(r"^[\u2460-\u2473\u24ea]\s*", "", normalized).strip()


def profile(items: list[OCRItem]) -> StateResult:
    context = profile_context(items)
    evidence = tuple(context.keys()) if context else ()
    return StateResult(context is not None, evidence)


def tag_editor(items: list[OCRItem]) -> StateResult:
    search_words = tuple(
        word
        for word in ("搜索或创建标签", "创建新标签")
        if editor_scoped_text(items, word)
    )
    return StateResult(bool(search_words), search_words)


def text_visible(items: list[OCRItem], text: str) -> StateResult:
    matches = find_text(items, text, exact=False)
    return StateResult(bool(matches), tuple(item.text for item in matches))
