from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.accessibility_focus import (  # noqa: E402
    focus_conversation_with_accessibility,
    header_matches_target,
)


class AccessibilityFocusTest(unittest.TestCase):
    def test_exact_personal_chat(self) -> None:
        self.assertTrue(header_matches_target("Fangfang", "Fangfang"))

    def test_group_member_count_suffix(self) -> None:
        self.assertTrue(header_matches_target("调料群 (3)", "调料群"))
        self.assertTrue(header_matches_target("调料群(3)", "调料群"))

    def test_partial_or_wrong_title_is_rejected(self) -> None:
        self.assertFalse(header_matches_target("调料群测试(3)", "调料群"))
        self.assertFalse(header_matches_target("蔬菜群(3)", "调料群"))

    @patch("automation.accessibility_focus._osascript")
    def test_focus_uses_one_combined_accessibility_script(self, run_script) -> None:
        run_script.return_value = "OPENED\t调料群 (3)"

        result = focus_conversation_with_accessibility("调料群")

        self.assertTrue(result.matched)
        self.assertFalse(result.already_open)
        self.assertFalse(result.retried)
        self.assertEqual(result.header, "调料群 (3)")
        run_script.assert_called_once()
        self.assertEqual(run_script.call_args.args[-1], "调料群")
        script_lines = run_script.call_args.args[0]
        self.assertIn('return "OPENED_RETRY" & tab & retryHeader', script_lines)
        self.assertIn("set retryHeader to my searchAndRead(expectedTitle, 0.9, 1.0)", script_lines)

    @patch("automation.accessibility_focus._osascript")
    def test_focus_preserves_already_open_result(self, run_script) -> None:
        run_script.return_value = "ALREADY_OPEN\tFangfang"

        result = focus_conversation_with_accessibility("Fangfang")

        self.assertTrue(result.matched)
        self.assertTrue(result.already_open)
        self.assertFalse(result.retried)

    @patch("automation.accessibility_focus._osascript")
    def test_focus_reports_successful_retry(self, run_script) -> None:
        run_script.return_value = "OPENED_RETRY\tFangfang"

        result = focus_conversation_with_accessibility("Fangfang")

        self.assertTrue(result.matched)
        self.assertFalse(result.already_open)
        self.assertTrue(result.retried)


if __name__ == "__main__":
    unittest.main()
