from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageGrab

from .coordinates import CoordinateTransformer, Rect


@dataclass(frozen=True)
class Screenshot:
    path: Path
    image: Image.Image
    transform: CoordinateTransformer


def _format_number(value: float) -> str:
    rounded = round(value)
    return str(rounded) if abs(value - rounded) < 1e-6 else f"{value:.3f}"


def capture_region(region: Rect, output: Path | None = None) -> Screenshot:
    if output is None:
        handle = tempfile.NamedTemporaryFile(prefix="jcyx-wechat-", suffix=".png", delete=False)
        handle.close()
        output = Path(handle.name)
    output.parent.mkdir(parents=True, exist_ok=True)
    rect_arg = ",".join(
        _format_number(value)
        for value in (region.x, region.y, region.width, region.height)
    )
    subprocess.run(
        ["screencapture", "-x", f"-R{rect_arg}", str(output)],
        check=True,
        capture_output=True,
    )
    image = Image.open(output).convert("RGB")
    transform = CoordinateTransformer(region, image.width, image.height)
    return Screenshot(output, image, transform)


def capture_window(window_bounds: Rect, output: Path | None = None) -> Screenshot:
    return capture_region(window_bounds, output)


def capture_window_fast(window_bounds: Rect, output: Path | None = None) -> Screenshot:
    """Capture one window-sized region without spawning ``screencapture``.

    The unread detector only needs badge pixels, not Retina-resolution OCR.
    Pillow's native grab avoids the multi-second command startup while keeping
    the same logical coordinate system used by macOS accessibility.
    """

    if output is None:
        handle = tempfile.NamedTemporaryFile(
            prefix="jcyx-wechat-fast-", suffix=".png", delete=False
        )
        handle.close()
        output = Path(handle.name)
    output.parent.mkdir(parents=True, exist_ok=True)
    left = round(window_bounds.x)
    top = round(window_bounds.y)
    right = round(window_bounds.right)
    bottom = round(window_bounds.bottom)
    image = ImageGrab.grab(bbox=(left, top, right, bottom)).convert("RGB")
    image.save(output)
    transform = CoordinateTransformer(window_bounds, image.width, image.height)
    return Screenshot(output, image, transform)


def main_display_bounds() -> Rect:
    script = 'tell application "Finder" to get bounds of window of desktop'
    result = subprocess.run(
        ["osascript", "-e", script], check=True, capture_output=True, text=True
    ).stdout.strip()
    values = [float(value.strip()) for value in result.split(",")]
    if len(values) != 4:
        raise RuntimeError(f"无法解析主显示器 bounds: {result!r}")
    left, top, right, bottom = values
    return Rect(left, top, right - left, bottom - top)


def capture_main_display(output: Path | None = None) -> Screenshot:
    return capture_region(main_display_bounds(), output)

