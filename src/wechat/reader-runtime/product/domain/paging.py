from dataclasses import dataclass
from typing import Generic, List, Optional, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class Page:
    offset: int = 0
    limit: int = 50
    # ``keyset`` is opt-in so every existing offset caller keeps the exact
    # response and paging behaviour it had before Reader protocol v3.
    keyset: bool = False
    pageKey: Optional[str] = None


@dataclass(frozen=True)
class PageResult(Generic[T]):
    items: List[T]
    total: int
    hasMore: bool
    # Present only for the opt-in keyset path.  The token is opaque to Electron
    # and is deliberately independent from the public/business Message.id.
    nextPageKey: Optional[str] = None


@dataclass(frozen=True)
class TimeRange:
    # ISO8601 本地时区字符串；入参/出参统一
    start: Optional[str] = None
    end: Optional[str] = None
