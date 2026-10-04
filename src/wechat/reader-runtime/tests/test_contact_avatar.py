import unittest
from types import SimpleNamespace

from product.providers.common import WechatReadOnlyDB


class ContactAvatarTest(unittest.TestCase):
    def test_avatar_url_is_loaded_with_the_batched_contact_query(self):
        calls = []

        def query(_path, sql):
            calls.append(sql)
            if sql == "PRAGMA table_info(contact)":
                return [
                    [0, "username", "TEXT", 0, None, 0],
                    [1, "nick_name", "TEXT", 0, None, 0],
                    [2, "small_head_url", "TEXT", 0, None, 0],
                ]
            if "FROM contact WHERE username IS NOT NULL" in sql:
                self.assertIn('"small_head_url"', sql)
                return [[
                    "wxid_friend",
                    "好友",
                    "",
                    0,
                    "https://wx.qlogo.cn/mmhead/example/0",
                ]]
            return []

        db = WechatReadOnlyDB(SimpleNamespace(db_root="/tmp/wechat", query=query))

        self.assertEqual(db.contact_rows(), [("wxid_friend", "好友", "", 0)])
        self.assertEqual(
            db.contact_avatar_url("wxid_friend"),
            "https://wx.qlogo.cn/mmhead/example/0",
        )
        self.assertEqual(
            len([sql for sql in calls if "FROM contact WHERE username IS NOT NULL" in sql]),
            1,
        )

    def test_missing_avatar_column_keeps_contact_reading_available(self):
        def query(_path, sql):
            if sql == "PRAGMA table_info(contact)":
                return [[0, "username", "TEXT", 0, None, 0]]
            if "FROM contact WHERE username IS NOT NULL" in sql:
                return [["wxid_friend", "好友", "", 0, None]]
            return []

        db = WechatReadOnlyDB(SimpleNamespace(db_root="/tmp/wechat", query=query))

        self.assertEqual(db.contact_rows(), [("wxid_friend", "好友", "", 0)])
        self.assertIsNone(db.contact_avatar_url("wxid_friend"))


if __name__ == "__main__":
    unittest.main()
