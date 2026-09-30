from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class EnvironmentFingerprint:
    os: str
    arch: str
    wechatInstalled: bool
    wechatVersion: Optional[str]
    compatibilityStatus: str     # 来自 compatibility/registry.yaml 的状态


@dataclass(frozen=True)
class Capability:
    name: str
    available: bool
    detail: Optional[str] = None


@dataclass(frozen=True)
class DiagnoseResult:
    fingerprint: EnvironmentFingerprint
    capabilities: List[Capability]
    missingEvidence: List[str]
    suggestedActions: List[str]
    ready: bool
