"""跨平台共用的只读 DB 查询层（确定性的本地数据召回）。

本层不知道平台差异、不知道 passphrase 怎么来的，只负责：
- 给定 AccessMaterial（含 query 执行器）跑已验证的 SQLCipher 只读查询
- 把微信 WCDB 的底层表结构映射为结构化行（不对外暴露表名 / 列名细节）

SQL 仅在本文件内构造；调用方（Service）只传领域参数，绝不传 SQL 字符串。
时间过滤值在写入 SQL 前已转成整数 epoch，搜索词会转义单引号以防注入。
"""
import hashlib
import io
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Tuple

from .DatabaseAccessProvider import AccessMaterial
from ..errors.codes import ErrorCode, ServiceError, WechatServiceError


_ZSTD_FRAME_MAGIC = b"\x28\xb5\x2f\xfd"
_MAX_DECOMPRESSED_MESSAGE_BYTES = 8 * 1024 * 1024


def _decode_message_content(value: Optional[str]) -> str:
    """Decode a ``hex(message_content)`` value without losing binary bytes.

    WeChat 4.x stores some group text messages as Zstandard-compressed BLOBs.
    Reading ``message_content`` directly makes the native queryer's JSON/stdout
    conversion replace the binary bytes before Python can inspect them. The
    query therefore returns hex and this function restores the original bytes,
    decompressing only a real Zstandard frame. Ordinary TEXT/BLOB messages
    continue to be decoded as UTF-8.
    """
    if not value:
        return ""
    try:
        payload = bytes.fromhex(str(value))
    except (TypeError, ValueError):
        # Keep compatibility with custom/fake query providers that already
        # return decoded text instead of SQLite hex().
        return str(value)

    if payload.startswith(_ZSTD_FRAME_MAGIC):
        try:
            import zstandard
        except ImportError:
            return ""
        try:
            with zstandard.ZstdDecompressor().stream_reader(io.BytesIO(payload)) as reader:
                decoded = reader.read(_MAX_DECOMPRESSED_MESSAGE_BYTES + 1)
            if len(decoded) > _MAX_DECOMPRESSED_MESSAGE_BYTES:
                return ""
            payload = decoded
        except (OSError, zstandard.ZstdError):
            # Never turn compressed binary into replacement-character garbage.
            # An empty value is safer and lets callers reject this one message.
            return ""

    return payload.decode("utf-8", "replace")


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
        self._contact_rows_cache: Optional[List[Tuple[str, str, str, int]]] = None
        self._contact_nick_cache: Dict[str, Optional[str]] = {}
        self._message_location_cache: Dict[str, List[Tuple[str, str]]] = {}
        self._message_table_index: Dict[str, List[str]] = {}
        self._indexed_message_shards = set()
        # Stabilization retries often issue the exact same read while WeChat's
        # database has not changed. Cache only the latest query per table/page;
        # a main DB or WAL change invalidates it immediately.
        self._message_query_cache = {}
        self._message_table_columns_cache: Dict[Tuple[str, str], set] = {}
        self._sender_username_cache: Dict[Tuple[str, int], Optional[str]] = {}
        self._distinct_sender_cache = {}

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
        if self._contact_rows_cache is not None:
            return list(self._contact_rows_cache)
        sql = (
            "SELECT username, nick_name, remark, local_type "
            "FROM contact WHERE username IS NOT NULL"
        )
        out = []
        for r in self._run(self._contact_db(), sql):
            row = (r[0] or "", r[1] or "", r[2] or "", int(r[3] or 0))
            out.append(row)
            self._contact_nick_cache[row[0]] = row[1] or None
        self._contact_rows_cache = out
        return list(out)

    def contact_nick(self, user_name: str) -> Optional[str]:
        if user_name in self._contact_nick_cache:
            return self._contact_nick_cache[user_name]
        sql = "SELECT nick_name FROM contact WHERE username = %s" % _sql_text_literal(user_name)
        rows = self._run(self._contact_db(), sql)
        nick = rows[0][0] if rows and rows[0][0] else None
        self._contact_nick_cache[user_name] = nick
        return nick

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
        # Only numbered message shards carry Msg_<md5> conversation tables.
        # message_fts.db / message_resource.db use different schemas (and may
        # even use different WCDB material), so probing them as chat shards can
        # produce false ACCESS_MATERIAL_EXPIRED errors.
        return sorted(
            path for path in glob.glob(os.path.join(msg_dir, "message_*.db"))
            if re.fullmatch(r"message_\d+\.db", os.path.basename(path))
        )

    def locate_message_table(self, username: str) -> List[Tuple[str, str]]:
        """返回 [(shard_path, table_name), ...]，包含该会话消息表的所有分片。"""
        self._index_new_message_shards()
        cached = self._message_location_cache.get(username)
        if cached:
            tname = cached[0][1]
            locations = [(shard, tname) for shard in self._message_table_index.get(tname, [])]
            if locations != cached:
                self._message_location_cache[username] = locations
            return list(locations)
        tname = _msg_table_name(username)
        found = [(shard, tname) for shard in self._message_table_index.get(tname, [])]
        if not found and not username.endswith("@chatroom"):
            found = self._locate_direct_tables_by_sender(username)
        if found:
            self._message_location_cache[username] = list(found)
        return found

    def _index_new_message_shards(self) -> None:
        """Index each numbered shard once instead of probing every shard per customer.

        Every shard is an independent read-only database. Querying them serially
        makes the first conversation read pay one native-process startup per
        shard, so index cold-starts in a small bounded pool instead. ``map`` keeps
        the merge order deterministic and the four-worker cap avoids a CPU spike
        on customer machines with many historical shards.
        """
        shards = [
            shard for shard in self.message_shards()
            if shard not in self._indexed_message_shards
        ]
        if not shards:
            return

        sql = "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Msg_%'"

        def read_tables(shard: str):
            return shard, self._run(shard, sql)

        if len(shards) == 1:
            indexed = [read_tables(shards[0])]
        else:
            with ThreadPoolExecutor(max_workers=min(4, len(shards))) as executor:
                indexed = list(executor.map(read_tables, shards))

        for shard, rows in indexed:
            for row in rows:
                table = str(row[0] or "") if row else ""
                if not re.fullmatch(r"Msg_[0-9a-f]{32}", table):
                    continue
                self._message_table_index.setdefault(table, []).append(shard)
            self._indexed_message_shards.add(shard)

    def warm_message_index(self) -> None:
        """Preload only message-table metadata; never read message contents."""
        self._index_new_message_shards()

    def _locate_direct_tables_by_sender(self, username: str) -> List[Tuple[str, str]]:
        """Recover direct chats whose physical Msg table is not md5(contact.username).

        Windows Weixin 4.1 can retain a contact row whose username resolves the
        sender correctly while the direct conversation continues in a Msg table
        keyed by another internal session identity.  We never guess across group
        chats: every known chatroom table is excluded first, then a candidate is
        accepted only when this exact sender exists in that non-group table.
        """
        group_tables = {
            _msg_table_name(contact_username)
            for contact_username, _nick, _remark, _local_type in self.contact_rows()
            if contact_username.endswith("@chatroom")
        }
        username_literal = _sql_text_literal(username)
        found: List[Tuple[str, str]] = []
        for shard in self.message_shards():
            sender_rows = self._run(
                shard,
                "SELECT rowid FROM Name2Id WHERE user_name = %s" % username_literal,
            )
            sender_ids = []
            for row in sender_rows:
                try:
                    sender_ids.append(int(row[0]))
                except (ValueError, TypeError, IndexError):
                    continue
            if not sender_ids:
                continue
            table_rows = self._run(
                shard,
                "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Msg_%'",
            )
            candidates = [
                str(row[0])
                for row in table_rows
                if row and re.fullmatch(r"Msg_[0-9a-f]{32}", str(row[0] or ""))
                and str(row[0]) not in group_tables
            ]
            if not candidates:
                continue
            ids_sql = ",".join(str(value) for value in sorted(set(sender_ids)))
            probe_sql = " UNION ALL ".join(
                "SELECT '%s' WHERE EXISTS (SELECT 1 FROM %s WHERE real_sender_id IN (%s) LIMIT 1)"
                % (table, table, ids_sql)
                for table in candidates
            )
            for row in self._run(shard, probe_sql):
                table = str(row[0] or "") if row else ""
                if table in candidates:
                    found.append((shard, table))
        return found

    # ---- 消息读取 ----
    def count_messages(
        self,
        shard: str,
        table: str,
        tr: Tuple[Optional[int], Optional[int]],
        like: Optional[str] = None,
    ) -> int:
        sql = "SELECT count(*) FROM %s%s" % (table, self._where(tr, like))
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
        cache_key = (shard, table, limit, offset, like or "")
        database_state = self._message_database_state(shard)
        cached = self._message_query_cache.get(cache_key)
        if cached and cached[0] == tr and cached[1] == database_state:
            return [list(row) for row in cached[2]]
        packed_column = self._packed_info_column(shard, table)
        packed_select = "hex(m.%s)" % packed_column if packed_column else "NULL"
        sql = (
            "SELECT local_id, create_time, real_sender_id, hex(message_content), local_type, "
            "(SELECT user_name FROM Name2Id WHERE rowid = m.real_sender_id), %s "
            "FROM %s AS m%s ORDER BY m.create_time DESC LIMIT %d OFFSET %d"
            % (packed_select, table, self._where(tr, like), limit, offset)
        )
        rows = self._run(shard, sql)
        for row in rows:
            if len(row) > 3:
                row[3] = _decode_message_content(row[3])
        self._message_query_cache[cache_key] = (
            tr,
            self._message_database_state(shard),
            [list(row) for row in rows],
        )
        return rows

    def message_by_local_id(self, shard: str, table: str, local_id: int) -> Optional[list]:
        packed_column = self._packed_info_column(shard, table)
        packed_select = "hex(m.%s)" % packed_column if packed_column else "NULL"
        sql = (
            "SELECT local_id, create_time, real_sender_id, hex(message_content), local_type, "
            "(SELECT user_name FROM Name2Id WHERE rowid = m.real_sender_id), %s "
            "FROM %s AS m WHERE local_id = %d" % (packed_select, table, local_id)
        )
        rows = self._run(shard, sql)
        if rows and len(rows[0]) > 3:
            rows[0][3] = _decode_message_content(rows[0][3])
        return rows[0] if rows else None

    def _packed_info_column(self, shard: str, table: str) -> Optional[str]:
        """Return the media metadata column when this WeChat schema provides it."""
        cache_key = (shard, table)
        columns = self._message_table_columns_cache.get(cache_key)
        if columns is None:
            columns = {
                str(row[1]) for row in self._run(shard, "PRAGMA table_info(%s)" % table)
                if len(row) > 1 and row[1]
            }
            self._message_table_columns_cache[cache_key] = columns
        for candidate in ("packed_info_data", "packed_info", "compress_content"):
            if candidate in columns:
                return candidate
        return None

    def distinct_senders(self, shard: str, table: str) -> List[int]:
        cache_key = (shard, table)
        database_state = self._message_database_state(shard)
        cached = self._distinct_sender_cache.get(cache_key)
        if cached and cached[0] == database_state:
            return list(cached[1])
        sql = "SELECT DISTINCT real_sender_id FROM %s WHERE real_sender_id IS NOT NULL" % table
        out = []
        for r in self._run(shard, sql):
            try:
                out.append(int(r[0]))
            except (ValueError, TypeError):
                continue
        self._distinct_sender_cache[cache_key] = (
            self._message_database_state(shard),
            list(out),
        )
        return out

    def sender_user_name(self, shard: str, real_sender_id: int) -> Optional[str]:
        cache_key = (shard, real_sender_id)
        if cache_key in self._sender_username_cache:
            return self._sender_username_cache[cache_key]
        sql = "SELECT user_name FROM Name2Id WHERE rowid = %d" % real_sender_id
        rows = self._run(shard, sql)
        username = rows[0][0] if rows and rows[0][0] else None
        self._sender_username_cache[cache_key] = username
        return username

    @staticmethod
    def _message_database_state(shard: str) -> tuple:
        """Cheap live-change token for a message shard and its SQLite WAL."""
        state = []
        for path in (shard, shard + "-wal"):
            try:
                stat = os.stat(path)
                state.append((stat.st_mtime_ns, stat.st_size))
            except FileNotFoundError:
                state.append(None)
        return tuple(state)

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
