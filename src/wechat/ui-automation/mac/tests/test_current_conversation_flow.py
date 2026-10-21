from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.flows.current_conversation import CurrentConversationFlow  # noqa: E402
from automation.results import ResultCode  # noqa: E402


class CurrentConversationFlowTest(unittest.TestCase):
    def test_background_accessibility_read_does_not_raise_wechat(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            flow = CurrentConversationFlow(artifact_root=Path(temp_dir))
            with (
                patch(
                    "automation.flows.current_conversation.current_conversation_header",
                    return_value="测试7群",
                ) as background_read,
                patch(
                    "automation.flows.current_conversation.raise_and_current_conversation_header",
                ) as combined_read,
                patch.object(flow, "_raise_wechat") as raise_wechat,
            ):
                result = flow.run()

        self.assertEqual(result.code, ResultCode.SUCCESS)
        self.assertEqual(flow.conversation_title, "测试7群")
        background_read.assert_called_once()
        combined_read.assert_not_called()
        raise_wechat.assert_not_called()

    def test_combined_failure_uses_fresh_legacy_accessibility_read(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            flow = CurrentConversationFlow(artifact_root=Path(temp_dir))
            with (
                patch(
                    "automation.flows.current_conversation.current_conversation_header",
                    side_effect=[RuntimeError("background AX failure"), "Fangfang"],
                ) as live_reads,
                patch(
                    "automation.flows.current_conversation.raise_and_current_conversation_header",
                    side_effect=RuntimeError("combined AX failure"),
                ),
                patch.object(flow, "_raise_wechat") as raise_wechat,
            ):
                result = flow.run()

        self.assertEqual(result.code, ResultCode.SUCCESS)
        self.assertEqual(flow.conversation_title, "Fangfang")
        raise_wechat.assert_called_once()
        self.assertEqual(live_reads.call_count, 2)
        self.assertTrue(
            any(
                detail.startswith("COMBINED_ACCESSIBILITY_FALLBACK:")
                for detail in result.details
            )
        )


if __name__ == "__main__":
    unittest.main()
