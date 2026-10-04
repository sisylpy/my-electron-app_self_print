import os
import tempfile
import unittest
from types import SimpleNamespace

from product.providers.common import WechatReadOnlyDB


class MessageQueryCacheTest(unittest.TestCase):
    def test_session_cache_invalidates_when_session_wal_changes(self):
        calls = []

        with tempfile.TemporaryDirectory() as root:
            session_root = os.path.join(root, "session")
            os.makedirs(session_root)
            session_db = os.path.join(session_root, "session.db")
            wal = session_db + "-wal"
            open(session_db, "wb").close()
            open(wal, "wb").close()

            def query(_path, sql):
                calls.append(sql)
                return [["friend", len(calls)]]

            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=query))
            self.assertEqual(db.session_last_time("friend"), 1)
            self.assertEqual(db.session_last_time("friend"), 1)
            self.assertEqual(len(calls), 1)

            with open(wal, "ab") as handle:
                handle.write(b"changed")
            os.utime(wal, None)

            self.assertEqual(db.session_last_time("friend"), 2)
            self.assertEqual(len(calls), 2)

    def test_reuses_unchanged_query_and_invalidates_on_wal_change(self):
        calls = []

        with tempfile.TemporaryDirectory() as root:
            shard = os.path.join(root, "message_0.db")
            wal = shard + "-wal"
            open(shard, "wb").close()
            open(wal, "wb").close()

            def query(_path, sql):
                calls.append(sql)
                return [[1, 2, 3, "土豆8斤", 1, "sender"]]

            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=query))
            args = (shard, "Msg_0123456789abcdef0123456789abcdef", (1, 3), 200, 0)

            first = db.query_messages(*args)
            second = db.query_messages(*args)
            self.assertEqual(first, second)
            # First read inspects the message-table schema once, then executes
            # the message query. The unchanged second read reuses both caches.
            self.assertEqual(len(calls), 2)

            with open(wal, "ab") as handle:
                handle.write(b"changed")
            os.utime(wal, None)

            db.query_messages(*args)
            self.assertEqual(len(calls), 3)

    def test_caches_missing_sender_lookup(self):
        calls = []

        def query(_path, sql):
            calls.append(sql)
            return []

        db = WechatReadOnlyDB(SimpleNamespace(db_root="/tmp/not-used", query=query))
        self.assertIsNone(db.sender_user_name("message_0.db", 0))
        self.assertIsNone(db.sender_user_name("message_0.db", 0))
        self.assertEqual(len(calls), 1)

    def test_caches_group_sender_ids_until_wal_changes(self):
        calls = []

        with tempfile.TemporaryDirectory() as root:
            shard = os.path.join(root, "message_0.db")
            open(shard, "wb").close()

            def query(_path, sql):
                calls.append(sql)
                return [[1], [2]]

            db = WechatReadOnlyDB(SimpleNamespace(db_root=root, query=query))
            self.assertEqual(db.distinct_senders(shard, "Msg_0123456789abcdef0123456789abcdef"), [1, 2])
            self.assertEqual(db.distinct_senders(shard, "Msg_0123456789abcdef0123456789abcdef"), [1, 2])
            self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
