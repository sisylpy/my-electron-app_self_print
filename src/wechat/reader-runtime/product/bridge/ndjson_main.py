"""Electron ←→ WechatLocalDataService 的 stdio NDJSON 适配进程。

用法：
    python -m product.bridge.ndjson_main

协议见同目录 protocol.md。要点：
- stdout 只输出 NDJSON（响应 / 事件），调试信息一律 stderr，绝不污染帧；
- Reader 的产品级错误码原样穿透；未预期异常收敛为 INTERNAL_ERROR；
- 返回值只含领域对象（ID 为 fp:<hash>），剔除任何可能带路径/内部标识的字段。
"""
import json
import sys
import traceback

# Increment whenever the standalone Reader must be rebuilt to match a new
# Electron-side contract. Version 2 includes Windows V2 image-key discovery.
BRIDGE_VERSION = "2"


def _log(msg, level="info"):
    """调试日志走 stderr，避免污染 stdout 的 NDJSON 帧。"""
    sys.stderr.write("[bridge:%s] %s\n" % (level, msg))
    sys.stderr.flush()


def _build_service():
    """按平台选择 Driver：这是 Reader 内部唯一的平台分支点。"""
    from ..WechatLocalDataService import WechatLocalDataService

    if sys.platform == "darwin":
        from ..providers.mac.MacWechatDriver import MacWechatDriver

        return WechatLocalDataService(MacWechatDriver())
    from ..providers.windows.WindowsWechatDriver import WindowsWechatDriver

    return WechatLocalDataService(WindowsWechatDriver())


# ---------------------------------------------------------------- 序列化
def _iso(dt):
    return dt.isoformat() if dt is not None else None


def _acc(a):
    return {
        "id": a.id,
        "displayHint": a.displayHint,
        "isCurrentLogin": a.isCurrentLogin,
        "databaseCount": a.databaseCount,
        "hasAccessMaterial": a.hasAccessMaterial,
    }


def _conv(c):
    return {
        "id": c.id,
        "displayName": c.displayName,
        "kind": c.kind,
        "participantCount": c.participantCount,
        "lastMessageAt": _iso(c.lastMessageAt),
        "avatarUrl": c.avatarUrl,
    }


def _attachment(att):
    if att is None:
        return None
    # 只暴露 id / kind / mimeHint：localPath 可能含本机文件路径，禁止跨进程
    return {"id": att.id, "kind": att.kind, "mimeHint": att.mimeHint}


def _msg(m):
    return {
        "id": m.id,
        "conversationId": m.conversationId,
        "timestamp": _iso(m.timestamp),
        "senderId": m.senderId,
        "senderName": m.senderName,
        "type": m.type,
        "text": m.text,
        "attachmentRef": _attachment(m.attachmentRef),
        "source": m.source,
    }


def _participant(p):
    return {
        "id": p.id,
        "displayName": p.displayName,
        "isSelf": p.isSelf,
        "inAddressBook": p.inAddressBook,
    }


def _page(pr):
    return {"items": pr.items, "total": pr.total, "hasMore": pr.hasMore}


def _find(fr):
    return {"matches": [_conv(c) for c in fr.matches], "ambiguous": fr.ambiguous}


def _diagnose(d):
    return {
        "ready": d.ready,
        "fingerprint": {
            "os": d.fingerprint.os,
            "arch": d.fingerprint.arch,
            "wechatInstalled": d.fingerprint.wechatInstalled,
            "wechatVersion": d.fingerprint.wechatVersion,
            "compatibilityStatus": d.fingerprint.compatibilityStatus,
        },
        "capabilities": [
            {"name": c.name, "available": c.available, "detail": c.detail}
            for c in d.capabilities
        ],
        "missingEvidence": list(d.missingEvidence),
        "suggestedActions": list(d.suggestedActions),
    }


# ---------------------------------------------------------------- 错误
def _error_payload(err):
    e = err.error
    return {
        "code": e.code.value if hasattr(e.code, "value") else str(e.code),
        "message": e.message,
        "retryable": e.retryable,
        "needsReinit": e.needsReinit,
        "needsUserAction": e.needsUserAction,
        "userAction": e.userAction,
        "diagnosticId": e.diagnosticId,
    }


def _internal_error(diagnostic_id):
    return {
        "code": "INTERNAL_ERROR",
        "message": "读取本地微信数据时发生内部错误。",
        "retryable": True,
        "needsReinit": False,
        "needsUserAction": False,
        "userAction": None,
        "diagnosticId": diagnostic_id,
    }


# ---------------------------------------------------------------- 分发
def _dispatch(svc, method, params):
    p = params or {}

    if method == "diagnose":
        return _diagnose(svc.diagnose())
    if method == "listAccounts":
        return [_acc(a) for a in svc.listAccounts(bool(p.get("warmMessages")))]
    if method == "findConversation":
        return _find(svc.findConversation(p["accountId"], p["name"]))
    if method == "getMessages":
        pr = svc.getMessages(p["conversationId"], _tr(p.get("timeRange")), _pg(p.get("page")))
        return _page_result_messages(pr)
    if method == "searchMessages":
        pr = svc.searchMessages(
            p["conversationId"], p["query"], _tr(p.get("timeRange")), _pg(p.get("page"))
        )
        return _page_result_messages(pr)
    if method == "getParticipants":
        return [
            _participant(x)
            for x in svc.getParticipants(p["conversationId"], bool(p.get("selfOnly")))
        ]
    if method == "getAttachment":
        # This envelope is consumed only by Electron's main process. It contains
        # no filesystem path or raw account identifier.
        return svc.getAttachment(p["attachmentId"])
    if method == "resolveSender":
        return _participant(svc.resolveSender(p["messageId"]))
    if method == "listConversations":
        pr = svc.listConversations(p["account"], p.get("kind"), _pg(p.get("page")))
        return {"items": [_conv(c) for c in pr.items], "total": pr.total, "hasMore": pr.hasMore}
    if method == "ping":
        return {"ok": True}
    if method == "shutdown":
        return {"ok": True, "shuttingDown": True}

    raise KeyError(method)


def _page_result_messages(pr):
    return {"items": [_msg(m) for m in pr.items], "total": pr.total, "hasMore": pr.hasMore}


def _tr(v):
    from ..domain import TimeRange

    if not v:
        return None
    return TimeRange(start=v.get("start"), end=v.get("end"))


def _pg(v):
    from ..domain import Page

    if not v:
        return Page()
    return Page(offset=int(v.get("offset") or 0), limit=int(v.get("limit") or 50))


# ---------------------------------------------------------------- 主循环
def main():
    from ..errors.codes import WechatServiceError

    # PyInstaller executables on Simplified Chinese Windows inherit the console
    # code page (normally GBK) even when stdout/stderr are redirected to pipes.
    # NDJSON is an UTF-8 protocol; force both streams before emitting nicknames
    # or message text so emoji and other non-GBK characters cannot crash the
    # bridge with UnicodeEncodeError.
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8", errors="strict", newline=None)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="strict", newline="\n")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace", newline="\n")

    svc = _build_service()
    _emit({"event": "ready", "version": BRIDGE_VERSION, "platform": sys.platform})

    shutting_down = False
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            # 无法定位到具体 id：只记 stderr，不响应（避免阻塞等待）
            _log("malformed request line ignored", level="warn")
            continue

        req_id = req.get("id")
        method = req.get("method")
        try:
            result = _dispatch(svc, method, req.get("params"))
            _emit({"id": req_id, "ok": True, "result": result})
            if method == "shutdown":
                shutting_down = True
                break
        except WechatServiceError as e:
            # 产品级错误码原样穿透
            _emit({"id": req_id, "ok": False, "error": _error_payload(e)})
        except KeyError as e:
            _emit(
                {
                    "id": req_id,
                    "ok": False,
                    "error": dict(
                        _internal_error("unknown-method"),
                        message="未知的读取方法：%s" % (e.args[0] if e.args else "?"),
                        code="INTERNAL_ERROR",
                    ),
                }
            )
        except Exception:
            # 细节只进 stderr，绝不回传上层
            _log("unexpected error:\n" + traceback.format_exc(), level="error")
            _emit({"id": req_id, "ok": False, "error": _internal_error("unexpected")})

    if not shutting_down:
        _log("stdin closed, exiting")
    return 0


def _emit(obj):
    # ASCII-only JSON is transport-safe even if a frozen Windows runtime or a
    # parent shell overrides the console code page. JSON consumers restore the
    # escaped Unicode text losslessly.
    sys.stdout.write(json.dumps(obj, ensure_ascii=True) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    raise SystemExit(main())
