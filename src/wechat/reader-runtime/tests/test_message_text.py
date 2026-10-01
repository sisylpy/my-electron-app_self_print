import unittest

from product.WechatLocalDataService import _visible_message_text


class VisibleMessageTextTest(unittest.TestCase):
    def test_strips_exact_group_sender_envelope(self):
        self.assertEqual(
            _visible_message_text(
                "wxid_member_123:\n@当前账号\u2005白醋一箱",
                "group",
                "wxid_member_123",
            ),
            "@当前账号\u2005白醋一箱",
        )

    def test_supports_crlf_group_sender_envelope(self):
        self.assertEqual(
            _visible_message_text(
                "wxid_member_123:\r\n土豆20斤",
                "group",
                "wxid_member_123",
            ),
            "土豆20斤",
        )

    def test_does_not_strip_direct_message_or_unrelated_prefix(self):
        self.assertEqual(
            _visible_message_text("wxid_member_123:\n白醋一箱", "direct", "wxid_member_123"),
            "wxid_member_123:\n白醋一箱",
        )
        self.assertEqual(
            _visible_message_text("规格:\n白醋一箱", "group", "wxid_member_123"),
            "规格:\n白醋一箱",
        )


if __name__ == "__main__":
    unittest.main()
