from __future__ import annotations

import sys
import unittest
from pathlib import Path


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.coordinates import Rect  # noqa: E402
from automation.flows.focus_conversation import (  # noqa: E402
    fallback_search_point,
    query_visible_in_search_field,
    search_box_candidates,
)
from automation.vision import OCRItem  # noqa: E402


def item(text: str, x: float, y: float, width: float = 90, height: float = 28) -> OCRItem:
    return OCRItem(text=text, confidence=0.99, rect=Rect(x, y, width, height))


class FocusConversationSearchTest(unittest.TestCase):
    def test_accepts_magnifier_prefix_from_vision_ocr(self) -> None:
        items = [
            item("Q搜索", 154, 42),
            item("搜索聊天记录", 720, 300, 150),
        ]

        candidates = search_box_candidates(items, image_width=1210, image_height=1628)

        self.assertEqual([candidate.text for candidate in candidates], ["Q搜索"])

    def test_fallback_stays_in_top_search_bar_not_first_conversation_row(self) -> None:
        point = fallback_search_point(1210, 1628)

        self.assertAlmostEqual(point.x, 217.8)
        self.assertAlmostEqual(point.y, 56.98)
        self.assertLess(point.y, 1628 * 0.075)

    def test_query_verification_rejects_chat_header_and_conversation_row(self) -> None:
        normal_chat_items = [
            item("金调料", 464, 35, 138, 42),
            item("金调料", 220, 133, 102, 32),
        ]

        self.assertFalse(
            query_visible_in_search_field(
                normal_chat_items,
                "金调料",
                image_width=1210,
                image_height=1628,
            )
        )

    def test_query_verification_accepts_text_inside_top_left_search_field(self) -> None:
        search_items = [item("Q金调料", 158, 43, 102, 31)]

        self.assertTrue(
            query_visible_in_search_field(
                search_items,
                "金调料",
                image_width=1210,
                image_height=1628,
            )
        )


if __name__ == "__main__":
    unittest.main()
