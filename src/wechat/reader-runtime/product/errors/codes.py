"""产品级错误码（13 个）与错误对象。

铁律：Electric 绝不能收到 sqlite3 / PBKDF2 / file is not a database 这类底层错误。
所有底层异常必须在 Driver 层翻译为 ServiceError，再由 Service 以 WechatServiceError 抛出。
"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ErrorCode(str, Enum):
    READY = "READY"
    NO_ACCOUNT = "NO_ACCOUNT"
    WECHAT_NOT_INSTALLED = "WECHAT_NOT_INSTALLED"
    ACCESS_NOT_READY = "ACCESS_NOT_READY"
    ACCESS_MATERIAL_EXPIRED = "ACCESS_MATERIAL_EXPIRED"
    UNSUPPORTED_WECHAT_VERSION = "UNSUPPORTED_WECHAT_VERSION"
    SCHEMA_UNSUPPORTED = "SCHEMA_UNSUPPORTED"
    CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND"
    CONVERSATION_AMBIGUOUS = "CONVERSATION_AMBIGUOUS"
    NO_DATA = "NO_DATA"
    PERMISSION_REQUIRED = "PERMISSION_REQUIRED"
    INTEGRITY_CHECK_FAILED = "INTEGRITY_CHECK_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass(frozen=True)
class ServiceError:
    code: ErrorCode
    message: str                # 面向用户的中文说明（不含内部实现细节）
    retryable: bool = False
    needsReinit: bool = False
    needsUserAction: bool = False
    userAction: Optional[str] = None   # 如 "请重启微信并重新登录"
    diagnosticId: Optional[str] = None


class WechatServiceError(Exception):
    """Service 层统一抛出的产品级错误；调用方捕获后读取 .error.code。"""

    def __init__(self, err: ServiceError):
        self.error = err
        super().__init__(err.message)
