from __future__ import annotations

import unittest
from unittest.mock import patch

from PIL import Image, ImageDraw

from automation.coordinates import CoordinateTransformer, Rect
from automation.accessibility_focus import visible_conversation_rows
from automation.flows.inspect_unread import matching_unread_conversations
from automation.locators.unread_conversation import (
    UnreadConversation,
    locate_unread_conversations,
    locate_unread_conversations_from_accessibility,
)
from automation.vision import OCRItem


def ocr(text: str, x: float, y: float, width: float, height: float) -> OCRItem:
    return OCRItem(text=text, confidence=1.0, rect=Rect(x, y, width, height))


class LocateUnreadConversationTests(unittest.TestCase):
    def test_accessibility_rows_keep_global_ax_coordinates(self) -> None:
        # WeChat 4.x already returns global AX row positions. Re-adding the
        # list origin moves the title to the wrong conversation and caused a
        # real unread 测试1群 badge to be attributed to the row above it.
        output = "示例联系人\t60\t77\t181\t65\n测试1群\t60\t142\t181\t65"
        with patch(
            "automation.accessibility_focus._osascript",
            return_value=output,
        ) as osascript:
            rows = visible_conversation_rows()

        script = "\n".join(osascript.call_args.args[0])
        self.assertNotIn("listPosition", script)
        self.assertEqual(rows[1], ("测试1群", Rect(60, 142, 181, 65)))

    def test_accessibility_rows_pair_only_avatar_corner_badges(self) -> None:
        image = Image.new("RGB", (1210, 1628), "white")
        draw = ImageDraw.Draw(image)
        # A real unread badge is at the avatar's top-right corner. A similarly
        # red avatar fragment lower and farther left must never open that chat.
        draw.rectangle((207, 123, 224, 140), fill=(235, 65, 70))
        draw.rectangle((190, 315, 198, 323), fill=(235, 65, 70))
        transform = CoordinateTransformer(Rect(0, 25, 605, 814), 1210, 1628)
        rows = [
            ("调料群", Rect(60, 89, 181, 65)),
            ("蔬菜群", Rect(60, 154, 181, 65)),
        ]

        conversations = locate_unread_conversations_from_accessibility(
            image,
            transform,
            rows,
        )

        self.assertEqual([item.title for item in conversations], ["调料群"])

    def test_summary_keeps_only_unique_bound_unread_titles(self) -> None:
        conversations = [
            UnreadConversation("调料群", "订单一", Rect(20, 90, 80, 24), Rect(10, 90, 12, 12)),
            UnreadConversation("未绑定群", "消息", Rect(20, 150, 80, 24), Rect(10, 150, 12, 12)),
            UnreadConversation("调料群", "订单二", Rect(20, 210, 80, 24), Rect(10, 210, 12, 12)),
            UnreadConversation("蔬菜群", "订单", Rect(20, 270, 80, 24), Rect(10, 270, 12, 12)),
        ]

        matched = matching_unread_conversations(conversations, {"调料群", "蔬菜群"})

        self.assertEqual([item.title for item in matched], ["调料群", "蔬菜群"])

    def test_red_mention_preview_resolves_to_first_line_group_title(self) -> None:
        image = Image.new("RGB", (1210, 1628), "white")
        draw = ImageDraw.Draw(image)
        # These rectangles reproduce the relevant geometry from the 16:19
        # production diagnostic: one real unread badge plus red @-mention
        # fragments on the preview line.
        draw.rectangle((199, 375, 230, 406), fill=(235, 65, 70))
        draw.rectangle((189, 445, 198, 452), fill=(235, 65, 70))
        draw.rectangle((190, 575, 198, 583), fill=(235, 65, 70))

        items = [
            ocr("调料群", 228, 393, 95, 32),
            ocr("16:10", 396, 396, 63, 22),
            ocr("【有人@我】金调料…", 224, 435, 224, 32),
            ocr("蔬菜群", 224, 523, 102, 32),
            ocr("16:10", 396, 526, 63, 22),
            ocr("金调料：@李沛谊…", 228, 565, 217, 28),
        ]

        conversations = locate_unread_conversations(image, items)

        self.assertEqual([item.title for item in conversations], ["调料群", "蔬菜群"])
        self.assertEqual(conversations[0].preview, "【有人@我】金调料…")
        self.assertEqual(conversations[1].preview, "金调料：@李沛谊…")

    def test_preview_marker_falls_back_to_title_when_time_ocr_is_missing(self) -> None:
        image = Image.new("RGB", (1210, 1628), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((190, 575, 198, 583), fill=(235, 65, 70))
        items = [
            ocr("蔬菜群", 224, 523, 102, 32),
            ocr("金调料：@李沛谊…", 228, 565, 217, 28),
        ]

        conversations = locate_unread_conversations(image, items)

        self.assertEqual([item.title for item in conversations], ["蔬菜群"])


if __name__ == "__main__":
    unittest.main()
