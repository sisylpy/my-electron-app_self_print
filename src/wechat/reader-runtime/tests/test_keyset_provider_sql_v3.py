import os
import sqlite3
import tempfile
import unittest

from product.domain import AccountId
from product.providers.DatabaseAccessProvider import AccessMaterial
from product.providers.common import WechatReadOnlyDB


def _sqlite_query(path, sql):
    connection = sqlite3.connect(path)
    try:
        return [list(row) for row in connection.execute(sql).fetchall()]
    finally:
        connection.close()


class KeysetProviderSqlV3Test(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = self.temp.name
        message_dir = os.path.join(root, "message")
        os.makedirs(message_dir)
        self.message_db = os.path.join(message_dir, "message_0.db")
        connection = sqlite3.connect(self.message_db)
        connection.executescript(
            "CREATE TABLE Name2Id(user_name TEXT);"
            "INSERT INTO Name2Id(rowid, user_name) VALUES (2, 'wxid_friend');"
            "CREATE TABLE Msg_test("
            "local_id INTEGER, create_time INTEGER, real_sender_id INTEGER, "
            "message_content BLOB, local_type INTEGER, server_id INTEGER, "
            "packed_info_data BLOB);"
        )
        connection.executemany(
            "INSERT INTO Msg_test(local_id, create_time, real_sender_id, message_content, "
            "local_type, server_id, packed_info_data) VALUES (?, ?, 2, ?, 1, ?, NULL)",
            [(1000 + index, 2000, ("订单%d" % index).encode(), 5000 + index)
             for index in range(450)],
        )
        connection.commit()
        connection.close()

        self.resource_db = os.path.join(message_dir, "message_resource.db")
        connection = sqlite3.connect(self.resource_db)
        connection.executescript(
            "CREATE TABLE ChatName2Id(user_name TEXT);"
            "INSERT INTO ChatName2Id(rowid, user_name) VALUES (1, 'wxid_friend');"
            "CREATE TABLE SenderName2Id(user_name TEXT);"
            "INSERT INTO SenderName2Id(rowid, user_name) VALUES (2, 'wxid_friend');"
            "CREATE TABLE MessageResourceInfo("
            "message_id INTEGER, chat_id INTEGER, message_local_id INTEGER, "
            "message_create_time INTEGER, sender_id INTEGER, message_local_type INTEGER, "
            "message_svr_id INTEGER, packed_info BLOB);"
            "INSERT INTO MessageResourceInfo VALUES "
            "(71, 1, 701, 2000, 2, 3, 9701, X'AABB'),"
            "(72, 1, 702, 2000, 2, 3, 9702, X'CCDD');"
        )
        connection.commit()
        connection.close()

        material = AccessMaterial(
            account_id=AccountId("fp:account"),
            account_wxid="wxid_self",
            db_root=root,
            passphrase=b"k" * 32,
            query=_sqlite_query,
        )
        self.db = WechatReadOnlyDB(material)

    def tearDown(self):
        self.temp.cleanup()

    def test_message_sql_pages_450_same_second_without_offset(self):
        first = self.db.query_messages_keyset(
            self.message_db, "Msg_test", (1999, 2001), 200
        )
        tail = (int(first[-1][6]), int(first[-1][0]), int(first[-1][8]))
        second = self.db.query_messages_keyset(
            self.message_db, "Msg_test", (1999, 2001), 200,
            cursor_time=2000, same_second="same", cursor_tail=tail,
        )
        tail = (int(second[-1][6]), int(second[-1][0]), int(second[-1][8]))
        third = self.db.query_messages_keyset(
            self.message_db, "Msg_test", (1999, 2001), 200,
            cursor_time=2000, same_second="same", cursor_tail=tail,
        )
        rows = first + second + third
        self.assertEqual([len(first), len(second), len(third)], [200, 200, 50])
        self.assertEqual(len({(row[6], row[0], row[8]) for row in rows}), 450)

    def test_resource_sql_uses_server_local_and_physical_tie_breakers(self):
        first = self.db.query_image_resources_keyset(
            "wxid_friend", (1999, 2001), 1
        )
        tail = (int(first[-1][6]), int(first[-1][1]), int(first[-1][0]))
        second = self.db.query_image_resources_keyset(
            "wxid_friend", (1999, 2001), 1,
            cursor_time=2000, same_second="same", cursor_tail=tail,
        )
        self.assertEqual([first[0][0], second[0][0]], [72, 71])


if __name__ == "__main__":
    unittest.main()
