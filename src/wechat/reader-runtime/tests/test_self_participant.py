import unittest
from types import SimpleNamespace

from product.WechatLocalDataService import WechatLocalDataService, _ConversationMeta
from product.domain import AccountId, ConversationId
from product.providers.DatabaseAccessProvider import AccountMeta


class SelfParticipantTest(unittest.TestCase):
    def test_self_only_does_not_scan_group_message_tables(self):
        account_id = AccountId("fp:account")
        conversation_id = ConversationId("fp:conversation")
        account = AccountMeta(
            account_id=account_id,
            wxid="wxid_self",
            db_root="/tmp/not-used",
            display_hint="self",
            has_material=True,
        )
        db = SimpleNamespace(
            contact_nick=lambda username: "当前账号" if username == "wxid_self" else None,
            locate_message_table=lambda _username: self.fail("selfOnly must not scan message tables"),
        )
        service = WechatLocalDataService(SimpleNamespace())
        service._accounts[account_id] = account
        service._conv_index[conversation_id] = _ConversationMeta(
            account_id,
            "group@chatroom",
            "group",
        )
        service._databases[account_id] = db

        participants = service.getParticipants(conversation_id, selfOnly=True)

        self.assertEqual(len(participants), 1)
        self.assertTrue(participants[0].isSelf)
        self.assertEqual(participants[0].displayName, "当前账号")


if __name__ == "__main__":
    unittest.main()
