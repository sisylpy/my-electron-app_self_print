from __future__ import annotations

from ..coordinates import Point
from ..state_detector import profile_context, profile_tag_matches
from ..vision import OCRItem, find_text


def locate_tag_row(items: list[OCRItem], existing_tag: str | None = None) -> Point:
    if existing_tag:
        matches = profile_tag_matches(items, existing_tag)
        if matches:
            return matches[0].center

    context = profile_context(items)
    if context and "标签" in context:
        label = context["标签"]
        return Point(label.rect.right + max(80.0, label.rect.width * 2.5), label.center.y)

    profile_title = find_text(items, "朋友资料", exact=True)
    remarks = find_text(items, "备注", exact=True)
    if profile_title and remarks:
        title = max(profile_title, key=lambda item: item.rect.x)
        remark = max(remarks, key=lambda item: item.rect.x)
        return Point(title.rect.x + 170.0, remark.center.y + remark.rect.height * 2.2)
    raise RuntimeError("无法定位朋友资料中的标签行")
