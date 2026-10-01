from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from ..locators.avatar import AvatarCandidate, locate_avatar_candidates
from ..locators.chat_info import locate_chat_info_button
from ..locators.save_button import locate_save_button
from ..locators.tag_row import locate_tag_row
from ..mouse import click, paste_clipboard, press_escape, set_clipboard
from ..screenshot import Screenshot, capture_main_display, capture_window
from ..state_detector import (
    chat_info_panel,
    editor_scoped_text,
    exact_chat_header,
    extract_profile_tags,
    profile,
    profile_tag_visible,
    tag_editor,
    text_visible,
)
from ..vision import OCRItem, recognize_text, save_ocr
from ..results import OperationResult, ResultCode
from ..window import (
    WeChatWindow,
    activate_wechat,
    close_auxiliary_window,
    list_wechat_windows,
    main_wechat_window,
)


class FlowFailure(RuntimeError):
    def __init__(self, code: ResultCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.business_message = message


@dataclass
class FlowReport:
    values: dict[str, str] = field(
        default_factory=lambda: {
            "CHAT_INFO_LOCATOR": "FAIL",
            "AVATAR_LOCATOR": "FAIL",
            "AVATAR_FALSE_POSITIVE_RECOVERY": "PASS",
            "PROFILE_STATE_DETECTOR": "FAIL",
            "TAG_ROW_LOCATOR": "FAIL",
            "TAG_EDITOR_OPENED": "FAIL",
            "TAG_PASTED": "FAIL",
            "SAVE_EXECUTED": "FAIL",
            "PROFILE_REOPENED": "FAIL",
            "TAG_VISIBLE_AFTER_REOPEN": "NO",
            "EXISTING_TAGS_PRESERVED": "NO",
            "ADD_CONTACT_TAG": "FAIL",
        }
    )
    details: list[str] = field(default_factory=list)
    result_code: ResultCode = ResultCode.INTERNAL_ERROR
    message: str = "流程尚未完成"

    def pass_step(self, key: str, detail: str | None = None) -> None:
        self.values[key] = (
            "YES" if key in {"TAG_VISIBLE_AFTER_REOPEN", "EXISTING_TAGS_PRESERVED"} else "PASS"
        )
        if detail:
            self.details.append(f"{key}: {detail}")

    def fail_step(self, key: str, detail: str | None = None) -> None:
        self.values[key] = (
            "NO" if key in {"TAG_VISIBLE_AFTER_REOPEN", "EXISTING_TAGS_PRESERVED"} else "FAIL"
        )
        if detail:
            self.details.append(f"{key}: {detail}")

    def finish(self) -> None:
        self.values["ADD_CONTACT_TAG"] = (
            "PASS"
            if self.values["TAG_VISIBLE_AFTER_REOPEN"] == "YES"
            and self.values["EXISTING_TAGS_PRESERVED"] == "YES"
            else "FAIL"
        )

    def lines(self) -> list[str]:
        order = (
            "CHAT_INFO_LOCATOR",
            "AVATAR_LOCATOR",
            "AVATAR_FALSE_POSITIVE_RECOVERY",
            "PROFILE_STATE_DETECTOR",
            "TAG_ROW_LOCATOR",
            "TAG_EDITOR_OPENED",
            "TAG_PASTED",
            "SAVE_EXECUTED",
            "PROFILE_REOPENED",
            "TAG_VISIBLE_AFTER_REOPEN",
            "EXISTING_TAGS_PRESERVED",
            "ADD_CONTACT_TAG",
        )
        return [f"{key} = {self.values[key]}" for key in order]


class AddContactTagFlow:
    def __init__(
        self,
        *,
        contact: str,
        tag: str,
        artifact_root: Path = Path("artifacts/private"),
    ) -> None:
        self.contact = contact
        self.tag = tag
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.artifact_dir = artifact_root / timestamp
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        self.report = FlowReport()
        self._counter = 0
        self._window: WeChatWindow | None = None

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

    def _display_shot(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        shot = capture_main_display(self._next_path(name))
        return shot, self._read(shot)

    def _normalize_to_chat(self) -> None:
        activate_wechat()
        # Close a stale tag menu/profile card without clicking chat content.
        for _ in range(3):
            press_escape(0.2)
        self._window = main_wechat_window()
        shot, items = self._window_shot("chat-baseline")
        # A clean run starts from the normal chat view, not a previously open
        # info panel. Closing uses the same visual locator as opening.
        if chat_info_panel(items).matched:
            point = locate_chat_info_button(shot.image)
            click(shot.transform.physical_to_global_logical(point), 0.8)
            shot, items = self._window_shot("chat-clean")
            if chat_info_panel(items).matched:
                raise FlowFailure(ResultCode.CHAT_INFO_NOT_FOUND, "无法关闭遗留的聊天信息面板")

        header = exact_chat_header(
            items,
            self.contact,
            image_width=shot.image.width,
            image_height=shot.image.height,
        )
        if not header.matched:
            raise FlowFailure(
                ResultCode.TARGET_NOT_FOUND,
                f"当前聊天标题不是精确联系人 {self.contact!r}；不会模糊匹配或选择群聊",
            )

    def _ensure_chat_info(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        shot, items = self._window_shot(f"{name}-before")
        if not chat_info_panel(items).matched:
            pixel_point = locate_chat_info_button(shot.image)
            click(shot.transform.physical_to_global_logical(pixel_point), 0.9)
            shot, items = self._window_shot(f"{name}-after-click")
        state = chat_info_panel(items)
        if not state.matched:
            self.report.fail_step("CHAT_INFO_LOCATOR", f"证据={state.evidence}")
            raise FlowFailure(ResultCode.CHAT_INFO_NOT_FOUND, "点击聊天信息后未验证到信息面板")
        self.report.pass_step("CHAT_INFO_LOCATOR", f"证据={state.evidence}")
        return shot, items

    @staticmethod
    def _candidate_key(candidate: AvatarCandidate) -> tuple[int, int, int, int]:
        rect = candidate.rect
        return tuple(round(value) for value in (rect.x, rect.y, rect.width, rect.height))

    def _recover_false_positive(self, before_titles: set[str]) -> bool:
        after = list_wechat_windows()
        auxiliary = [
            window.title
            for window in after
            if window.title and window.title != "微信" and window.title not in before_titles
        ]
        recovered = False
        for title in auxiliary:
            close_auxiliary_window(title)
            recovered = True
            self.report.details.append(f"AVATAR_FALSE_POSITIVE: closed {title!r}")
        if not auxiliary:
            press_escape(0.4)
            recovered = True
        remaining = {
            window.title for window in list_wechat_windows() if window.title and window.title != "微信"
        }
        if any(title in remaining for title in auxiliary):
            self.report.fail_step(
                "AVATAR_FALSE_POSITIVE_RECOVERY", f"未关闭={sorted(remaining)}"
            )
            return False
        return recovered

    def _open_profile(self, name: str) -> tuple[Screenshot, list[OCRItem]]:
        excluded: set[tuple[int, int, int, int]] = set()
        for attempt in range(1, 5):
            panel_shot, _ = self._ensure_chat_info(f"{name}-panel-{attempt}")
            scale = (panel_shot.transform.scale_x + panel_shot.transform.scale_y) / 2
            candidates = [
                candidate
                for candidate in locate_avatar_candidates(panel_shot.image, scale)
                if self._candidate_key(candidate) not in excluded
            ]
            if not candidates:
                raise FlowFailure(ResultCode.PROFILE_NOT_FOUND, "聊天信息面板顶部没有合格的头像候选")
            candidate = candidates[0]
            before_titles = {window.title for window in list_wechat_windows() if window.title}
            click(
                panel_shot.transform.physical_to_global_logical(candidate.rect.center),
                0.9,
            )
            display_shot, items = self._display_shot(f"{name}-candidate-{attempt}")
            state = profile(items)
            if state.matched:
                self.report.pass_step(
                    "AVATAR_LOCATOR",
                    f"candidate={self._candidate_key(candidate)}, score={candidate.score:.3f}",
                )
                self.report.pass_step("PROFILE_STATE_DETECTOR", f"证据={state.evidence}")
                return display_shot, items
            excluded.add(self._candidate_key(candidate))
            if not self._recover_false_positive(before_titles):
                raise FlowFailure(ResultCode.PROFILE_NOT_FOUND, "头像候选误点后无法恢复")
        raise FlowFailure(ResultCode.PROFILE_NOT_FOUND, "所有头像候选都未通过朋友资料状态验证")

    def _open_tag_editor(
        self, profile_shot: Screenshot, profile_items: list[OCRItem]
    ) -> tuple[Screenshot, list[OCRItem]]:
        point = locate_tag_row(profile_items)
        self.report.pass_step("TAG_ROW_LOCATOR", f"physical={point.x:.1f},{point.y:.1f}")
        click(profile_shot.transform.physical_to_global_logical(point), 0.8)
        shot, items = self._display_shot("tag-editor-opened")
        state = tag_editor(items)
        if not state.matched:
            self.report.fail_step("TAG_EDITOR_OPENED", f"证据={state.evidence}")
            raise FlowFailure(ResultCode.TAG_EDITOR_NOT_FOUND, "标签行点击后未验证到真实标签编辑器")
        self.report.pass_step("TAG_EDITOR_OPENED", f"证据={state.evidence}")
        return shot, items

    def _add_or_confirm_tag(
        self, profile_shot: Screenshot, profile_items: list[OCRItem]
    ) -> tuple[Screenshot, list[OCRItem]]:
        already_visible = profile_tag_visible(profile_items, self.tag).matched
        if already_visible:
            self.report.pass_step("TAG_ROW_LOCATOR", f"{self.tag} 已在资料页标签行")
            self.report.pass_step("TAG_EDITOR_OPENED", "幂等重跑：无需再打开")
            self.report.pass_step("TAG_PASTED", f"幂等重跑：{self.tag} 已存在")
            self.report.pass_step("SAVE_EXECUTED", "幂等重跑：无需重复保存")
            return profile_shot, profile_items

        editor_shot, _ = self._open_tag_editor(profile_shot, profile_items)
        set_clipboard(self.tag)
        paste_clipboard(0.9)
        pasted_shot, pasted_items = self._display_shot("tag-pasted")
        create_matches = editor_scoped_text(pasted_items, "创建新标签")
        pasted_matches = editor_scoped_text(pasted_items, self.tag)
        pasted_state = text_visible(pasted_matches, self.tag)
        if not pasted_state.matched or not create_matches:
            raise FlowFailure(
                ResultCode.VERIFY_FAILED,
                f"粘贴 {self.tag!r} 后没有识别到对应的“创建新标签”候选",
            )
        self.report.pass_step("TAG_PASTED", f"证据={pasted_state.evidence}")

        create = max(create_matches, key=lambda item: item.rect.x)
        click(pasted_shot.transform.physical_to_global_logical(create.center), 0.9)
        committed_shot, committed_items = self._display_shot("tag-created-selected")

        # Some WeChat versions show a separate completion button; the current
        # version commits immediately and shows the newly selected row.
        save_matches = editor_scoped_text(committed_items, "完成", exact=True) + editor_scoped_text(
            committed_items, "保存", exact=True
        )
        if save_matches:
            save_point = locate_save_button(save_matches)
            click(committed_shot.transform.physical_to_global_logical(save_point), 0.9)
            save_evidence = "已点击微信显式完成/保存控件"
        else:
            selected_items = editor_scoped_text(committed_items, self.tag)
            selected = text_visible(selected_items, self.tag)
            if not selected.matched:
                raise FlowFailure(ResultCode.VERIFY_FAILED, f"创建后标签列表中没有 {self.tag!r}")
            press_escape(0.7)
            save_evidence = f"即时提交版本：标签列表已勾选 {self.tag}"

        saved_shot, saved_items = self._display_shot("profile-after-save")
        if not profile(saved_items).matched:
            raise FlowFailure(
                ResultCode.VERIFY_FAILED,
                "保存/即时提交后未返回朋友资料",
            )
        self.report.pass_step(
            "SAVE_EXECUTED",
            f"{save_evidence}；最终状态以关闭资料后重新打开验证为准",
        )
        return saved_shot, saved_items

    def _close_profile(self) -> None:
        for _ in range(3):
            press_escape(0.25)

    def run(self) -> OperationResult:
        result_code = ResultCode.INTERNAL_ERROR
        result_message = "未完成"
        try:
            self._normalize_to_chat()
            profile_shot, profile_items = self._open_profile("initial")
            existing_tags = extract_profile_tags(profile_items)
            _, _ = self._add_or_confirm_tag(profile_shot, profile_items)

            self._close_profile()
            reopened_shot, reopened_items = self._open_profile("reopen")
            del reopened_shot
            self.report.pass_step("PROFILE_REOPENED", "返回聊天后重走聊天信息→头像")

            reopened_tags = extract_profile_tags(reopened_items)
            if self.tag in reopened_tags:
                self.report.pass_step("TAG_VISIBLE_AFTER_REOPEN", self.tag)
            else:
                self.report.fail_step("TAG_VISIBLE_AFTER_REOPEN", f"未找到 {self.tag}")

            missing = existing_tags - reopened_tags
            if not missing:
                self.report.pass_step(
                    "EXISTING_TAGS_PRESERVED",
                    ",".join(sorted(existing_tags)) if existing_tags else "原资料无已有标签",
                )
            else:
                self.report.fail_step("EXISTING_TAGS_PRESERVED", f"缺失={sorted(missing)}")

            self.report.finish()
            if self.report.values["ADD_CONTACT_TAG"] == "PASS":
                result_code = ResultCode.SUCCESS
                result_message = f"已验证联系人 {self.contact!r} 的标签 {self.tag!r}"
            else:
                result_code = ResultCode.VERIFY_FAILED
                result_message = "重新打开资料后的标签验证失败"
        except FlowFailure as exc:
            result_code = exc.code
            result_message = exc.business_message
            self.report.details.append(f"BUSINESS_ERROR: {exc.business_message}")
        except Exception as exc:
            result_code = ResultCode.INTERNAL_ERROR
            result_message = "自动化内部错误；请查看私有诊断产物"
            self.report.details.append(f"INTERNAL_ERROR: {type(exc).__name__}: {exc}")
        finally:
            self.report.finish()
            self.report.result_code = result_code
            self.report.message = result_message
            payload = {
                "code": result_code.value,
                "message": result_message,
                "target": self.contact,
                "tag": self.tag,
                "results": self.report.values,
                "details": self.report.details,
            }
            (self.artifact_dir / "report.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        return OperationResult(
            code=result_code,
            action="add_contact_tag",
            target=self.contact,
            message=result_message,
            artifact_dir=self.artifact_dir,
            details=tuple(self.report.details),
            metrics=dict(self.report.values),
        )
