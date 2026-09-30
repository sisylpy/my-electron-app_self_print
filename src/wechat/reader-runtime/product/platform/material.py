"""(machine, account) 二元组绑定的访问材料存储。

背景（A8 结论）：一份 passphrase 只对「取材料的那台机器 + 那个账号」有效，
A 的材料打不开 B 的库。因此：
- ❶ 不能再用「机器上存在一个 keyfile ⇒ 所有账号 hasAccessMaterial」的旧逻辑；
- ❷ 材料必须按 (machine, account) 分别存放与判定。

存储布局（全部位于 gitignore 的 private-data 下，永不入库）：

    <root>/<machine_fp>/<account_fp>.key      # 内容：64 位 hex（32 字节 passphrase）

其中 machine_fp = machine_id()，account_fp = account_fingerprint(wxid)。
文件名只用指纹，不出现 wxid 明文。

命令行用法（在本机绑定一份材料）：
    python -m product.platform.material bind --account <wxid> --from-file <keyfile>
    python -m product.platform.material has   --account <wxid>
"""
import argparse
import hashlib
import os
import sys
from typing import Optional

from .machine import machine_id


def account_fingerprint(wxid: str) -> str:
    """账号指纹（16 hex）。避免在文件名/日志中出现 wxid 明文。"""
    return hashlib.sha256(("account:" + wxid).encode("utf-8")).hexdigest()[:16]


class MaterialStore:
    def __init__(self, root: str, machine_fp: Optional[str] = None):
        self.root = root
        self.machine_fp = machine_fp or machine_id()

    # ---- 路径 ----
    def path_for(self, wxid: str) -> str:
        return os.path.join(self.root, self.machine_fp, account_fingerprint(wxid) + ".key")

    # ---- 判定 / 读取 ----
    def has(self, wxid: str) -> bool:
        return os.path.isfile(self.path_for(wxid))

    def load(self, wxid: str) -> str:
        """返回 64 位 hex；缺失或格式异常时抛 KeyError / ValueError。"""
        path = self.path_for(wxid)
        if not os.path.isfile(path):
            raise KeyError("no material for account on this machine: %s" % path)
        with open(path, "r", encoding="utf-8") as f:
            keyhex = "".join(f.read().split())
        if len(keyhex) != 64:
            raise ValueError("material format invalid (expect 64 hex): %s" % path)
        int(keyhex, 16)  # 触发格式校验
        return keyhex

    # ---- 绑定 ----
    def bind(self, wxid: str, keyhex: str) -> str:
        keyhex = "".join(keyhex.split())
        if len(keyhex) != 64:
            raise ValueError("key must be 64 hex chars")
        int(keyhex, 16)
        path = self.path_for(wxid)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(keyhex + "\n")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass  # Windows 上 chmod 能力有限，忽略
        return path


def _main(argv=None) -> int:
    from ..config import MAC_MATERIAL_ROOT, WIN_MATERIAL_ROOT

    default_root = WIN_MATERIAL_ROOT if sys.platform == "win32" else MAC_MATERIAL_ROOT
    p = argparse.ArgumentParser(prog="material", description="(machine, account) 访问材料绑定")
    p.add_argument("action", choices=["bind", "has", "path"])
    p.add_argument("--account", required=True, help="账号 wxid")
    p.add_argument("--from-file", dest="from_file", help="bind：读取 64 hex 的文件")
    p.add_argument("--root", default=os.environ.get("WLR_MATERIAL_ROOT", default_root))
    sub = p.parse_args(argv)

    store = MaterialStore(sub.root)
    if sub.action == "has":
        print("has=%s" % store.has(sub.account))
        return 0 if store.has(sub.account) else 1
    if sub.action == "path":
        print(store.path_for(sub.account))
        return 0
    if not sub.from_file:
        p.error("bind 需要 --from-file")
    with open(sub.from_file, "r", encoding="utf-8") as f:
        keyhex = "".join(f.read().split())
    path = store.bind(sub.account, keyhex)
    print("bound: machine=%s account_fp=%s -> %s" % (
        store.machine_fp, account_fingerprint(sub.account), path))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
