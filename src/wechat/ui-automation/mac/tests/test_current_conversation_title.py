from __future__ import annotations

import sys
import unittest
from pathlib import Path


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.coordinates import Rect  # noqa: E402
from automation.state_detector import current_conversation_title  # noqa: E402
from automation.vision import OCRItem  # noqa: E402


def item(text: str, x: float, y: float, width: float = 80) -> OCRItem:
    return OCRItem(text=text, confidence=0.99, rect=Rect(x, y, width, 24))


class CurrentConversationTitleTest(unittest.TestCase):
    def test_reads_visible_header_without_customer_whitelist(self) -> None:
        items = [
            item("搜索", 40, 20),
            item("金调料", 130, 86),
            item("14:14", 395, 137, 70),
            item("Fangfang", 483, 42, 158),
            item("星期三 08:31", 760, 133, 154),
        ]

        self.assertEqual(
            current_conversation_title(items, image_width=1200, image_height=1650),
            "Fangfang",
        )

    def test_removes_group_count_and_vision_prefix_artifact(self) -> None:
        items = [item("① 测试 (3)", 365, 21, 130)]

        self.assertEqual(
            current_conversation_title(items, image_width=900, image_height=700),
            "测试",
        )

    def test_returns_empty_when_header_is_not_visible(self) -> None:
        items = [
            item("搜索", 157, 42),
            item("金调料", 228, 86),
            item("14:14", 395, 72, 70),
            item("星期三 08:31", 760, 75, 154),
        ]

        self.assertEqual(
            current_conversation_title(items, image_width=1200, image_height=1650),
            "",
        )


if __name__ == "__main__":
    unittest.main()
