"""本机稳定指纹。

用途：访问材料只在「取材料的那台机器」上有效（A8 结论），因此材料的缓存键必须是
(machine, account) 二元组。本模块给出 machine 那一维的稳定、不可逆标识。

取值优先级：
1. 平台原生机器 ID（Windows: HKLM MachineGuid；macOS: IOPlatformUUID）
2. 兜底：主机名 + 硬件架构（跨机器重名概率极低，但弱于 1）

只输出 sha256 前 16 位指纹，不输出原始 ID，避免本机标识外泄。
"""
import hashlib
import platform
import subprocess


def _windows_machine_guid():
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography"
        ) as key:
            value, _ = winreg.QueryValueEx(key, "MachineGuid")
            return value or None
    except Exception:
        return None


def _darwin_platform_uuid():
    try:
        proc = subprocess.run(
            ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
            capture_output=True, text=True, timeout=10,
        )
        for line in (proc.stdout or "").splitlines():
            if "IOPlatformUUID" in line:
                parts = line.split('"')
                if len(parts) >= 2:
                    return parts[-2] or None
    except Exception:
        return None
    return None


def _raw_machine_id():
    system = platform.system().lower()
    raw = None
    if system == "windows":
        raw = _windows_machine_guid()
    elif system == "darwin":
        raw = _darwin_platform_uuid()
    if not raw:
        raw = "%s|%s" % (platform.node(), platform.machine())
    return raw


def machine_id() -> str:
    """返回本机指纹（16 hex）。跨机器不同、同机稳定。"""
    raw = _raw_machine_id()
    return hashlib.sha256(("machine:" + raw).encode("utf-8")).hexdigest()[:16]
