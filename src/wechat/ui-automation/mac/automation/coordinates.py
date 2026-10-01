from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> Point:
        return Point(self.x + self.width / 2, self.y + self.height / 2)

    def contains(self, point: Point) -> bool:
        return self.x <= point.x <= self.right and self.y <= point.y <= self.bottom

    def inset(self, dx: float, dy: float) -> "Rect":
        return Rect(
            self.x + dx,
            self.y + dy,
            max(0.0, self.width - 2 * dx),
            max(0.0, self.height - 2 * dy),
        )


@dataclass(frozen=True)
class CoordinateTransformer:
    """Maps physical pixels in one screenshot to global logical Quartz points."""

    logical_region: Rect
    pixel_width: int
    pixel_height: int

    def __post_init__(self) -> None:
        if self.logical_region.width <= 0 or self.logical_region.height <= 0:
            raise ValueError("logical screenshot region must be non-empty")
        if self.pixel_width <= 0 or self.pixel_height <= 0:
            raise ValueError("physical screenshot dimensions must be positive")

    @property
    def scale_x(self) -> float:
        return self.pixel_width / self.logical_region.width

    @property
    def scale_y(self) -> float:
        return self.pixel_height / self.logical_region.height

    def physical_to_global_logical(self, point: Point) -> Point:
        return Point(
            self.logical_region.x + point.x / self.scale_x,
            self.logical_region.y + point.y / self.scale_y,
        )

    def physical_rect_to_global_logical(self, rect: Rect) -> Rect:
        origin = self.physical_to_global_logical(Point(rect.x, rect.y))
        return Rect(
            origin.x,
            origin.y,
            rect.width / self.scale_x,
            rect.height / self.scale_y,
        )

    def global_logical_to_physical(self, point: Point) -> Point:
        return Point(
            (point.x - self.logical_region.x) * self.scale_x,
            (point.y - self.logical_region.y) * self.scale_y,
        )

