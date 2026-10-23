import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from product.WechatLocalDataService import WechatLocalDataService, _ConversationMeta
from product.bridge.ndjson_main import _attachment, _page_result_messages, _pg
from product.domain import AccountId, ConversationId, Page, TimeRange
from product.errors.codes import WechatServiceError
from product.providers.DatabaseAccessProvider import AccessMaterial, AccountMeta


BASE = 1791880000


def _iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


class _KeysetDB:
    def __init__(self, shards=None, resources=None, with_resource=False):
        self.shards = {name: list(rows) for name, rows in (shards or {}).items()}
        self.resources = list(resources or [])
        self.with_resource = with_resource or bool(resources)
        self.keyset_calls = 0
        self.fail_on_call = None
        self.session_row = None

    def locate_message_table(self, _username):
        return [(name, "Msg_test") for name in sorted(self.shards)]

    def message_source_id(self, shard):
        return "source-" + shard

    def query_messages(self, shard, _table, tr, limit, offset, like=None):
        rows = [list(row[:8]) for row in self.shards[shard] if self._within(row[1], tr)]
        if like:
            rows = [row for row in rows if like in str(row[3])]
        rows.sort(key=lambda row: int(row[1]), reverse=True)
        return rows[offset:offset + limit]

    def query_image_resources(self, _username, tr, limit, offset):
        rows = [list(row) for row in self.resources if self._within(row[2], tr)]
        rows.sort(key=lambda row: int(row[2]), reverse=True)
        return rows[offset:offset + limit]

    def image_resource_source_id(self):
        return "source-resource" if self.with_resource else None

    def session_source_id(self):
        return "source-session" if self.session_row else None

    def query_session_latest(
        self, _username, tr, cursor_time=None, same_second="all", cursor_tail=None,
    ):
        if not self.session_row or not self._within(self.session_row[1], tr):
            return []
        rows = self._apply_cursor(
            [list(self.session_row)], cursor_time, same_second, cursor_tail, False
        )
        return rows

    def query_messages_keyset(
        self, shard, _table, tr, limit, like=None, cursor_time=None,
        same_second="all", cursor_tail=None,
    ):
        self.keyset_calls += 1
        if self.fail_on_call == self.keyset_calls:
            raise RuntimeError("simulated page failure")
        rows = [list(row) for row in self.shards[shard] if self._within(row[1], tr)]
        if like:
            rows = [row for row in rows if like in str(row[3])]
        rows = self._apply_cursor(rows, cursor_time, same_second, cursor_tail, False)
        rows.sort(key=lambda row: (int(row[1]), int(row[6]), int(row[0]), int(row[8])), reverse=True)
        return rows[:limit]

    def query_image_resources_keyset(
        self, _username, tr, limit, cursor_time=None,
        same_second="all", cursor_tail=None,
    ):
        self.keyset_calls += 1
        if self.fail_on_call == self.keyset_calls:
            raise RuntimeError("simulated page failure")
        rows = [list(row) for row in self.resources if self._within(row[2], tr)]
        rows = self._apply_cursor(rows, cursor_time, same_second, cursor_tail, True)
        rows.sort(key=lambda row: (int(row[2]), int(row[6]), int(row[1]), int(row[0])), reverse=True)
        return rows[:limit]

    @staticmethod
    def _within(timestamp, tr):
        lo, hi = tr
        return (lo is None or timestamp >= lo) and (hi is None or timestamp <= hi)

    @staticmethod
    def _apply_cursor(rows, cursor_time, mode, tail, resource):
        if cursor_time is None:
            return rows
        out = []
        for row in rows:
            timestamp = int(row[2] if resource else row[1])
            physical = (
                int(row[6]), int(row[1]), int(row[0])
            ) if resource else (
                int(row[6]), int(row[0]), int(row[8])
            )
            if mode == "before" and timestamp < cursor_time:
                out.append(row)
            elif mode == "all" and timestamp <= cursor_time:
                out.append(row)
            elif mode == "same" and (
                timestamp < cursor_time or (timestamp == cursor_time and physical < tuple(tail))
            ):
                out.append(row)
        return out

    def image_resource_identities(self, _username, local_ids):
        wanted = set(local_ids)
        return [[row[1], row[6], row[2]] for row in self.resources if row[1] in wanted]

    def count_messages(self, shard, _table, tr, like=None):
        rows = [row for row in self.shards[shard] if self._within(row[1], tr)]
        return len([row for row in rows if not like or like in str(row[3])])

    def contact_nick(self, username):
        return "好友" if username == "wxid_friend" else None

    def sender_user_name(self, _shard, _rid):
        return "wxid_friend"

    def find_image_attachment(self, _username, locator):
        wanted = (int(locator["t"]), int(locator["l"]), int(locator["s"]), int(locator["y"]))
        for rows in self.shards.values():
            for row in rows:
                actual = (int(row[1]), int(row[0]), int(row[6]), int(row[4]))
                if actual == wanted:
                    return row[7]
        for row in self.resources:
            actual = (int(row[2]), int(row[1]), int(row[6]), int(row[4]))
            if actual == wanted:
                return row[7]
        return None


class KeysetPaginationV3Test(unittest.TestCase):
    def _service(self, db):
        service = WechatLocalDataService(SimpleNamespace())
        account_id = AccountId("fp:account")
        conversation_id = ConversationId("fp:conversation")
        account = AccountMeta(
            account_id=account_id,
            wxid="wxid_self",
            db_root="/tmp/not-used",
            display_hint="self",
            has_material=True,
        )
        service._accounts[account_id] = account
        service._conv_index[conversation_id] = _ConversationMeta(
            account_id, "wxid_friend", "direct"
        )
        service._databases[account_id] = db
        service._materials[account_id] = AccessMaterial(
            account_id=account_id,
            account_wxid="wxid_self",
            db_root="/tmp/not-used",
            passphrase=b"k" * 32,
            query=lambda _path, _sql: [],
        )
        return service, conversation_id

    @staticmethod
    def _rows(count, timestamp_step=1, start_local=1000, start_server=5000):
        return [
            [
                start_local + index,
                BASE + index * timestamp_step,
                2,
                "订单 %d" % index,
                1,
                "wxid_friend",
                start_server + index,
                None,
                9000 + index,
            ]
            for index in range(count)
        ]

    def _read_all(self, service, conversation_id, limit=200):
        token = None
        items = []
        pages = []
        while True:
            page = service.getMessages(
                conversation_id,
                TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
                Page(limit=limit, keyset=True, pageKey=token),
            )
            pages.append(page)
            items.extend(page.items)
            if not page.hasMore:
                break
            self.assertTrue(page.nextPageKey)
            token = page.nextPageKey
        return items, pages

    def test_boundaries_199_200_201_400_and_450(self):
        for count in (199, 200, 201, 400, 450):
            with self.subTest(count=count):
                service, conversation = self._service(
                    _KeysetDB({"message_0.db": self._rows(count)})
                )
                items, pages = self._read_all(service, conversation)
                self.assertEqual(len(items), count)
                self.assertEqual(len({str(item.id) for item in items}), count)
                self.assertFalse(pages[-1].hasMore)
                self.assertIsNone(pages[-1].nextPageKey)

    def test_450_messages_in_the_same_second_are_complete_and_stable(self):
        rows = self._rows(450, timestamp_step=0)
        service, conversation = self._service(_KeysetDB({"message_0.db": rows}))
        items, pages = self._read_all(service, conversation)
        self.assertEqual(len(items), 450)
        self.assertEqual([len(page.items) for page in pages], [200, 200, 50])
        self.assertEqual(len({str(item.id) for item in items}), 450)

    def test_session_preview_fills_latest_text_before_message_shard_flush(self):
        db = _KeysetDB({"message_0.db": self._rows(2)})
        db.session_row = [47, BASE + 120, 0, "芒果8斤", 1, "wxid_friend", 0, None, 47]
        service, conversation = self._service(db)
        items, _pages = self._read_all(service, conversation)
        self.assertEqual([item.text for item in items[:1]], ["芒果8斤"])
        self.assertTrue(str(items[0].id).startswith("fp:conversation:47:t"))

    def test_consecutive_session_previews_reusing_local_id_have_distinct_ids(self):
        db = _KeysetDB({"message_0.db": self._rows(2)})
        service, conversation = self._service(db)
        db.session_row = [47, BASE + 120, 0, "芒果8斤", 1, "wxid_friend", 0, None, 47]
        first, _pages = self._read_all(service, conversation)
        db.session_row = [47, BASE + 180, 0, "芒果999个", 1, "wxid_friend", 0, None, 47]
        second, _pages = self._read_all(service, conversation)
        self.assertNotEqual(first[0].id, second[0].id)

    def test_session_preview_and_durable_text_share_logical_id(self):
        db = _KeysetDB({"message_0.db": self._rows(2)})
        db.session_row = [47, BASE + 120, 0, "芒果8斤", 1, "wxid_friend", 0, None, 47]
        service, conversation = self._service(db)
        preview, _pages = self._read_all(service, conversation)

        durable = [
            47, BASE + 120, 2, "芒果8斤", 1,
            "wxid_friend", 7000, None, 47,
        ]
        db.shards["message_0.db"].append(durable)
        db.session_row = list(durable)
        persisted, _pages = self._read_all(service, conversation)
        durable_item = next(item for item in persisted if item.text == "芒果8斤")
        self.assertEqual(preview[0].id, durable_item.id)

    def test_session_preview_is_deduplicated_after_message_shard_flush(self):
        rows = self._rows(2)
        durable = [47, BASE + 120, 2, "芒果8斤", 1, "wxid_friend", 7000, None, 47]
        db = _KeysetDB({"message_0.db": rows + [durable]})
        db.session_row = list(durable)
        service, conversation = self._service(db)
        items, _pages = self._read_all(service, conversation)
        self.assertEqual(sum(item.text == "芒果8斤" for item in items), 1)

    def test_multiple_shards_and_resource_copy_merge_deterministically(self):
        first = self._rows(210, timestamp_step=0, start_local=1000, start_server=5000)
        second = self._rows(210, timestamp_step=0, start_local=2000, start_server=6000)
        duplicate = [77, first[0][0], BASE, 2, 3, "wxid_friend", first[0][6], "DUP"]
        resource_only = [78, 9001, BASE, 2, 3, "wxid_friend", 99001, "AABB"]
        db = _KeysetDB(
            {"message_0.db": first, "message_1.db": second},
            resources=[duplicate, resource_only],
        )
        service, conversation = self._service(db)
        items, _pages = self._read_all(service, conversation)
        self.assertEqual(len(items), 421)
        self.assertEqual(len({str(item.id) for item in items}), 421)
        self.assertIn("fp:conversation:9001", {str(item.id) for item in items})

    def test_newer_insert_during_paging_does_not_shift_continuation(self):
        db = _KeysetDB({"message_0.db": self._rows(400, timestamp_step=0)})
        service, conversation = self._service(db)
        first = service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 10)),
            Page(limit=200, keyset=True, pageKey=None),
        )
        db.shards["message_0.db"].append(
            [9999, BASE, 2, "新到", 1, "wxid_friend", 999999, None, 99999]
        )
        token = first.nextPageKey
        rest = []
        while token:
            page = service.getMessages(
                conversation,
                TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 10)),
                Page(limit=200, keyset=True, pageKey=token),
            )
            rest.extend(page.items)
            token = page.nextPageKey
        all_ids = {str(item.id) for item in first.items + rest}
        self.assertEqual(len(all_ids), 400)
        self.assertNotIn("新到", {item.text for item in first.items + rest})

    def test_failure_on_second_page_is_raised_and_never_reported_complete(self):
        db = _KeysetDB({"message_0.db": self._rows(400)})
        service, conversation = self._service(db)
        first = service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
            Page(limit=200, keyset=True, pageKey=None),
        )
        self.assertTrue(first.hasMore)
        db.fail_on_call = db.keyset_calls + 1
        with self.assertRaisesRegex(RuntimeError, "simulated page failure"):
            service.getMessages(
                conversation,
                TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
                Page(limit=200, keyset=True, pageKey=first.nextPageKey),
            )

    def test_shard_set_change_requires_restart_instead_of_false_completion(self):
        db = _KeysetDB({"message_0.db": self._rows(400)})
        service, conversation = self._service(db)
        first = service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
            Page(limit=200, keyset=True, pageKey=None),
        )
        db.shards["message_1.db"] = self._rows(
            1, start_local=8000, start_server=8000
        )
        with self.assertRaises(WechatServiceError) as caught:
            service.getMessages(
                conversation,
                TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
                Page(limit=200, keyset=True, pageKey=first.nextPageKey),
            )
        self.assertEqual(caught.exception.error.diagnosticId, "keyset-source-changed")

    def test_same_local_id_is_not_used_as_the_physical_page_key(self):
        rows = [
            [77, BASE, 2, "较新", 1, "wxid_friend", 9002, None, 102],
            [77, BASE, 2, "较旧", 1, "wxid_friend", 9001, None, 101],
        ]
        service, conversation = self._service(_KeysetDB({"message_0.db": rows}))
        items, pages = self._read_all(service, conversation, limit=1)
        self.assertEqual(len(items), 2)
        self.assertNotEqual(items[0].id, items[1].id)
        self.assertEqual(len(pages), 2)

    def test_text_message_id_is_logical_while_page_key_is_independent(self):
        service, conversation = self._service(
            _KeysetDB({"message_0.db": self._rows(201)})
        )
        first = service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
            Page(limit=200, keyset=True, pageKey=None),
        )
        ids = {
            str(item.id) for item in first.items
        } | {
            str(item.id) for item in service.getMessages(
                conversation,
                TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 5000)),
                Page(limit=200, keyset=True, pageKey=first.nextPageKey),
            ).items
        }
        self.assertTrue(any(value.startswith("fp:conversation:1000:t") for value in ids))
        self.assertNotIn("fp:conversation", first.nextPageKey)

    def test_reader_restart_can_relocate_image_from_signed_locator(self):
        image = [321, BASE, 2, "", 3, "wxid_friend", 7654321, "AABB", 4321]
        db = _KeysetDB({"message_0.db": [image]})
        first_service, conversation = self._service(db)
        page = first_service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 10)),
            Page(limit=200, keyset=True, pageKey=None),
        )
        ref = page.items[0].attachmentRef
        self.assertTrue(ref.locator)

        restarted_service, _conversation = self._service(db)
        self.assertEqual(restarted_service._attachment_index, {})
        with patch(
            "product.WechatLocalDataService.build_image_envelope",
            return_value={"encryptedVariants": [{"kind": "original"}]},
        ) as build:
            envelope = restarted_service.getAttachment(ref.id, ref.locator)
        self.assertEqual(envelope["encryptedVariants"][0]["kind"], "original")
        self.assertEqual(build.call_args.args[-1], "AABB")

    def test_v2_offset_and_v3_optional_fields_are_bridge_compatible(self):
        legacy = _pg({"offset": 20, "limit": 50})
        keyset = _pg({"limit": 200, "pageKey": None})
        self.assertFalse(legacy.keyset)
        self.assertTrue(keyset.keyset)
        service, conversation = self._service(_KeysetDB({"message_0.db": self._rows(1)}))
        legacy_page = service.getMessages(
            conversation,
            TimeRange(start=_iso(BASE - 10), end=_iso(BASE + 10)),
            Page(offset=0, limit=20),
        )
        serialized = _page_result_messages(legacy_page)
        self.assertNotIn("nextPageKey", serialized)
        self.assertEqual(set(serialized), {"items", "total", "hasMore"})
        self.assertNotIn("locator", _attachment(SimpleNamespace(
            id="old", kind="image", mimeHint=None, locator=None
        )))


if __name__ == "__main__":
    unittest.main()
