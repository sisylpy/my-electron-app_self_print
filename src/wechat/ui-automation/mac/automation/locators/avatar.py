from __future__ import annotations

from dataclasses import dataclass

from PIL import Image

from ..coordinates import Rect
from ..vision import saturated_components


@dataclass(frozen=True)
class AvatarCandidate:
    rect: Rect
    score: float


def locate_avatar_candidates(image: Image.Image, scale: float) -> list[AvatarCandidate]:
    region = Rect(image.width * 0.64, image.height * 0.075, image.width * 0.35, image.height * 0.22)
    components = saturated_components(image, region, min_chroma=32, dilation=max(2, round(scale * 2)))
    candidates: list[AvatarCandidate] = []
    min_side = 22 * scale
    max_side = 86 * scale
    for rect in components:
        short = min(rect.width, rect.height)
        long = max(rect.width, rect.height)
        aspect = long / max(short, 1)
        if short < min_side or long > max_side or aspect > 1.35:
            continue
        area = rect.width * rect.height
        if area > (90 * scale) ** 2:
            continue
        square_score = max(0.0, 1.0 - abs(rect.width - rect.height) / max(rect.width, rect.height))
        size_target = 48 * scale
        size_score = max(0.0, 1.0 - abs(long - size_target) / size_target)
        top_score = max(0.0, 1.0 - rect.y / (image.height * 0.35))
        score = square_score * 3 + size_score * 2 + top_score
        candidates.append(AvatarCandidate(rect, score))
    return sorted(candidates, key=lambda candidate: (-candidate.score, candidate.rect.x))

