import hashlib
import os
import tempfile
import unittest

from product.attachments import (
    build_image_envelope,
    extract_media_md5,
    locate_image_dat,
    locate_image_dat_variants,
)


class ImageAttachmentTest(unittest.TestCase):
    def test_extracts_media_md5_from_packed_info(self):
        media_md5 = "0123456789abcdef0123456789abcdef"
        packed = bytes.fromhex("0801") + bytes.fromhex("12220a20") + media_md5.encode("ascii")
        self.assertEqual(extract_media_md5(packed.hex()), media_md5)

    def test_locates_original_before_preview_variants(self):
        conversation = "wxid_customer"
        media_md5 = "fedcba9876543210fedcba9876543210"
        with tempfile.TemporaryDirectory() as account_root:
            db_root = os.path.join(account_root, "db_storage")
            image_dir = os.path.join(
                account_root,
                "msg",
                "attach",
                hashlib.md5(conversation.encode("utf-8")).hexdigest(),
                "2026-10",
                "Img",
            )
            os.makedirs(image_dir)
            original = os.path.join(image_dir, media_md5 + ".dat")
            preview = os.path.join(image_dir, media_md5 + "_t.dat")
            with open(preview, "wb") as handle:
                handle.write(b"preview")
            with open(original, "wb") as handle:
                handle.write(b"original")
            self.assertEqual(locate_image_dat(db_root, conversation, media_md5), original)
            self.assertEqual(locate_image_dat_variants(db_root, conversation, media_md5), [original, preview])

    def test_prefers_high_quality_variant_before_original(self):
        conversation = "wxid_customer"
        media_md5 = "abcdef0123456789abcdef0123456789"
        with tempfile.TemporaryDirectory() as account_root:
            db_root = os.path.join(account_root, "db_storage")
            image_dir = os.path.join(
                account_root,
                "msg",
                "attach",
                hashlib.md5(conversation.encode("utf-8")).hexdigest(),
                "2026-10",
                "Img",
            )
            os.makedirs(image_dir)
            original = os.path.join(image_dir, media_md5 + ".dat")
            high = os.path.join(image_dir, media_md5 + "_h.dat")
            with open(original, "wb") as handle:
                handle.write(b"original")
            with open(high, "wb") as handle:
                handle.write(b"high")
            self.assertEqual(locate_image_dat_variants(db_root, conversation, media_md5), [high, original])

    def test_envelope_keeps_original_and_thumbnail_for_decoder_fallback(self):
        conversation = "wxid_customer"
        media_md5 = "1234567890abcdef1234567890abcdef"
        packed = bytes.fromhex("12220a20") + media_md5.encode("ascii")
        with tempfile.TemporaryDirectory() as account_root:
            db_root = os.path.join(account_root, "db_storage")
            image_dir = os.path.join(
                account_root,
                "msg",
                "attach",
                hashlib.md5(conversation.encode("utf-8")).hexdigest(),
                "2026-10",
                "Img",
            )
            os.makedirs(image_dir)
            for suffix, payload in (("", b"original"), ("_t", b"thumbnail")):
                with open(os.path.join(image_dir, media_md5 + suffix + ".dat"), "wb") as handle:
                    handle.write(payload)

            envelope = build_image_envelope(db_root, "wxid_account", conversation, packed.hex())
            self.assertEqual(
                [variant["kind"] for variant in envelope["encryptedVariants"]],
                ["original", "thumbnail"],
            )
            self.assertNotIn("encryptedBase64", envelope)


if __name__ == "__main__":
    unittest.main()
