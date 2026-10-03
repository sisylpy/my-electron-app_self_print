from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


MAC_ROOT = Path(__file__).resolve().parents[1]
if str(MAC_ROOT) not in sys.path:
    sys.path.insert(0, str(MAC_ROOT))

from automation.mouse import set_clipboard  # noqa: E402


class MouseClipboardTest(unittest.TestCase):
    @patch("automation.mouse.subprocess.run")
    def test_unicode_text_is_passed_as_an_osascript_argument(self, run) -> None:
        set_clipboard("金调料")

        command = run.call_args.args[0]
        self.assertEqual(command[0], "osascript")
        self.assertEqual(command[-2:], ["--", "金调料"])
        self.assertNotIn("金调料", " ".join(command[:-1]))
        run.assert_called_once_with(
            command,
            check=True,
            capture_output=True,
            text=True,
        )


if __name__ == "__main__":
    unittest.main()
