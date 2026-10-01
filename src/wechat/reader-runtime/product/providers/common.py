"""跨平台共用的只读 DB 查询层（确定性的本地数据召回）。

本层不知道平台差异、不知道 passphrase 怎么来的，只负责：
- 给定 AccessMaterial（含 query 执行器）跑已验证的 SQLCipher 只读查询
- 把微信 WCDB 的底层表结构映射为结构化行（不对外暴露表名 / 列名细节）

SQL 仅在本文件内构造；调用方（Service）只传领域参数，绝不传 SQL 字符串。
时间过滤值在写入 SQL 前已转成整数 epoch，搜索词会转义单引号以防注入。
"""
import hashlib
import json
import os
import subprocess
from typing import Dict, List, Optional, Tuple

from .DatabaseAccessProvider import AccessMaterial
from ..errors.codes import ErrorCode, ServiceError, WechatServiceError


def _msg_table_name(username: str) -> str:
    return "Msg_" + hashlib.md5(username.encode("utf-8")).hexdigest()


def _sql_text_literal(text: str) -> str:
    """把字符串以 **UTF-8 字节的 hex 字面量**写进 SQL（跨平台 UTF-8-safe 传输）。

    为什么需要它：
        底层查询器是原生 C 程序，SQL 通过 argv 传入。Windows 下 argv 会经 C 运行时
        按**本地代码页**（简体中文环境为 GBK/936）转换，导致 SQL 里的中文与库中
        UTF-8 文本对不上 —— `searchMessages("中文")` 恒返回 0 条（macOS 无此问题）。

    做法：
        文本先编码为 UTF-8 字节，再以 SQLite 的 blob 字面量 `x'..'` 传输，
        在 SQL 内 `CAST(... AS TEXT)` 还原。于是：
        - 命令行的 SQL **永远是纯 ASCII**，不再经过任何代码页转换；
        - 字节原样送达 SQLite，Mac / Windows **语义完全一致**；
        - 字面量里不可能出现引号，天然免疫 SQL 注入。
    """
    return "CAST(x'%s' AS TEXT)" % text.encode("utf-8").hex()


def _iso_to_epoch(iso: Optional[str]) -> Optional[int]:
    if not iso:
        return None
    from datetime import datetime
    value = iso.strip()
    if value.endswith(("Z", "z")):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.astimezone()
    return int(dt.timestamp())


class WechatReadOnlyDB:
    def __init__(self, material: AccessMaterial):
        self.m = material
        self._integrity_checked = set()
        # 会话时间的批量缓存（见 session_last_times 的 N+1 说明）
        self._session_cache: Optional[Dict[str, int]] = None

    # ---- 底层执行 ----
    def _run(self, db_path: str, sql: str) -> List[List[Optional[str]]]:
        # 注：WeChat WCDB 的 PRAGMA cipher_integrity_check 在无 page_size 显式设置时
        # 会出现假阳性（与已验证可查询的 scquery 路径矛盾）。因此：
        # - 打开/查询成功即视为材料有效（错误密钥由 Driver runner 映射为 ACCESS_MATERIAL_EXPIRED）；
        # - cipher_integrity_check 仅作可选诊断，不阻断读取。
        return self.m.query(db_path, sql)

    # ---- contact / session ----
    def contact_rows(self) -> List[Tuple[str, str, str, int]]:
        """返回 (username, nick_name, remark, local_type)。"""
        sql = (
            "SELECT username, nick_name, remark, local_type "
            "FROM contact WHERE username IS NOT NULL"
        )
        out = []
        for r in self._run(self._contact_db(), sql):
            out.append((r[0] or "", r[1] or "", r[2] or "", int(r[3] or 0)))
        return out

    def contact_nick(self, user_name: str) -> Optional[str]:
        sql = "SELECT nick_name FROM contact WHERE username = %s" % _sql_text_literal(user_name)
        rows = self._run(self._contact_db(), sql)
        if rows and rows[0][0]:
            return rows[0][0]
        return None

    def session_last_times(self) -> Dict[str, int]:
        """一次性取回全部会话的最后活跃时间 {userName: last_timestamp}。

        ⚠️ 这里必须批量取：早期实现是「每个联系人一次查询」，
        而每次查询都是一个原生查询器子进程 —— 数千联系人会变成数千次
        subprocess（N+1），listConversations 直接超时。
        现在改为单条查询 + 实例内缓存，会话时间不再随联系人数增长。
        """
        if self._session_cache is not None:
            return self._session_cache

        from ..errors.codes import WechatServiceError

        cache: Dict[str, int] = {}
        db = os.path.join(self.m.db_root, "session", "session.db")
        if not os.path.exists(db):
            self._session_cache = cache
            return cache
        try:
            # 微信 4.1.x：SessionTable.last_timestamp
            rows = self._run(db, "SELECT userName, last_timestamp FROM SessionTable")
        except WechatServiceError:
            # 表结构不同则降级为空映射，不影响主链路
            self._session_cache = cache
            return cache
        for r in rows:
            username = r[0] if len(r) > 0 else None
            if not username:
                continue
            try:
                cache[username] = int(r[1])
            except (ValueError, TypeError, IndexError):
                continue
        self._session_cache = cache
        return cache

    def session_last_time(self, username: str) -> Optional[int]:
        """单个会话的最后活跃时间；走批量缓存，不额外发起查询。"""
        return self.session_last_times().get(username)

    # ---- message 分片定位 ----
    def message_shards(self) -> List[str]:
        msg_dir = os.path.join(self.m.db_root, "message")
        if not os.path.isdir(msg_dir):
            return []
        import glob

        return sorted(glob.glob(os.path.join(msg_dir, "message_*.db")))

    def locate_message_table(self, username: str) -> List[Tuple[str, str]]:
        """返回 [(shard_path, table_name), ...]，包含该会话消息表的所有分片。"""
        tname = _msg_table_name(username)
        found = []
        for shard in self.message_shards():
            rows = self._run(
                shard,
                "SELECT name FROM sqlite_master WHERE type='table' AND name='%s'" % tname,
            )
            if rows:
                found.append((shard, tname))
        return found

    # ---- 消息读取 ----
    def count_messages(self, shard: str, table: str, tr: Tuple[Optional[int], Optional[int]]) -> int:
        sql = "SELECT count(*) FROM %s%s" % (table, self._where(tr))
        rows = self._run(shard, sql)
        return int(rows[0][0] or 0) if rows else 0

    def query_messages(
        self,
        shard: str,
        table: str,
        tr: Tuple[Optional[int], Optional[int]],
        limit: int,
        offset: int,
        like: Optional[str] = None,
    ) -> List[list]:
        sql = (
            "SELECT local_id, create_time, real_sender_id, message_content, local_type "
            "FROM %s%s ORDER BY create_time DESC LIMIT %d OFFSET %d"
            % (table, self._where(tr, like), limit, offset)
        )
        return self._run(shard, sql)

    def message_by_local_id(self, shard: str, table: str, local_id: int) -> Optional[list]:
        sql = (
            "SELECT local_id, create_time, real_sender_id, message_content, local_type "
            "FROM %s WHERE local_id = %d" % (table, local_id)
        )
        rows = self._run(shard, sql)
        return rows[0] if rows else None

    def distinct_senders(self, shard: str, table: str) -> List[int]:
        sql = "SELECT DISTINCT real_sender_id FROM %s WHERE real_sender_id IS NOT NULL" % table
        out = []
        for r in self._run(shard, sql):
            try:
                out.append(int(r[0]))
            except (ValueError, TypeError):
                continue
        return out

    def sender_user_name(self, shard: str, real_sender_id: int) -> Optional[str]:
        sql = "SELECT user_name FROM Name2Id WHERE rowid = %d" % real_sender_id
        rows = self._run(shard, sql)
        if rows and rows[0][0]:
            return rows[0][0]
        return None

    # ---- 内部 ----
    def _contact_db(self) -> str:
        return os.path.join(self.m.db_root, "contact", "contact.db")

    @staticmethod
    def _where(tr: Tuple[Optional[int], Optional[int]], like: Optional[str] = None) -> str:
        """拼 WHERE 子句。

        注意：无时间条件时，搜索条件必须以 `WHERE` 开头，不能拼成 `AND ...`
        （否则 `FROM <table> AND message_content LIKE ...` 是语法错误，
        会被底层当作查询失败 → 误报 ACCESS_MATERIAL_EXPIRED）。
        """
        lo, hi = tr
        conds: List[str] = []
        if lo is not None:
            conds.append("create_time >= %d" % lo)
        if hi is not None:
            conds.append("create_time <= %d" % hi)
        if like:
            # 查询词走 hex 字面量：纯 ASCII SQL，跨平台 UTF-8 语义一致
            conds.append("message_content LIKE '%%' || %s || '%%'" % _sql_text_literal(like))
        if not conds:
            return ""
        return " WHERE " + " AND ".join(conds)


def scquery_runner(bin_path: str, keyhex: str):
    """构造 (db_path, sql) -> rows 的执行器，Mac / Windows 两个 Driver 共用。

    ⚠️ 已知边界：非 ASCII（如中文）**不要**写进 SQL。
    该查询器是原生 C 程序，Windows 下 argv 会经 CRT 按本地代码页转换，
    中文 LIKE 条件会失配（macOS 无此问题）。产品层已把所有文本匹配
    （findConversation）放在 Python 侧完成，SQL 里只有 ASCII 标识与数字。
    """
    def run(db_path: str, sql: str):
        cmd = [bin_path, db_path, keyhex, sql, "--json"]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=60)
        except FileNotFoundError:
            raise WechatServiceError(
                ServiceError(
                    ErrorCode.INTERNAL_ERROR,
                    "未找到底层读取工具",
                    diagnosticId="scquery-missing",
                )
            )
        # 非文本消息的 message_content 含原始二进制，stdout 不一定是合法 UTF-8；
        # 宽松解码，避免崩溃（二进制内容对文本消息无影响）。
        out = proc.stdout.decode("utf-8", "replace") if proc.stdout else ""
        err = proc.stderr.decode("utf-8", "replace") if proc.stderr else ""
        if proc.returncode != 0:
            combined = out + err
            if "open fail" in combined or "not a database" in combined or "ERR:" in combined:
                raise WechatServiceError(
                    ServiceError(
                        ErrorCode.ACCESS_MATERIAL_EXPIRED,
                        "无法用现有材料打开数据库，可能材料已失效。",
                        retryable=True,
                        needsReinit=True,
                        needsUserAction=True,
                        userAction="请重启微信并重新登录后重新获取材料",
                    )
                )
            raise WechatServiceError(
                ServiceError(
                    ErrorCode.INTERNAL_ERROR,
                    "底层数据库查询失败",
                    diagnosticId="scquery:%d" % proc.returncode,
                )
            )
        rows = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("ERR:"):
                raise WechatServiceError(
                    ServiceError(
                        ErrorCode.INTEGRITY_CHECK_FAILED,
                        "数据库返回错误：" + line[4:].strip(),
                    )
                )
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return rows

    return run
