from __future__ import annotations

from collections.abc import Collection
from pathlib import Path

from .flows.add_contact_tag import AddContactTagFlow
from .flows.current_conversation import CurrentConversationFlow
from .flows.focus_conversation import FocusConversationFlow
from .flows.inspect_unread import InspectUnreadConversationsFlow
from .flows.send_message import SendMessageFlow
from .flows.read_unread import HydrationProbe, ReadUnreadConversationsFlow
from .results import OperationResult, ResultCode


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRIVATE_ARTIFACT_ROOT = PROJECT_ROOT / "artifacts" / "private"


def current_conversation(
    allowed_titles: Collection[str] | None = None,
    *,
    artifact_root: Path | None = None,
) -> OperationResult:
    """Identify the currently visible chat independently of customer bindings."""
    del allowed_titles  # Kept for CLI/backward compatibility; matching happens later.
    return CurrentConversationFlow(
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    ).run()


def focus_conversation(
    target: str,
    *,
    force_search: bool = False,
    artifact_root: Path | None = None,
) -> OperationResult:
    """Open one exact visible conversation without sending or changing data."""
    target = target.strip()
    if not target:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="focus_conversation",
            target=target,
            message="target 不能为空",
        )
    return FocusConversationFlow(
        target=target,
        force_search=force_search,
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    ).run()


def add_contact_tag(
    target: str,
    tag: str,
    *,
    artifact_root: Path | None = None,
) -> OperationResult:
    """Add one tag to the exact, already-open personal WeChat chat."""
    target = target.strip()
    tag = tag.strip()
    if not target or not tag:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="add_contact_tag",
            target=target,
            message="target 和 tag 均不能为空",
        )
    flow = AddContactTagFlow(
        contact=target,
        tag=tag,
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    )
    return flow.run()


def send_message(
    target: str,
    text: str,
    *,
    artifact_root: Path | None = None,
) -> OperationResult:
    """Send ``text`` to the exact, already-open personal WeChat contact.

    Precondition (identical to ``add_contact_tag``): WeChat must already be
    parked on the target personal contact's conversation. The flow verifies
    the current chat header with an exact match and refuses to send when the
    title is ambiguous (e.g. a group ``金调料、Fangfang`` is never matched by
    ``Fangfang``). It then pastes via the clipboard (Cmd+V, never keystrokes)
    and verifies the message appears in the chat history.
    """
    target = target.strip()
    text = text if text is None else text.strip()
    if not target or not text:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="send_message",
            target=target,
            message="target 和 text 均不能为空",
        )
    flow = SendMessageFlow(
        target=target,
        text=text,
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    )
    return flow.run()


def read_unread_conversations(
    *,
    max_pages: int = 8,
    dwell_seconds: float = 1.8,
    hydration_probe: HydrationProbe | None = None,
    hydration_timeout: float = 8.0,
    allowed_titles: Collection[str] | None = None,
    artifact_root: Path | None = None,
) -> OperationResult:
    """Bring WeChat forward and visibly open unread conversations in order.

    Each row is snapshotted before clicking and its opened header is matched
    exactly.  ``hydration_probe`` is the integration seam for a structured
    local-message Reader; screenshots are never treated as order text.
    ``allowed_titles`` should contain exact customer-bound friend/group names;
    unrelated unread rows remain untouched.
    """
    if max_pages < 1 or max_pages > 200:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="read_unread_conversations",
            target="wechat_unread",
            message="max_pages 必须在 1 到 200 之间",
        )
    if dwell_seconds < 0.5 or dwell_seconds > 30:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="read_unread_conversations",
            target="wechat_unread",
            message="dwell_seconds 必须在 0.5 到 30 秒之间",
        )
    if hydration_timeout < 0.5 or hydration_timeout > 120:
        return OperationResult(
            code=ResultCode.INVALID_ARGUMENT,
            action="read_unread_conversations",
            target="wechat_unread",
            message="hydration_timeout 必须在 0.5 到 120 秒之间",
        )
    flow = ReadUnreadConversationsFlow(
        max_pages=max_pages,
        dwell_seconds=dwell_seconds,
        hydration_probe=hydration_probe,
        hydration_timeout=hydration_timeout,
        allowed_titles=allowed_titles,
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    )
    return flow.run()


def inspect_unread_conversations(
    *,
    allowed_titles: Collection[str],
    artifact_root: Path | None = None,
) -> OperationResult:
    """Count bound unread chats without opening or marking any chat as read."""
    return InspectUnreadConversationsFlow(
        allowed_titles=allowed_titles,
        artifact_root=artifact_root or DEFAULT_PRIVATE_ARTIFACT_ROOT,
    ).run()
