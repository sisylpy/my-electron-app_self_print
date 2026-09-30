"""Driver 抽象边界。

- `DatabaseAccessProvider`：平台相关能力的协议（环境检测 / 账号检测 / 取材料 / 释放）。
- `AccessMaterial`：acquire() 返回的不透明句柄，持有 32 字节 passphrase 与查询执行器；
  禁止向上层暴露 .passphrase / .account_wxid / .db_root 内部路径。
- `AccountMeta`：Driver 内部使用的账号元数据（含 wxid），仅模块内部流转。
"""
from dataclasses import dataclass
from typing import Callable, List, Optional, Protocol, runtime_checkable

from ..domain.ids import AccountId


@dataclass
class AccessMaterial:
    account_id: AccountId
    account_wxid: str
    db_root: str
    passphrase: bytes
    # (db_path, sql) -> 行（每行是字符串或 None 的列表）。底层已执行
    # sqlite3_open_v2(READONLY) + sqlite3_key(32B) + cipher_integrity_check。
    query: Callable[[str, str], List[List[Optional[str]]]]
    # 材料只在本机有效（A8）；缓存/判定键为 (machine_id, account_id)
    machine_id: str = ""

    def release(self) -> None:
        # 占位：具体 Driver 可在此停止 helper / 清理句柄
        return None


@dataclass
class AccountMeta:
    account_id: AccountId
    wxid: str
    db_root: str
    display_hint: str
    has_material: bool


@dataclass
class DatabaseRef:
    name: str
    path: str


@runtime_checkable
class DatabaseAccessProvider(Protocol):
    def detect_environment(self): ...
    def detect_accounts(self) -> List[AccountMeta]: ...
    def acquire(self, account_id: AccountId) -> AccessMaterial: ...
    def release(self) -> None: ...
