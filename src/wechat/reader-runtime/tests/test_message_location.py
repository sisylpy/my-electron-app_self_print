import hashlib
import os
import tempfile
import unittest
from types import SimpleNamespace

from product.providers.common import WechatReadOnlyDB


def table_for(username):
    return "Msg_" + hashlib.md5(username.encode("utf-8")).hexdigest()


class MessageLocationTest(unittest.TestCase):
    def test_only_numbered_message_databases_are_shards(self):
        with tempfile.TemporaryDirectory() as root:
            message_dir = os.path.join(root, "message")
            os.makedirs(message_dir)
            for name in ("message_0.db", "message_12.db", "message_fts.db", "message_resource.db"):
                open(os.path.join(message_dir, name), "wb").close()
            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=lambda _path, _sql: []))
            self.assertEqual(
                [os.path.basename(path) for path in db.message_shards()],
                ["message_0.db", "message_12.db"],
            )

    def test_direct_chat_falls_back_to_non_group_table_containing_sender(self):
        direct_username = "wxid_direct_sender"
        group_username = "123456@chatroom"
        group_table = table_for(group_username)
        fallback_table = table_for("internal_session_identity")

        with tempfile.TemporaryDirectory() as root:
            message_dir = os.path.join(root, "message")
            os.makedirs(message_dir)
            shard = os.path.join(message_dir, "message_0.db")
            open(shard, "wb").close()

            def query(_path, sql):
                if "FROM contact" in sql:
                    return [
                        [direct_username, "好友", "", 0],
                        [group_username, "测试群", "", 0],
                    ]
                if "name='" + table_for(direct_username) + "'" in sql:
                    return []
                if "SELECT rowid FROM Name2Id" in sql:
                    return [[7]]
                if "name LIKE 'Msg_%'" in sql:
                    return [[group_table], [fallback_table]]
                if "SELECT '" + fallback_table + "'" in sql:
                    self.assertNotIn("SELECT '" + group_table + "'", sql)
                    return [[fallback_table]]
                return []

            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=query))
            self.assertEqual(
                db.locate_message_table(direct_username),
                [(shard, fallback_table)],
            )

    def test_warm_message_index_indexes_each_shard_only_once(self):
        calls = []
        with tempfile.TemporaryDirectory() as root:
            message_dir = os.path.join(root, "message")
            os.makedirs(message_dir)
            shards = [os.path.join(message_dir, "message_%d.db" % value) for value in range(3)]
            for shard in shards:
                open(shard, "wb").close()

            def query(path, sql):
                calls.append((path, sql))
                suffix = os.path.basename(path).split("_")[1].split(".")[0]
                return [["Msg_" + suffix.zfill(32)]]

            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=query))
            db.warm_message_index()
            db.warm_message_index()

            self.assertEqual(len(calls), 3)
            self.assertCountEqual([path for path, _sql in calls], shards)


if __name__ == "__main__":
    unittest.main()
