from __future__ import annotations

import sys
import unittest
from pathlib import Path


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.accessibility_focus import header_matches_target  # noqa: E402


class AccessibilityFocusTest(unittest.TestCase):
    def test_exact_personal_chat(self) -> None:
        self.assertTrue(header_matches_target("Fangfang", "Fangfang"))

    def test_group_member_count_suffix(self) -> None:
        self.assertTrue(header_matches_target("调料群 (3)", "调料群"))
        self.assertTrue(header_matches_target("调料群(3)", "调料群"))

    def test_partial_or_wrong_title_is_rejected(self) -> None:
        self.assertFalse(header_matches_target("调料群测试(3)", "调料群"))
        self.assertFalse(header_matches_target("蔬菜群(3)", "调料群"))


if __name__ == "__main__":
    unittest.main()
