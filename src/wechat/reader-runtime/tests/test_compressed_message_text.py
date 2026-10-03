import unittest

import zstandard

from product.providers.common import _decode_message_content


class CompressedMessageTextTest(unittest.TestCase):
    def test_decodes_plain_utf8_hex(self):
        text = "土豆8斤\n白菜2斤"
        self.assertEqual(_decode_message_content(text.encode("utf-8").hex()), text)

    def test_decompresses_zstandard_group_order(self):
        text = "wxid_member:\n@李沛谊\u2005中葱五斤\n小黄瓜一斤"
        compressed = zstandard.ZstdCompressor().compress(text.encode("utf-8"))
        self.assertEqual(_decode_message_content(compressed.hex()), text)

    def test_preserves_already_decoded_test_provider_text(self):
        self.assertEqual(_decode_message_content("土豆8斤"), "土豆8斤")

    def test_rejects_corrupt_zstandard_frame_without_garbage(self):
        self.assertEqual(_decode_message_content((b"\x28\xb5\x2f\xfdinvalid").hex()), "")


if __name__ == "__main__":
    unittest.main()
