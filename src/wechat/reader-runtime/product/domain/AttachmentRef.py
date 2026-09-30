from dataclasses import dataclass
from typing import Literal, Optional

from .ids import AttachmentId


@dataclass(frozen=True)
class AttachmentRef:
    id: AttachmentId
    kind: Literal["image", "voice", "video", "file", "link", "unknown"]
    localPath: Optional[str] = None   # 可能尚未解析（P2）
    mimeHint: Optional[str] = None
