from datetime import datetime, timezone
import unittest

from product.providers.common import _iso_to_epoch


class IsoTimeRangeTests(unittest.TestCase):
    def test_accepts_javascript_utc_iso_timestamp(self):
        expected = int(datetime(2026, 10, 1, 9, 49, 21, tzinfo=timezone.utc).timestamp())
        self.assertEqual(_iso_to_epoch("2026-10-01T09:49:21.000Z"), expected)

    def test_preserves_explicit_offset(self):
        expected = int(datetime(2026, 10, 1, 9, 49, 21, tzinfo=timezone.utc).timestamp())
        self.assertEqual(_iso_to_epoch("2026-10-01T17:49:21+08:00"), expected)


if __name__ == "__main__":
    unittest.main()
