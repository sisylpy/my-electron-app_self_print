from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

from .ids import ConversationId


@dataclass(frozen=True)
class Conversation:
    id: ConversationId            # 内部稳定 ID（非 @chatroom）
    displayName: str              # 群名 / 好友名（来自 contact.nick_name）
    kind: Literal["group", "direct", "official"]
    participantCount: Optional[int] = None
    lastMessageAt: Optional[datetime] = None
