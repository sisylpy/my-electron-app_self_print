from dataclasses import dataclass
from typing import Optional

from .ids import AccountId


@dataclass(frozen=True)
class WechatAccount:
    id: AccountId                 # 内部稳定 ID（非 wxid）
    displayHint: str              # 可读微信昵称；不可用时回退 "wxid_<fp:xxxxxxxxxxxx>"
    isCurrentLogin: Optional[bool] = None
    databaseCount: Optional[int] = None
    hasAccessMaterial: bool = False
