from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

from .AttachmentRef import AttachmentRef
from .ids import ConversationId, MessageId, ParticipantId


@dataclass(frozen=True)
class Message:
    id: MessageId
    conversationId: ConversationId
    timestamp: datetime
    senderId: ParticipantId
    senderName: str              # 已解析的昵称（对 Electric 而言是"谁"）
    type: Literal["text", "image", "voice", "video", "file", "system", "unknown"]
    text: str                    # 文本消息正文；非文本为空串
    attachmentRef: Optional[AttachmentRef] = None
    source: Literal["local_wechat_db"] = "local_wechat_db"   # 数据来源标记，便于审计
