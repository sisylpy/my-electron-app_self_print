"""Windows 平台 Driver：用本机原生只读查询器打开微信 4.x 的加密库。

与 MacWechatDriver 的差异只在四处（见 docs/15 §5.2）：
- 环境检测：看 xwechat_files 数据根 + 卸载表里的版本号
- 账号目录：C:\\Users\\<user>\\xwechat_files\\<wxid>_<hash>
- 底层查询器：本机原生 exe（engineering/build/build_windows_scquery.sh 编译），
  与 Mac 的 scquery 同一套 CLI：`scquery.exe <db> <keyhex64> <sql> [--json]`
- 取材料：登录窗口高频轮询（尚未产品化）；无材料时 acquire 返回 ACCESS_NOT_READY

库定位（db_storage/<名>/<名>.db）、开库/校验、schema 映射与 Mac 完全相同，
因此全部复用 providers/common.py 的跨平台实现。

信息隔离：SQL / 表名 / wxid / @chatroom / DB 路径 / passphrase 只在本模块内流转。
"""
import hashlib
import os

from ...config import WIN_MATERIAL_ROOT, WIN_SCQUERY_BIN, WIN_XWECHAT_ROOT
from ...domain import AccountId, EnvironmentFingerprint
from ...errors.codes import ErrorCode, ServiceError, WechatServiceError
from ...platform.machine import machine_id
from ...platform.material import MaterialStore
from ..common import scquery_runner
from ..DatabaseAccessProvider import AccessMaterial, AccountMeta

# Windows 基线状态取自 compatibility/registry.yaml 的
# WIN-WECHAT-4.1.15.13-BASELINE-001（不在此处猜参数）
WIN_BASELINE_STATUS = "TECHNICALLY_ACHIEVED_PENDING_REPEATABILITY"


def _fp(s: str, n: int = 16) -> str:
    return "fp:" + hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def _wechat_version():
    """尽力从卸载表读取微信版本号；读不到返回 None（不做任何猜测）。"""
    try:
        import winreg
    except ImportError:
        return None
    roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    for root, base in roots:
        try:
            with winreg.OpenKey(root, base) as key:
                i = 0
                while True:
                    try:
                        sub = winreg.EnumKey(key, i)
                    except OSError:
                        break
                    i += 1
                    if "wechat" not in sub.lower() and "weixin" not in sub.lower():
                        continue
                    try:
                        with winreg.OpenKey(key, sub) as skey:
                            name, _ = winreg.QueryValueEx(skey, "DisplayName")
                            ver, _ = winreg.QueryValueEx(skey, "DisplayVersion")
                    except OSError:
                        continue
                    if name and ("微信" in name or "WeChat" in name or "Weixin" in name):
                        return ver
        except OSError:
            continue
    return None


class WindowsWechatDriver:
    def __init__(self):
        self._accounts = {}
        # 材料按 (machine, account) 绑定：
        # 机器上存在另一账号/另一机器的材料，不代表本账号可用
        self._store = MaterialStore(WIN_MATERIAL_ROOT)
        self._machine_id = machine_id()

    # ---------------- 环境 / 账号检测 ----------------
    def detect_environment(self) -> EnvironmentFingerprint:
        import platform

        installed = os.path.isdir(WIN_XWECHAT_ROOT)
        return EnvironmentFingerprint(
            os="windows",
            arch=platform.machine(),
            wechatInstalled=installed,
            wechatVersion=_wechat_version(),
            compatibilityStatus=WIN_BASELINE_STATUS,
        )

    def detect_accounts(self) -> list:
        if self._accounts:
            return list(self._accounts.values())
        out = []
        if not os.path.isdir(WIN_XWECHAT_ROOT):
            return out
        for name in sorted(os.listdir(WIN_XWECHAT_ROOT)):
            db_root = os.path.join(WIN_XWECHAT_ROOT, name, "db_storage")
            if not os.path.isfile(os.path.join(db_root, "contact", "contact.db")):
                continue
            # 目录名形如 wxid_xxx_<hash>
            wxid = name.rsplit("_", 1)[0] if "_" in name else name
            aid = AccountId(_fp(wxid, 16))
            out.append(
                AccountMeta(
                    account_id=aid,
                    wxid=wxid,
                    db_root=db_root,
                    display_hint="wxid_<" + _fp(wxid, 12)[3:] + ">",
                    has_material=self._store.has(wxid),
                )
            )
        for a in out:
            self._accounts[a.account_id] = a
        return out

    # ---------------- 取材料 ----------------
    def acquire(self, account_id: AccountId) -> AccessMaterial:
        meta = self._accounts.get(account_id)
        if meta is None:
            self.detect_accounts()
            meta = self._accounts.get(account_id)
        if meta is None:
            raise WechatServiceError(
                ServiceError(ErrorCode.NO_ACCOUNT, "未找到该 Windows 微信账号")
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

    # ---------------- 底层执行器（本机原生 exe --json，与 Mac 共用实现） ----------------
    def _make_runner(self, keyhex: str):
        return scquery_runner(WIN_SCQUERY_BIN, keyhex)
