from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

import numpy as np

from ..coordinates import Point
from ..mouse import click, set_clipboard, paste_clipboard, press_return
from ..screenshot import Screenshot, capture_window
from ..vision import OCRItem, find_text, recognize_text, save_ocr
from ..window import WeChatWindow, activate_wechat, main_wechat_window
from ..state_detector import exact_chat_header
from ..results import OperationResult, ResultCode


class SendMessageFlow:
    """Send one text message to a personal WeChat contact.

    Two safe entry paths:
    1. WeChat is already parked on the target personal chat (same precondition
       as ``add_contact_tag``). The flow verifies the current chat header with
       an exact match.
    2. If the current chat is not the target, attempt a *safe* switch via the
       left conversation list: only when exactly one list item is an exact
       match for ``target`` (no substring, no fuzzy), click it, then re-verify
       the header with ``exact_chat_header``. A group whose title merely
       contains the target (``金调料、Fangfang``) is never matched, and if a
       click happens to open the wrong conversation the re-verify fails and the
       flow stops without sending.

    Message text always goes through the clipboard + Cmd+V (never keystrokes).
    """

    def __init__(
        self,
        *,
        target: str,
        text: str,
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        self.target = target.strip()
        self.text = text
        self.artifact_root = artifact_root
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self._counter = 0
        self._window: WeChatWindow | None = None
        self._send_point: Point | None = None
        self.report: dict[str, str] = {
            "TARGET_MATCH": "FAIL",
            "MESSAGE_PASTED": "FAIL",
            "SEND_EXECUTED": "FAIL",
            "SEND_VERIFIED": "FAIL",
        }
        self.details: list[str] = []
        # 一个稳定的子串探针，用于 OCR / 像素验证。
        self._probe = self.text if len(self.text) <= 6 else self.text[:5]

    # ---- helpers (all built on the shared infrastructure) ----
    def _next_path(self, name: str) -> Path:
        self._counter += 1
        return self.artifact_dir / f"{self._counter:02d}-{name}.png"

    def _read(self, shot: Screenshot) -> list[OCRItem]:
        items = recognize_text(shot.path, shot.image.size)
        save_ocr(items, shot.path.with_suffix(".ocr.json"))
        return items

    def _window_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        if self._window is None:
            self._window = main_wechat_window()
        shot = capture_window(self._window.bounds, self._next_path(name))
        return shot, self._read(shot)

    @staticmethod
    def _region_hits(items: list[OCRItem], probe: str, ymin: float, ymax: float) -> list[OCRItem]:
        return [
            it
            for it in find_text(items, probe, exact=False)
            if ymin <= it.rect.center.y <= ymax
        ]

    @staticmethod
    def _pixel_change(a: Screenshot, b: Screenshot, ymin: float, ymax: float, thr: int = 30) -> int:
        ia = np.asarray(a.image.convert("RGB")).astype(int)
        ib = np.asarray(b.image.convert("RGB")).astype(int)
        h = min(ia.shape[0], ib.shape[0])
        y0 = int(h * ymin)
        y1 = int(h * ymax)
        if y1 <= y0:
            return 0
        diff = np.abs(ia[y0:y1] - ib[y0:y1]).sum(axis=2)
        return int((diff > thr).sum())

    def _header_matches(self, items: list[OCRItem], w: int, h: int) -> bool:
        return exact_chat_header(items, self.target, image_width=w, image_height=h).matched

    def _try_open_via_list(self) -> bool:
        """Return True only if exactly one exact list item was clicked and the
        resulting chat header exactly matches the target."""
        shot, items = self._window_shot("list-scan")
        w = shot.image.width
        h = shot.image.height
        candidates = [
            it
            for it in find_text(items, self.target, exact=True)
            if it.rect.x < w * 0.45 and h * 0.12 <= it.rect.center.y <= h * 0.99
        ]
        self.details.append(f"LIST_CANDIDATES={len(candidates)}")
        if len(candidates) != 1:
            return False
        item = candidates[0]
        click(shot.transform.physical_to_global_logical(item.rect.center), 0.8)
        time.sleep(0.9)
        self._window = main_wechat_window()
        reopened, reopened_items = self._window_shot("chat-after-list-open")
        rw = reopened.image.width
        rh = reopened.image.height
        if self._header_matches(reopened_items, rw, rh):
            return True
        self.details.append("LIST_OPEN_HEADER_MISMATCH (likely wrong conversation, not sending)")
        return False

    # ---- main flow ----
    def run(self) -> OperationResult:
        code = ResultCode.INTERNAL_ERROR
        message = "未完成"
        try:
            activate_wechat()
            self._window = main_wechat_window()
            baseline_shot, items = self._window_shot("chat-baseline")
            h = baseline_shot.image.height
            w = baseline_shot.image.width

            if not self._header_matches(items, w, h):
                opened = self._try_open_via_list()
                if not opened:
                    n = 0
                    for d in self.details:
                        if d.startswith("LIST_CANDIDATES="):
                            try:
                                n = int(d.split("=")[1])
                            except ValueError:
                                n = 0
                    code = ResultCode.TARGET_AMBIGUOUS if n > 1 else ResultCode.TARGET_NOT_FOUND
                    message = (
                        f"无法唯一确认精确联系人 {self.target!r}；"
                        f"不模糊匹配、不选择群聊"
                    )
                    return self._finish(code, message)
                # 切换成功，刷新基线用于后续粘贴对比
                self._window = main_wechat_window()
                baseline_shot, items = self._window_shot("chat-after-open")
                h = baseline_shot.image.height
                w = baseline_shot.image.width
                if not self._header_matches(items, w, h):
                    code = ResultCode.TARGET_NOT_FOUND
                    message = f"切换会话后聊天标题仍不是精确联系人 {self.target!r}；已停止，未发送"
                    self.details.append("HEADER_MISMATCH_AFTER_LIST_OPEN")
                    return self._finish(code, message)
            self.report["TARGET_MATCH"] = "PASS"

            # 定位发送按钮（底部、偏右）；找不到则退回 Enter 发送。
            send_btn = [
                it
                for it in find_text(items, "发送", exact=True)
                if it.rect.y > h * 0.8
            ]
            self._send_point = (
                baseline_shot.transform.physical_to_global_logical(send_btn[0].rect.center)
                if send_btn
                else None
            )

            # 聚焦输入框：基于窗口 bounds 推导的 global logical point（复用 window.py）。
            win = self._window.bounds
            ib_x = win.x + win.width * 0.5
            ib_y = win.y + win.height - max(40.0, win.height * 0.06)
            click(Point(ib_x, ib_y), 0.6)

            # 中文正文统一走剪贴板 + Cmd+V，绝不 keystroke 中文。
            set_clipboard(self.text)
            paste_clipboard(0.9)
            pasted_shot, pasted_items = self._window_shot("message-pasted")
            ph = pasted_shot.image.height
            ocr_hits = self._region_hits(pasted_items, self._probe, ph * 0.75, ph * 0.98)
            bottom_change = self._pixel_change(baseline_shot, pasted_shot, 0.75, 0.98)
            pasted_ok = bool(ocr_hits) or bottom_change > 300
            self.report["MESSAGE_PASTED"] = "PASS" if pasted_ok else "FAIL"
            if not pasted_ok:
                self.details.append("PASTE_VERIFY_WEAK: ocr+bottom-pixel both low")

            # 执行发送。
            if self._send_point is not None:
                click(self._send_point, 0.6)
            else:
                press_return(0.8)
            self.report["SEND_EXECUTED"] = "PASS"

            # SEND_VERIFIED：发送后聊天记录区域必须出现刚发的消息。
            sent_shot, sent_items = self._window_shot("after-send")
            sh = sent_shot.image.height
            chat_ocr = self._region_hits(sent_items, self._probe, sh * 0.15, sh * 0.82)
            chat_change = self._pixel_change(pasted_shot, sent_shot, 0.15, 0.82)
            if chat_ocr:
                self.report["SEND_VERIFIED"] = "PASS"
            elif chat_change > 800:
                self.report["SEND_VERIFIED"] = "PASS"
                self.details.append("SEND_VERIFIED by chat-region pixel change")
            elif chat_change > 200:
                self.report["SEND_VERIFIED"] = "PARTIAL"
                self.details.append(
                    "SEND_VERIFIED: chat pixel change present but text not OCR-detected"
                )
            else:
                self.report["SEND_VERIFIED"] = "FAIL"
                self.details.append("SEND_VERIFIED: no chat-region change detected")

            if self.report["SEND_VERIFIED"] == "FAIL":
                code = ResultCode.VERIFY_FAILED
                message = "执行了发送动作，但未能验证聊天中出现该消息"
            else:
                code = ResultCode.SUCCESS
                message = (
                    f"已向精确联系人 {self.target!r} 发送消息"
                    f"（SEND_VERIFIED={self.report['SEND_VERIFIED']}）"
                )
        except Exception as exc:  # pragma: no cover
            code = ResultCode.INTERNAL_ERROR
            message = "自动化内部错误；请查看私有诊断产物"
            self.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
        return self._finish(code, message)

    def _finish(self, code: ResultCode, message: str) -> OperationResult:
        self.details.append(f"RESULT: {code.value}")
        payload = {
            "code": code.value,
            "message": message,
            "target": self.target,
            "results": self.report,
            "details": self.details,
        }
        (self.artifact_dir / "report.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return OperationResult(
            code=code,
            action="send_message",
            target=self.target,
            message=message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.details),
            metrics=dict(self.report),
        )
