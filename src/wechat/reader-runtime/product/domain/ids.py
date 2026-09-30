"""内部稳定标识符类型。

这些 ID 是 fp:<hash> 指纹 / UUID，绝不是 wxid / @chatroom / Msg_<hash> 等
微信内部结构。它们只在 product/ 模块内部生成与解析，绝不泄漏给调用方。
"""
from typing import NewType

AccountId = NewType("AccountId", str)
ConversationId = NewType("ConversationId", str)
ParticipantId = NewType("ParticipantId", str)
MessageId = NewType("MessageId", str)
AttachmentId = NewType("AttachmentId", str)
