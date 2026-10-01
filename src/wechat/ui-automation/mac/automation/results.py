from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class ResultCode(str, Enum):
    SUCCESS = "SUCCESS"
    TARGET_NOT_FOUND = "TARGET_NOT_FOUND"
    TARGET_AMBIGUOUS = "TARGET_AMBIGUOUS"
    CHAT_INFO_NOT_FOUND = "CHAT_INFO_NOT_FOUND"
    PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND"
    TAG_EDITOR_NOT_FOUND = "TAG_EDITOR_NOT_FOUND"
    VERIFY_FAILED = "VERIFY_FAILED"
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SCAN_LIMIT_REACHED = "SCAN_LIMIT_REACHED"


@dataclass(frozen=True)
class OperationResult:
    code: ResultCode
    action: str
    target: str
    message: str
    artifact_dir: Path | None = None
    details: tuple[str, ...] = ()
    metrics: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.code is ResultCode.SUCCESS

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["code"] = self.code.value
        value["artifact_dir"] = str(self.artifact_dir) if self.artifact_dir else None
        return value
