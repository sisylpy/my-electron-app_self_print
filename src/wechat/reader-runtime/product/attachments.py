"""Resolve encrypted WeChat image attachments without exposing local paths.

This module only runs inside the local Reader process.  It returns an opaque
encrypted payload plus account-local V2 key candidates to Electron's main
process, where Node's built-in crypto implementation performs the final image
decode.  Neither paths nor keys cross the preload boundary.
"""
import base64
import glob
import hashlib
import os
import re
from typing import Dict, List, Optional

from .errors.codes import ErrorCode, ServiceError, WechatServiceError


MAX_ENCRYPTED_ATTACHMENT_BYTES = 12 * 1024 * 1024
_MD5_MARKER = bytes.fromhex("12220a20")
_MD5_ASCII = re.compile(rb"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])")


def extract_media_md5(packed_hex: Optional[str]) -> Optional[str]:
    """Extract the media md5 from a message packed-info protobuf blob."""
    if not packed_hex:
        return None
    try:
        raw = bytes.fromhex(str(packed_hex))
    except (TypeError, ValueError):
        return None
    marker_at = raw.find(_MD5_MARKER)
    if marker_at >= 0:
        candidate = raw[marker_at + len(_MD5_MARKER): marker_at + len(_MD5_MARKER) + 32]
        if re.fullmatch(rb"[0-9a-f]{32}", candidate):
            return candidate.decode("ascii")
    match = _MD5_ASCII.search(raw)
    return match.group(0).decode("ascii") if match else None


def _attachment_root(db_root: str) -> str:
    return os.path.join(os.path.dirname(db_root), "msg", "attach")


def locate_image_dat(db_root: str, conversation_username: str, media_md5: str) -> Optional[str]:
    """Locate one exact media file under this conversation's attachment tree."""
    conversation_hash = hashlib.md5(conversation_username.encode("utf-8")).hexdigest()
    root = os.path.join(_attachment_root(db_root), conversation_hash)
    if not os.path.isdir(root):
        return None
    candidates = glob.glob(os.path.join(root, "**", "Img", media_md5 + "*.dat"), recursive=True)
    if not candidates:
        return None

    def rank(path: str):
        stem = os.path.splitext(os.path.basename(path))[0]
        if stem == media_md5:
            quality = 0
        elif stem == media_md5 + "_h":
            quality = 1
        elif stem == media_md5 + "_t":
            quality = 2
        else:
            quality = 3
        try:
            size_rank = -os.path.getsize(path)
        except OSError:
            size_rank = 0
        return quality, size_rank, path

    return sorted(candidates, key=rank)[0]


def _mac_v2_candidates(account_wxid: str) -> List[Dict[str, object]]:
    kvcomm = os.path.expanduser(
        "~/Library/Containers/com.tencent.xinWeChat/Data/Documents/app_data/net/kvcomm"
    )
    if not os.path.isdir(kvcomm):
        return []
    uins = set()
    for path in glob.glob(os.path.join(kvcomm, "**", "key_*_*.statistic"), recursive=True):
        match = re.match(r"key_(\d+)_", os.path.basename(path))
        if match:
            uins.add(int(match.group(1)))
    return [
        {
            "aesKey": hashlib.md5((str(uin) + account_wxid).encode("utf-8")).hexdigest()[:16],
            "xorKey": uin & 0xFF,
        }
        for uin in sorted(uins)
    ]


def build_image_envelope(
    db_root: str,
    account_wxid: str,
    conversation_username: str,
    packed_hex: Optional[str],
) -> Dict[str, object]:
    media_md5 = extract_media_md5(packed_hex)
    if not media_md5:
        raise WechatServiceError(ServiceError(
            ErrorCode.NO_DATA,
            "找到了图片消息，但无法定位本机图片文件。请先在微信中打开这张图片后重试。",
            retryable=True,
            needsUserAction=True,
            userAction="请在微信中点开图片原图，再重新获取消息",
        ))
    path = locate_image_dat(db_root, conversation_username, media_md5)
    if not path:
        raise WechatServiceError(ServiceError(
            ErrorCode.NO_DATA,
            "这张微信图片尚未下载到本机，请先在微信中打开图片后重试。",
            retryable=True,
            needsUserAction=True,
            userAction="请在微信中点开图片原图，再重新获取消息",
        ))
    try:
        size = os.path.getsize(path)
        if size <= 0 or size > MAX_ENCRYPTED_ATTACHMENT_BYTES:
            raise WechatServiceError(ServiceError(
                ErrorCode.NO_DATA,
                "微信图片为空或超过 12MB，暂时无法识别。",
            ))
        with open(path, "rb") as handle:
            encrypted = handle.read(MAX_ENCRYPTED_ATTACHMENT_BYTES + 1)
    except WechatServiceError:
        raise
    except OSError:
        raise WechatServiceError(ServiceError(
            ErrorCode.PERMISSION_REQUIRED,
            "无法读取微信图片，请检查文件访问权限后重试。",
            retryable=True,
            needsUserAction=True,
        ))
    if len(encrypted) != size:
        raise WechatServiceError(ServiceError(ErrorCode.NO_DATA, "微信图片读取不完整，请重试。", retryable=True))
    return {
        "encryptedBase64": base64.b64encode(encrypted).decode("ascii"),
        "v2Candidates": _mac_v2_candidates(account_wxid),
    }
