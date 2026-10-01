from __future__ import annotations

from ..coordinates import Point
from ..vision import OCRItem, find_text


def locate_save_button(items: list[OCRItem]) -> Point:
    matches = find_text(items, "完成", exact=True) + find_text(items, "保存", exact=True)
    if not matches:
        raise RuntimeError("标签编辑器中没有识别到“完成”或“保存”")
    # WeChat places the actionable button at the upper/right edge of the editor.
    return min(matches, key=lambda item: (item.rect.y, -item.rect.x)).center

