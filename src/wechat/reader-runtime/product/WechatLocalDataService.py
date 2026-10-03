"""WechatLocalDataService —— 唯一对 Electric 暴露的入口（合同 8 方法）。

设计要点（严格遵循 docs/15-p5-product-contract.md）：
- 只读：所有读方法可安全重试；底层一律 SQLITE_OPEN_READONLY。
- 信息隔离：调用方只拿到领域对象 + 产品级错误码；
  wxid / @chatroom / Msg_<hash> / DB 路径 / passphrase 绝不出现在返回值里。
- 内部 ID 为 fp:<hash> 指纹，稳定且不可逆推出原始标识。
- 材料缓存键为 (machine, account)，由 Driver.acquire 返回的不透明 AccessMaterial 承载。
"""
import hashlib
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .domain import (
    AccountId,
    AttachmentId,
    AttachmentRef,
    Capability,
    Conversation,
    ConversationId,
    DiagnoseResult,
    EnvironmentFingerprint,
    FindResult,
    Message,
    MessageId,
    Page,
    PageResult,
    Participant,
    ParticipantId,
    TimeRange,
    WechatAccount,
)
from .errors.codes import ErrorCode, ServiceError, WechatServiceError
from .providers.DatabaseAccessProvider import AccessMaterial, AccountMeta, DatabaseAccessProvider
from .providers.common import WechatReadOnlyDB, _iso_to_epoch
from .attachments import build_image_envelope


def _hex(s: str, n: int) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def _fp(s: str, n: int = 16) -> str:
    return "fp:" + _hex(s, n)


def _kind_of(username: str) -> str:
    if username.endswith("@chatroom"):
        return "group"
    if username.startswith("gh_"):
        return "official"
    return "direct"


def _msg_type(local_type: int) -> str:
    return {
        1: "text",
        3: "image",
        34: "voice",
        43: "video",
        47: "image",
        49: "file",
        10000: "system",
        10002: "system",
    }.get(local_type, "unknown")


def _visible_message_text(content: str, conversation_kind: str, sender_username: Optional[str]) -> str:
    """Remove WeChat's group-message sender envelope from user-visible text.

    WCDB stores a group text message as ``<sender username>:\n<body>`` even though
    the sender is also available through ``real_sender_id``.  The prefix is
    transport metadata, not order content, and may contain a raw wxid.  Strip
    only the exact resolved sender prefix so ordinary text such as ``规格:\n...``
    is preserved.
    """
    text = content or ""
    if conversation_kind != "group" or not sender_username:
        return text
    prefix = sender_username + ":"
    if not text.startswith(prefix):
        return text
    remainder = text[len(prefix):]
    if remainder.startswith("\r\n"):
        return remainder[2:]
    if remainder.startswith("\n"):
        return remainder[1:]
    return text


class _ConversationMeta:
    __slots__ = ("account_id", "username", "kind")

    def __init__(self, account_id: AccountId, username: str, kind: str):
        self.account_id = account_id
        self.username = username
        self.kind = kind


class WechatLocalDataService:
    def __init__(self, provider: DatabaseAccessProvider):
        self._provider = provider
        self._accounts: Dict[AccountId, AccountMeta] = {}
        self._conv_index: Dict[ConversationId, _ConversationMeta] = {}
        self._materials: Dict[AccountId, AccessMaterial] = {}
        self._databases: Dict[AccountId, WechatReadOnlyDB] = {}
        self._attachment_index: Dict[str, dict] = {}
        # 连续分页必须复用同一份会话快照，否则每页都会重新扫描数千联系人。
        self._conv_snapshot: Dict[str, Tuple[float, List[Tuple[_ConversationMeta, Conversation]]]] = {}
        self._conv_snapshot_ttl = 10.0

    # ===================== diagnose =====================
    def diagnose(self) -> DiagnoseResult:
        fp = self._provider.detect_environment()
        accounts = self._provider.detect_accounts() if fp.wechatInstalled else []
        any_material = any(a.has_material for a in accounts)
        caps = [
            Capability("wechat_installed", fp.wechatInstalled),
            Capability("account_detection", len(accounts) > 0,
                       detail="检测到 %d 个账号" % len(accounts) if accounts else None),
            Capability("access_material", any_material,
                       detail="存在可用访问材料" if any_material else "无可用访问材料"),
        ]
        missing: List[str] = []
        actions: List[str] = []
        if not fp.wechatInstalled:
            missing.append("WECHAT_NOT_INSTALLED")
            actions.append("请安装并登录微信")
        if not any_material:
            missing.append("CUSTOMER_MACHINE_ACCESS_ACQUISITION=NOT_RESOLVED")
            actions.append("在已获取材料的本机上注入 keyfile；客户机取材料流程尚未产品化")
        ready = fp.wechatInstalled and len(accounts) > 0
        return DiagnoseResult(
            fingerprint=fp,
            capabilities=caps,
            missingEvidence=missing,
            suggestedActions=actions,
            ready=ready,
        )

    # ===================== listAccounts =====================
    def listAccounts(self, warmMessages: bool = False) -> List[WechatAccount]:
        self._ensure_accounts()
        out = []
        for meta in self._accounts.values():
            # 有访问材料时，从本账号的只读 contact 库取微信昵称作为友好展示名。
            # 查询失败或当前账号无材料时继续使用不可逆指纹，不暴露原始 wxid。
            display_hint = meta.display_hint
            if meta.has_material:
                try:
                    nick = self._db_for(meta).contact_nick(meta.wxid)
                    if nick and nick.strip():
                        display_hint = nick.strip()
                except WechatServiceError:
                    pass
            out.append(
                WechatAccount(
                    id=meta.account_id,
                    displayHint=display_hint,
                    isCurrentLogin=None,
                    databaseCount=self._count_dbs(meta.db_root),
                    hasAccessMaterial=meta.has_material,
                )
            )
        if warmMessages:
            # The launcher calls this without awaiting it. Warming only the
            # shard/table index overlaps the user's choice of read mode and
            # removes the largest cold-start cost from the later order read.
            for meta in self._accounts.values():
                if not meta.has_material:
                    continue
                try:
                    self._db_for(meta).warm_message_index()
                except WechatServiceError:
                    # A secondary account with stale material must not block the
                    # usable current account or the regular error path.
                    continue
        return out

    # ===================== listConversations =====================
    def listConversations(
        self, account: AccountId, kind: Optional[str] = None, page: Page = Page()
    ) -> PageResult[Conversation]:
        acct = self._account_meta(account)
        pairs = self._conversations_snapshot(acct)
        convs = [c for (_, c) in pairs]
        if kind:
            convs = [c for c in convs if c.kind == kind]
        total = len(convs)
        has_more = page.offset + page.limit < total
        return PageResult(
            items=convs[page.offset: page.offset + page.limit],
            total=total,
            hasMore=has_more,
        )

    # ===================== findConversation =====================
    def findConversation(self, account: AccountId, name: str) -> FindResult:
        acct = self._account_meta(account)
        db = self._db_for(acct)
        matches: List[Conversation] = []
        for username, nick, remark, _lt in db.contact_rows():
            if name.lower() in (nick or "").lower() or name.lower() in (remark or "").lower():
                cid = ConversationId(_fp(username))
                self._conv_index[cid] = _ConversationMeta(acct.account_id, username, _kind_of(username))
                last = db.session_last_time(username)
                matches.append(
                    Conversation(
                        id=cid,
                        displayName=nick or username,
                        kind=_kind_of(username),
                        participantCount=None,
                        lastMessageAt=datetime.fromtimestamp(last).astimezone() if last else None,
                    )
                )
        if not matches:
            raise WechatServiceError(
                ServiceError(ErrorCode.CONVERSATION_NOT_FOUND, "未找到匹配的会话：%s" % name)
            )
        return FindResult(matches=matches, ambiguous=len(matches) > 1)

    # ===================== getMessages =====================
    def getMessages(
        self,
        conversation: ConversationId,
        timeRange: Optional[TimeRange] = None,
        page: Page = Page(),
    ) -> PageResult[Message]:
        return self._read_messages(conversation, timeRange, page, like=None)

    # ===================== searchMessages =====================
    def searchMessages(
        self,
        conversation: ConversationId,
        query: str,
        timeRange: Optional[TimeRange] = None,
        page: Page = Page(),
    ) -> PageResult[Message]:
        return self._read_messages(conversation, timeRange, page, like=query)

    # ===================== getParticipants =====================
    def getParticipants(
        self,
        conversation: ConversationId,
        selfOnly: bool = False,
    ) -> List[Participant]:
        meta = self._conv_meta(conversation)
        acct = self._account_meta(meta.account_id)
        db = self._db_for(acct)
        # The current account may have no outgoing row in a newly-created
        # direct chat, but renderer policy still needs a stable self identity
        # to reject outgoing messages. Seed it explicitly from account metadata.
        self_nick = db.contact_nick(acct.wxid) or "(当前微信账号)"
        seen = {acct.wxid}
        parts: List[Participant] = [
            Participant(
                id=ParticipantId(_fp(acct.wxid)),
                displayName=self_nick,
                isSelf=True,
                inAddressBook=True,
            )
        ]
        if selfOnly:
            return parts
        if meta.kind == "direct":
            friend_nick = db.contact_nick(meta.username)
            parts.append(
                Participant(
                    id=ParticipantId(_fp(meta.username)),
                    displayName=friend_nick or meta.username,
                    isSelf=False,
                    inAddressBook=(friend_nick is not None),
                )
            )
            return parts

        locations = db.locate_message_table(meta.username)
        for shard, table in locations:
            for rid in db.distinct_senders(shard, table):
                uname = db.sender_user_name(shard, rid)
                sender_key = uname or "rid:%d" % rid
                if sender_key in seen:
                    continue
                seen.add(sender_key)
                nick = db.contact_nick(uname) if uname else None
                display = nick or uname or "(未知)"
                pid = ParticipantId(_fp(uname)) if uname else ParticipantId(_fp("rid:%d" % rid))
                parts.append(
                    Participant(
                        id=pid,
                        displayName=display,
                        isSelf=(uname == acct.wxid),
                        inAddressBook=(nick is not None),
                    )
                )
        return parts

    # ===================== resolveSender =====================
    def resolveSender(self, message: MessageId) -> Participant:
        # MessageId = "<ConversationId>:<local_id>"；ConversationId 本身含 ':'，故从右侧切分
        cid, _, local_id_s = message.rpartition(":")
        if not local_id_s:
            raise WechatServiceError(
                ServiceError(ErrorCode.INTERNAL_ERROR, "无效的消息 ID", diagnosticId="resolveSender")
            )
        meta = self._conv_meta(ConversationId(cid))
        acct = self._account_meta(meta.account_id)
        db = self._db_for(acct)
        local_id = int(local_id_s)
        for shard, table in db.locate_message_table(meta.username):
            row = db.message_by_local_id(shard, table, local_id)
            if not row:
                continue
            rid = int(row[2] or 0)
            uname = db.sender_user_name(shard, rid)
            nick = db.contact_nick(uname) if uname else None
            display = nick or uname or "(未知)"
            pid = ParticipantId(_fp(uname)) if uname else ParticipantId(_fp("rid:%d" % rid))
            return Participant(
                id=pid,
                displayName=display,
                isSelf=(uname == acct.wxid),
                inAddressBook=(nick is not None),
            )
        raise WechatServiceError(
            ServiceError(ErrorCode.INTERNAL_ERROR, "无法解析消息发送者", diagnosticId="resolveSender")
        )

    def getAttachment(self, attachment_id: AttachmentId) -> dict:
        """Return an encrypted image envelope for main-process-only decoding."""
        record = self._attachment_index.get(str(attachment_id))
        if not record or record.get("kind") != "image":
            raise WechatServiceError(ServiceError(ErrorCode.NO_DATA, "没有找到对应的微信图片，请重新读取消息。"))
        acct = self._account_meta(record["account_id"])
        return build_image_envelope(
            acct.db_root,
            acct.wxid,
            record["conversation_username"],
            record.get("packed_hex"),
        )

    # ===================== 内部 =====================
    def _read_messages(
        self, conversation: ConversationId, timeRange, page: Page, like: Optional[str]
    ) -> PageResult[Message]:
        meta = self._conv_meta(conversation)
        acct = self._account_meta(meta.account_id)
        # The DB wrapper keeps only metadata/contact indexes; message rows are
        # always queried live. Reusing it avoids re-scanning every message shard
        # for every customer and every stabilization retry.
        db = self._db_for(acct)
        tr = (_iso_to_epoch(timeRange.start) if timeRange else None,
              _iso_to_epoch(timeRange.end) if timeRange else None)
        pairs: List[Tuple[str, list]] = []
        fetch_limit = page.offset + page.limit + 1
        locations = db.locate_message_table(meta.username)
        for shard, table in locations:
            rows = db.query_messages(shard, table, tr, limit=fetch_limit, offset=0, like=like)
            for r in rows:
                pairs.append((shard, r))
        pairs.sort(key=lambda p: int(p[1][1] or 0), reverse=True)
        has_more = len(pairs) > page.offset + page.limit
        total = (
            sum(db.count_messages(shard, table, tr, like=like) for shard, table in locations)
            if has_more else len(pairs)
        )
        sliced = pairs[page.offset: page.offset + page.limit]
        items = [
            self._to_message(conversation, meta.kind, acct.wxid, db, shard, row)
            for shard, row in sliced
        ]
        return PageResult(items=items, total=total, hasMore=has_more)

    def _to_message(
        self, conv_id: ConversationId, conversation_kind: str, account_wxid: str,
        db: WechatReadOnlyDB,
        shard: str, row: list,
    ) -> Message:
        local_id = int(row[0] or 0)
        create_time = int(row[1] or 0)
        rid = int(row[2] or 0)
        content = row[3] or ""
        local_type = int(row[4] or 0)
        mtype = _msg_type(local_type)
        uname = row[5] if len(row) > 5 and row[5] else db.sender_user_name(shard, rid)
        nick = db.contact_nick(uname) if uname else None
        sender_name = nick or uname or "(未知)"
        pid = ParticipantId(_fp(uname)) if uname else ParticipantId(_fp("rid:%d" % rid))
        text = (
            _visible_message_text(content, conversation_kind, uname)
            if mtype == "text" else ""
        )
        att: Optional[AttachmentRef] = None
        if mtype != "text":
            att = AttachmentRef(id=AttachmentId(_fp("%s:%d" % (conv_id, local_id))), kind=mtype)
            self._attachment_index[str(att.id)] = {
                "kind": mtype,
                "account_id": self._conv_meta(conv_id).account_id,
                "conversation_username": self._conv_meta(conv_id).username,
                "packed_hex": row[-1] if len(row) > 5 else None,
            }
        return Message(
            id=MessageId("%s:%d" % (conv_id, local_id)),
            conversationId=conv_id,
            timestamp=datetime.fromtimestamp(create_time).astimezone(),
            senderId=pid,
            senderName=sender_name,
            type=mtype,
            text=text,
            attachmentRef=att,
            source="local_wechat_db",
        )

    def _conversations_snapshot(self, acct: AccountMeta) -> List[Tuple[_ConversationMeta, Conversation]]:
        # 第 1 页构建完整元数据，随后分页只切片；不缓存消息正文，10 秒后自动重建。
        now = time.time()
        cached = self._conv_snapshot.get(acct.account_id)
        if cached is not None and (now - cached[0]) < self._conv_snapshot_ttl:
            return cached[1]
        pairs = self._conversations_for_account(acct)
        self._conv_snapshot[acct.account_id] = (now, pairs)
        return pairs

    def _conversations_for_account(self, acct: AccountMeta) -> List[Tuple[_ConversationMeta, Conversation]]:
        db = self._db_for(acct)
        out = []
        for username, nick, remark, _lt in db.contact_rows():
            cid = ConversationId(_fp(username))
            self._conv_index[cid] = _ConversationMeta(acct.account_id, username, _kind_of(username))
            last = db.session_last_time(username)
            out.append(
                (
                    self._conv_index[cid],
                    Conversation(
                        id=cid,
                        displayName=nick or username,
                        kind=_kind_of(username),
                        participantCount=None,
                        lastMessageAt=datetime.fromtimestamp(last).astimezone() if last else None,
                    ),
                )
            )
        return out

    def _ensure_accounts(self) -> List[AccountMeta]:
        if not self._accounts:
            for a in self._provider.detect_accounts():
                self._accounts[a.account_id] = a
        return list(self._accounts.values())

    def _account_meta(self, account_id: AccountId) -> AccountMeta:
        self._ensure_accounts()
        if account_id not in self._accounts:
            raise WechatServiceError(
                ServiceError(ErrorCode.NO_ACCOUNT, "未找到账号：%s" % account_id)
            )
        return self._accounts[account_id]

    def _conv_meta(self, conv_id: ConversationId) -> _ConversationMeta:
        if conv_id in self._conv_index:
            return self._conv_index[conv_id]
        # 按需反查：只读一次 contact（单条查询），比对指纹即可定位会话。
        # 不要走 _conversations_for_account —— 它会对每个联系人单独查一次 session
        # （每个联系人一次子进程调用，数千联系人会直接超时）。
        for acct in self._ensure_accounts():
            # 多账号场景下，没有材料的账号取不到 AccessMaterial：跳过继续找
            try:
                db = self._db_for(acct)
                rows = db.contact_rows()
            except WechatServiceError:
                continue
            for username, _nick, _remark, _lt in rows:
                if ConversationId(_fp(username)) == conv_id:
                    meta = _ConversationMeta(acct.account_id, username, _kind_of(username))
                    self._conv_index[conv_id] = meta
                    return meta
        raise WechatServiceError(
            ServiceError(ErrorCode.CONVERSATION_NOT_FOUND, "未找到会话：%s" % conv_id)
        )

    def _acquire(self, acct: AccountMeta) -> AccessMaterial:
        if acct.account_id in self._materials:
            return self._materials[acct.account_id]
        mat = self._provider.acquire(acct.account_id)
        self._materials[acct.account_id] = mat
        return mat

    def _db_for(self, acct: AccountMeta) -> WechatReadOnlyDB:
        db = self._databases.get(acct.account_id)
        if db is None:
            db = WechatReadOnlyDB(self._acquire(acct))
            self._databases[acct.account_id] = db
        return db

    @staticmethod
    def _count_dbs(db_root: str) -> Optional[int]:
        import glob
        files = glob.glob(os.path.join(db_root, "**", "*.db"), recursive=True)
        return len(files)
