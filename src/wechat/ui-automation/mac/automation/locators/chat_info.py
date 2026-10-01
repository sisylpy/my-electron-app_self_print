from __future__ import annotations

import numpy as np
from PIL import Image

from ..coordinates import Point


def locate_chat_info_button(image: Image.Image) -> Point:
    """Locate the three-dot header feature, then fall back to its normalized slot."""
    gray = np.asarray(image.convert("L"))
    y0, y1 = 0, max(1, int(image.height * 0.14))
    x0, x1 = int(image.width * 0.72), image.width
    crop = gray[y0:y1, x0:x1]
    dark = crop < 125
    candidates: list[tuple[float, Point]] = []
    for row in range(3, dark.shape[0] - 3):
        xs = np.flatnonzero(dark[row])
        if len(xs) < 3:
            continue
        for index in range(len(xs) - 2):
            a, b, c = (int(xs[index]), int(xs[index + 1]), int(xs[index + 2]))
            d1, d2 = b - a, c - b
            if 8 <= d1 <= 22 and 8 <= d2 <= 22 and abs(d1 - d2) <= 4:
                center = Point(x0 + b, y0 + row)
                normalized_target = Point(image.width * 0.957, image.height * 0.045)
                distance = abs(center.x - normalized_target.x) + abs(center.y - normalized_target.y)
                candidates.append((distance, center))
    if candidates:
        return min(candidates, key=lambda pair: pair[0])[1]
    return Point(image.width * 0.957, image.height * 0.045)

