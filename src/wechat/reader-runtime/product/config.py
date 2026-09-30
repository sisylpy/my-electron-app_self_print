"""product/ 模块的运行配置（不进入 Git 的敏感值通过环境变量覆盖）。

注意：private-data/ 整体 gitignore，本模块的 keyfile 路径只指向本地材料，
绝不把 passphrase 写入代码或日志。
"""
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(REPO_ROOT, "tools")
SCQUERY_BIN = os.path.join(TOOLS_DIR, "scquery")
PRIVATE_DATA = os.path.join(REPO_ROOT, "private-data")

# Mac 数据根（WeChat 4.1.x 容器路径）
MAC_XWECHAT_ROOT = os.path.expanduser(
    "~/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files"
)

# Windows 数据根（WeChat 4.x：C:\Users\<user>\xwechat_files）
WIN_XWECHAT_ROOT = os.environ.get(
    "WLR_WIN_XWECHAT_ROOT",
    os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), "xwechat_files"),
)

# Windows 侧只读查询器（由 engineering/build/build_windows_scquery.sh 编译）
WIN_SCQUERY_BIN = os.environ.get(
    "WLR_WIN_SCQUERY", os.path.join(TOOLS_DIR, "scquery.exe")
)

# 访问材料：(machine, account) 二元组存储根（private-data 下，gitignore）
MAC_MATERIAL_ROOT = os.environ.get(
    "WLR_MAC_MATERIAL_ROOT", os.path.join(PRIVATE_DATA, "mac", "materials")
)
WIN_MATERIAL_ROOT = os.environ.get(
    "WLR_WIN_MATERIAL_ROOT", os.path.join(PRIVATE_DATA, "windows", "materials")
)
