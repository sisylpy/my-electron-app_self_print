from dataclasses import dataclass
from typing import List

from .Conversation import Conversation


@dataclass(frozen=True)
class FindResult:
    matches: List[Conversation]
    ambiguous: bool
