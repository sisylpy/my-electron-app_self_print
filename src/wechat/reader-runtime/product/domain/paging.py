from dataclasses import dataclass
from typing import Generic, List, Optional, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class Page:
    offset: int = 0
    limit: int = 50


@dataclass(frozen=True)
class PageResult(Generic[T]):
    items: List[T]
    total: int
    hasMore: bool


@dataclass(frozen=True)
class TimeRange:
    # ISO8601 本地时区字符串；入参/出参统一
    start: Optional[str] = None
    end: Optional[str] = None
