from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .coordinates import Point, Rect


@dataclass(frozen=True)
class OCRItem:
    text: str
    confidence: float
    rect: Rect

    @property
    def center(self) -> Point:
        return self.rect.center


_VISION_JXA = r'''
ObjC.import("Foundation")
ObjC.import("Vision")
function run(argv) {
  var url = $.NSURL.fileURLWithPath($(argv[0]));
  var req = $.VNRecognizeTextRequest.alloc.init;
  req.recognitionLevel = $.VNRequestTextRecognitionLevelAccurate;
  req.recognitionLanguages = $(["zh-Hans", "en-US"]);
  req.usesLanguageCorrection = true;
  var handler = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $.NSDictionary.dictionary);
  var err = Ref();
  if (!handler.performRequestsError($.NSArray.arrayWithObject(req), err)) {
    throw new Error("Vision OCR failed");
  }
  var output = [];
  var results = req.results;
  for (var i = 0; i < results.count; i++) {
    var observation = results.objectAtIndex(i);
    var candidate = observation.topCandidates(1).firstObject;
    if (!candidate) continue;
    var box = observation.boundingBox;
    output.push({
      text: ObjC.unwrap(candidate.string),
      confidence: candidate.confidence,
      x: box.origin.x,
      y: box.origin.y,
      w: box.size.width,
      h: box.size.height
    });
  }
  return JSON.stringify(output);
}
'''


def recognize_text(path: Path, image_size: tuple[int, int]) -> list[OCRItem]:
    result = subprocess.run(
        ["osascript", "-l", "JavaScript", "-e", _VISION_JXA, str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    raw = json.loads(result.stdout)
    width, height = image_size
    items: list[OCRItem] = []
    for value in raw:
        # Vision coordinates use a bottom-left normalized origin.
        rect = Rect(
            float(value["x"]) * width,
            (1.0 - float(value["y"]) - float(value["h"])) * height,
            float(value["w"]) * width,
            float(value["h"]) * height,
        )
        items.append(OCRItem(str(value["text"]), float(value["confidence"]), rect))
    return items


def save_ocr(items: list[OCRItem], path: Path) -> None:
    payload = [
        {
            "text": item.text,
            "confidence": item.confidence,
            "rect": {
                "x": item.rect.x,
                "y": item.rect.y,
                "width": item.rect.width,
                "height": item.rect.height,
            },
        }
        for item in items
    ]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def find_text(
    items: list[OCRItem], needle: str, *, exact: bool = False
) -> list[OCRItem]:
    normalized = needle.casefold()
    if exact:
        return [item for item in items if item.text.strip().casefold() == normalized]
    return [item for item in items if normalized in item.text.casefold()]


def _dilate(mask: np.ndarray, iterations: int) -> np.ndarray:
    value = mask
    for _ in range(iterations):
        padded = np.pad(value, 1, mode="constant")
        value = np.logical_or.reduce(
            [padded[dy : dy + mask.shape[0], dx : dx + mask.shape[1]] for dy in range(3) for dx in range(3)]
        )
    return value


def saturated_components(
    image: Image.Image,
    region: Rect,
    *,
    min_chroma: int = 38,
    dilation: int = 4,
    min_area: int = 60,
) -> list[Rect]:
    left = max(0, int(region.x))
    top = max(0, int(region.y))
    right = min(image.width, int(region.right))
    bottom = min(image.height, int(region.bottom))
    data = np.asarray(image.crop((left, top, right, bottom)).convert("RGB"), dtype=np.int16)
    chroma = data.max(axis=2) - data.min(axis=2)
    brightness = data.max(axis=2)
    mask = (chroma >= min_chroma) & (brightness >= 65) & (brightness <= 252)
    mask = _dilate(mask, dilation)
    visited = np.zeros(mask.shape, dtype=bool)
    components: list[Rect] = []
    height, width = mask.shape
    for y, x in zip(*np.nonzero(mask & ~visited)):
        if visited[y, x]:
            continue
        stack = [(int(x), int(y))]
        visited[y, x] = True
        xs: list[int] = []
        ys: list[int] = []
        while stack:
            cx, cy = stack.pop()
            xs.append(cx)
            ys.append(cy)
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    stack.append((nx, ny))
        if len(xs) < min_area:
            continue
        components.append(
            Rect(left + min(xs), top + min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)
        )
    return components
