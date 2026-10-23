from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.accessibility_focus import (  # noqa: E402
    _parse_visible_conversation_rows,
    activate_and_current_conversation_context,
    focus_conversation_with_accessibility,
    header_matches_target,
    raise_and_current_conversation_header,
)
from automation.coordinates import Rect  # noqa: E402


class AccessibilityFocusTest(unittest.TestCase):
    @patch("automation.accessibility_focus._osascript")
    def test_activate_context_combines_window_and_header_read(self, run_script) -> None:
        run_script.return_value = "测试7群 (3)\t0\t25\t605\t814"

        context = activate_and_current_conversation_context()

        self.assertEqual(context.header, "测试7群")
        self.assertEqual(context.bounds, Rect(0, 25, 605, 814))
        run_script.assert_called_once()
        script_lines = run_script.call_args.args[0]
        self.assertIn('tell application "WeChat" to reopen', script_lines)
        self.assertIn('perform action "AXRaise" of mainWindow', script_lines)

    def test_visible_row_parser_keeps_exact_title_and_geometry(self) -> None:
        rows = _parse_visible_conversation_rows(
            "测试7群\t60\t89\t181\t65\nFangfang\t60\t154\t181\t65\n"
        )

        self.assertEqual(
            rows,
            [
                ("测试7群", Rect(60, 89, 181, 65)),
                ("Fangfang", Rect(60, 154, 181, 65)),
            ],
        )

    def test_exact_personal_chat(self) -> None:
        self.assertTrue(header_matches_target("Fangfang", "Fangfang"))

    def test_group_member_count_suffix(self) -> None:
        self.assertTrue(header_matches_target("调料群 (3)", "调料群"))
        self.assertTrue(header_matches_target("调料群(3)", "调料群"))

    def test_partial_or_wrong_title_is_rejected(self) -> None:
        self.assertFalse(header_matches_target("调料群测试(3)", "调料群"))
        self.assertFalse(header_matches_target("蔬菜群(3)", "调料群"))

    @patch("automation.accessibility_focus._osascript")
    def test_raise_and_read_title_uses_one_live_accessibility_call(
        self, run_script
    ) -> None:
        run_script.return_value = "测试7群 (3)"

        title = raise_and_current_conversation_header()

        self.assertEqual(title, "测试7群")
        run_script.assert_called_once()
        script_lines = run_script.call_args.args[0]
        self.assertIn('tell application "WeChat" to activate', script_lines)
        self.assertIn('perform action "AXRaise" of window "微信"', script_lines)
        self.assertIn("return name of chatHeader as text", script_lines)

    @patch("automation.accessibility_focus._osascript")
    def test_focus_uses_one_combined_accessibility_script(self, run_script) -> None:
        run_script.return_value = "OPENED\t调料群 (3)"

        result = focus_conversation_with_accessibility("调料群")

        self.assertTrue(result.matched)
        self.assertFalse(result.already_open)
        self.assertFalse(result.retried)
        self.assertEqual(result.header, "调料群 (3)")
        run_script.assert_called_once()
        self.assertEqual(run_script.call_args.args[-2:], ("调料群", "0"))
        script_lines = run_script.call_args.args[0]
        self.assertIn('keystroke "f" using command down', script_lines)
        self.assertNotIn("set currentHeader to my readHeader()", script_lines)
        self.assertNotIn("set searchField to UI element 2", script_lines)
        self.assertIn('return "OPENED_RETRY" & tab & retryHeader', script_lines)
        self.assertIn("set retryHeader to my searchAndRead(expectedTitle, 0.9, 1.0)", script_lines)

    @patch("automation.accessibility_focus._osascript")
    def test_parser_preserves_legacy_already_open_result(self, run_script) -> None:
        run_script.return_value = "ALREADY_OPEN\tFangfang"

        result = focus_conversation_with_accessibility("Fangfang")

        self.assertTrue(result.matched)
        self.assertTrue(result.already_open)
        self.assertFalse(result.retried)

    @patch("automation.accessibility_focus._osascript")
    def test_force_search_keeps_compatible_request_shape(self, run_script) -> None:
        run_script.return_value = "OPENED\tFangfang"

        result = focus_conversation_with_accessibility("Fangfang", force_search=True)

        self.assertTrue(result.matched)
        self.assertFalse(result.already_open)
        self.assertEqual(run_script.call_args.args[-2:], ("Fangfang", "1"))
        script_lines = run_script.call_args.args[0]
        self.assertNotIn("set currentHeader to my readHeader()", script_lines)

    @patch("automation.accessibility_focus._osascript")
    def test_focus_reports_successful_retry(self, run_script) -> None:
        run_script.return_value = "OPENED_RETRY\tFangfang"

        result = focus_conversation_with_accessibility("Fangfang")

        self.assertTrue(result.matched)
        self.assertFalse(result.already_open)
        self.assertTrue(result.retried)


if __name__ == "__main__":
    unittest.main()
