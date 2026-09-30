"""Mac 平台 Driver：复用已验证的 scquery（SQLCipher 4.6.1 + 32B passphrase 只读）能力。

边界：
- scquery 是唯一底层读取工具（gitignore 的 tools/scquery，由 engineering/build 编译）。
- SQL / 表名 / wxid / @chatroom / Msg_<hash> 永远只在 Driver 内部，绝不出现在返回值。
- passphrase 从本地已获取材料（private-data/mac/.dbkey_readonly.txt，gitignore）加载，
  仅在进程内传给 scquery argv；不落日志、不回传。
- 客户机取材料（lldb 断点）流程尚未产品化；无 keyfile 时 acquire 返回 ACCESS_NOT_READY。
"""
import hashlib
import os

from ...config import MAC_MATERIAL_ROOT, MAC_XWECHAT_ROOT, SCQUERY_BIN
from ...domain import AccountId, EnvironmentFingerprint
from ...errors.codes import ErrorCode, ServiceError, WechatServiceError
from ...platform.machine import machine_id
from ...platform.material import MaterialStore
from ..common import scquery_runner
from ..DatabaseAccessProvider import AccessMaterial, AccountMeta


def _fp(s: str, n: int = 16) -> str:
    return "fp:" + hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


class MacWechatDriver:
    def __init__(self):
        self._accounts = {}
        # 材料按 (machine, account) 绑定：机器上"存在一个 keyfile"不再等价于所有账号可用
        self._store = MaterialStore(MAC_MATERIAL_ROOT)
        self._machine_id = machine_id()

    # ---------------- 环境 / 账号检测 ----------------
    def detect_environment(self) -> EnvironmentFingerprint:
        import platform

        installed = os.path.isdir(MAC_XWECHAT_ROOT)
        return EnvironmentFingerprint(
            os="darwin",
            arch=platform.machine(),
            wechatInstalled=installed,
            wechatVersion=self._wechat_version(),
            compatibilityStatus="VERIFIED",
        )

    def detect_accounts(self) -> list:
        if self._accounts:
            return list(self._accounts.values())
        out = []
        if not os.path.isdir(MAC_XWECHAT_ROOT):
            return out
        for name in sorted(os.listdir(MAC_XWECHAT_ROOT)):
            db_root = os.path.join(MAC_XWECHAT_ROOT, name, "db_storage")
            if not os.path.isfile(os.path.join(db_root, "contact", "contact.db")):
                continue
            # 目录名形如 wxid_xxx_<hash>；wxid 为最后一段 '_' 之前的部分
            wxid = name.rsplit("_", 1)[0] if "_" in name else name
            aid = AccountId(_fp(wxid, 16))
            # 只看"这台机器 + 这个账号"有没有材料
            has_mat = self._store.has(wxid)
            out.append(
                AccountMeta(
                    account_id=aid,
                    wxid=wxid,
                    db_root=db_root,
                    display_hint="wxid_<" + _fp(wxid, 12)[3:] + ">",
                    has_material=has_mat,
                )
            )
        for a in out:
            self._accounts[a.account_id] = a
        return out

    # ---------------- 取材料 ----------------
    def acquire(self, account_id: AccountId) -> AccessMaterial:
        meta = self._accounts.get(account_id)
        if meta is None:
            # 触发一次检测以填充缓存
            self.detect_accounts()
            meta = self._accounts.get(account_id)
        if meta is None:
            raise WechatServiceError(
                ServiceError(ErrorCode.NO_ACCOUNT, "未找到该 Mac 微信账号")
            )
        if not self._store.has(meta.wxid):
            raise WechatServiceError(
                ServiceError(
                    ErrorCode.ACCESS_NOT_READY,
                    "该账号在本机没有可用访问材料；客户机取材料流程尚未产品化。",
                    retryable=False,
                    needsUserAction=True,
                    userAction="在本机为该账号绑定材料，或先解决取材料流程",
                )
            )
        try:
            keyhex = self._store.load(meta.wxid)
        except ValueError:
            raise WechatServiceError(
                ServiceError(
                    ErrorCode.ACCESS_MATERIAL_EXPIRED,
                    "访问材料格式异常（应为 64 位 hex）。",
                    needsReinit=True,
                )
            )
        return AccessMaterial(
            account_id=account_id,
            account_wxid=meta.wxid,
            db_root=meta.db_root,
            passphrase=bytes.fromhex(keyhex),
            query=self._make_runner(keyhex),
            machine_id=self._machine_id,
        )

    def release(self) -> None:
        return None

    # ---------------- 底层执行器（scquery --json，与 Windows 共用） ----------------
    def _make_runner(self, keyhex: str):
        return scquery_runner(SCQUERY_BIN, keyhex)

    @staticmethod
    def _wechat_version():
        p = "/Applications/WeChat.app/Contents/Info.plist"
        if os.path.isfile(p):
            try:
                import plistlib

                with open(p, "rb") as f:
                    return plistlib.load(f).get("CFBundleShortVersionString")
            except Exception:
                return None
        return None
