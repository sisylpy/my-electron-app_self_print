import unittest
from types import SimpleNamespace

from product.WechatLocalDataService import WechatLocalDataService, _ConversationMeta
from product.domain import AccountId, ConversationId, Page, TimeRange
from product.providers.DatabaseAccessProvider import AccountMeta


class _FakeDB:
    def __init__(self, message_rows=None, resource_rows=None, resource_identities=None):
        self.message_rows = message_rows or []
        self.resource_rows = resource_rows or []
        self.resource_identities = resource_identities or []

    def locate_message_table(self, _username):
        return [("message_0.db", "Msg_test")]

    def query_messages(self, *_args, **_kwargs):
        return list(self.message_rows)

    def query_image_resources(self, *_args, **_kwargs):
        return list(self.resource_rows)

    def image_resource_identities(self, *_args, **_kwargs):
        return list(self.resource_identities)

    def count_messages(self, *_args, **_kwargs):
        return len(self.message_rows)

    def contact_nick(self, username):
        return "好友" if username == "wxid_friend" else None

    def sender_user_name(self, _shard, _rid):
        return "wxid_friend"


class ImageResourceFallbackTest(unittest.TestCase):
    def _service(self, db):
        service = WechatLocalDataService(SimpleNamespace())
        account_id = AccountId("fp:account")
        conversation_id = ConversationId("fp:conversation")
        service._accounts[account_id] = AccountMeta(
            account_id=account_id,
            wxid="wxid_self",
            db_root="/tmp/not-used",
            display_hint="self",
            has_material=True,
        )
        service._conv_index[conversation_id] = _ConversationMeta(
            account_id, "wxid_friend", "direct"
        )
        service._databases[account_id] = db
        return service, conversation_id

    def test_resource_only_image_is_returned_as_a_normal_image_message(self):
        resource = [77, 459, 1791881525, 2, 3, "wxid_friend", 9988, "AABB"]
        service, conversation_id = self._service(_FakeDB(resource_rows=[resource]))

        page = service.getMessages(
            conversation_id,
            TimeRange(start="2026-10-13T16:45:00+08:00", end="2026-10-13T17:00:00+08:00"),
            Page(offset=0, limit=20),
        )

        self.assertEqual(len(page.items), 1)
        self.assertEqual(page.items[0].id, "fp:conversation:459")

    def test_later_message_reusing_resource_local_id_gets_unique_stable_id(self):
        later_message = [459, 1791883228, 2, "", 3, "wxid_friend", 2002, "CCDD"]
        older_resource = [77, 459, 1791881525, 2, 3, "wxid_friend", 1001, "AABB"]
        identities = [[459, 1001, 1791881525]]
        service, conversation_id = self._service(_FakeDB(
            message_rows=[later_message],
            resource_rows=[older_resource],
            resource_identities=identities,
        ))

        page = service.getMessages(conversation_id, None, Page(offset=0, limit=20))

        self.assertEqual(len(page.items), 2)
        later, older = page.items
        self.assertTrue(str(later.id).startswith("fp:conversation:459:s"))
        self.assertEqual(older.id, "fp:conversation:459")
        self.assertNotEqual(later.id, older.id)
        self.assertNotEqual(later.attachmentRef.id, older.attachmentRef.id)

    def test_reused_id_stays_unique_when_older_resource_is_outside_time_window(self):
        later_message = [459, 1791883228, 2, "", 3, "wxid_friend", 2002, "CCDD"]
        identities = [[459, 1001, 1791881525]]
        service, conversation_id = self._service(_FakeDB(
            message_rows=[later_message],
            resource_rows=[],
            resource_identities=identities,
        ))

        page = service.getMessages(
            conversation_id,
            TimeRange(start="2026-10-13T17:18:00+08:00", end="2026-10-13T17:30:00+08:00"),
            Page(offset=0, limit=20),
        )

        self.assertEqual(len(page.items), 1)
        self.assertTrue(str(page.items[0].id).startswith("fp:conversation:459:s"))
        self.assertEqual(page.items[0].type, "image")
        self.assertEqual(page.items[0].senderName, "好友")
        self.assertEqual(page.items[0].attachmentRef.kind, "image")

    def test_message_table_copy_wins_over_matching_resource_record(self):
        message = [459, 1791881525, 2, "", 3, "wxid_friend", 9988, "CCDD"]
        resource = [77, 459, 1791881525, 2, 3, "wxid_friend", 9988, "AABB"]
        service, conversation_id = self._service(
            _FakeDB(message_rows=[message], resource_rows=[resource])
        )

        page = service.getMessages(conversation_id, None, Page(offset=0, limit=20))

        self.assertEqual(len(page.items), 1)
        self.assertEqual(page.items[0].id, "fp:conversation:459")


if __name__ == "__main__":
    unittest.main()
