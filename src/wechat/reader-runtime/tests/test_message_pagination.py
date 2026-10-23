"""getMessages 分页契约测试（任务 C）。

目标：用可执行测试固定 Reader「200 条分页」的真实语义，供后续决定是否翻页。

说明（诚实标注）：
- 被测对象是真实的 product.WechatLocalDataService.getMessages（含分片合并、
  资源回退、排序与切片），不是重写逻辑。
- 数据库层用桩替换。桩严格模仿 product/providers/common.py 中
  query_messages 的真实 SQL 语义：
      ... WHERE create_time >= lo AND create_time <= hi
      ORDER BY create_time DESC LIMIT ? OFFSET ?
  即：闭区间过滤 + 按 create_time 倒序 + 内存切片。
  这不是真实 SQLite，因此只能证明「服务层分页契约」，不能替代真机大群验证。
"""
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from product.WechatLocalDataService import WechatLocalDataService, _ConversationMeta
from product.domain import AccountId, ConversationId, Page, TimeRange
from product.providers.DatabaseAccessProvider import AccountMeta

BASE = 1791880000  # 秒；等价于 2026-10-13 前后的一段本地时间
WINDOW_START = "2026-10-13T16:00:00+08:00"
WINDOW_END = "2026-10-13T17:40:00+08:00"
TZ = timezone(timedelta(hours=8))


def _iso_of(epoch_seconds):
    return datetime.fromtimestamp(epoch_seconds, tz=TZ).isoformat()


class _PagedDB:
    """按真实 SQL 语义实现的消息库桩：闭区间、倒序、LIMIT/OFFSET。"""

    def __init__(self, message_rows=None):
        self.message_rows = list(message_rows or [])

    # ---- 供被测代码使用 ----
    def locate_message_table(self, _username):
        return [("message_0.db", "Msg_test")]

    def query_messages(self, _shard, _table, tr, limit, offset, like=None):
        rows = self._within(tr)
        rows.sort(key=lambda row: int(row[1] or 0), reverse=True)
        return [list(row) for row in rows[offset: offset + limit]]

    def count_messages(self, _shard, _table, tr, like=None):
        return len(self._within(tr))

    def query_image_resources(self, _username, _tr, _limit, _offset):
        return []

    def image_resource_identities(self, _username, _local_ids):
        return []

    def contact_nick(self, username):
        return "好友" if username == "wxid_friend" else None

    def sender_user_name(self, _shard, _rid):
        return "wxid_friend"

    # ---- 内部 ----
    def _within(self, tr):
        lo, hi = tr if tr else (None, None)
        out = []
        for row in self.message_rows:
            create_time = int(row[1] or 0)
            if lo is not None and create_time < lo:
                continue
            if hi is not None and create_time > hi:
                continue
            out.append(row)
        return out


class MessagePaginationTest(unittest.TestCase):
    def _service(self, rows):
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
        service._databases[account_id] = _PagedDB(rows)
        return service, conversation_id

    @staticmethod
    def _rows(count, start=BASE, step=1):
        return [
            [1000 + index, start + index * step, 2, "订单 %d" % index, 1, "wxid_friend", 0, None]
            for index in range(count)
        ]

    def _read(self, service, conversation_id, offset, limit=200):
        return service.getMessages(
            conversation_id,
            TimeRange(start=WINDOW_START, end=WINDOW_END),
            Page(offset=offset, limit=limit),
        )

    def test_c1_199_messages_fit_in_one_page(self):
        service, conversation_id = self._service(self._rows(199))
        page = self._read(service, conversation_id, offset=0)
        self.assertEqual(len(page.items), 199)
        self.assertFalse(page.hasMore)

    def test_c2_200_messages_exactly_fill_the_page(self):
        service, conversation_id = self._service(self._rows(200))
        page = self._read(service, conversation_id, offset=0)
        self.assertEqual(len(page.items), 200)
        # 恰好填满不等于「后面还有」，本实现按 len(pairs) > offset+limit 判定。
        self.assertFalse(page.hasMore)
        self.assertEqual(page.total, 200)

    def test_c3_201_messages_report_has_more(self):
        service, conversation_id = self._service(self._rows(201))
        page = self._read(service, conversation_id, offset=0)
        self.assertEqual(len(page.items), 200)
        self.assertTrue(page.hasMore)
        self.assertEqual(page.total, 201)

    def test_c4_offset_200_is_supported_and_returns_the_older_half(self):
        service, conversation_id = self._service(self._rows(400))
        first = self._read(service, conversation_id, offset=0)
        second = self._read(service, conversation_id, offset=200)
        self.assertEqual(len(first.items), 200)
        self.assertEqual(len(second.items), 200)
        self.assertFalse(second.hasMore)
        first_ids = {str(item.id) for item in first.items}
        second_ids = {str(item.id) for item in second.items}
        self.assertEqual(len(first_ids | second_ids), 400, '两页合起来必须覆盖全部消息')
        self.assertEqual(first_ids & second_ids, set(), '两页不得重复')

    def test_c5_sorting_is_newest_first(self):
        service, conversation_id = self._service(self._rows(250))
        page = self._read(service, conversation_id, offset=0)
        times = [item.timestamp.timestamp() for item in page.items]
        self.assertEqual(times, sorted(times, reverse=True), '必须按时间倒序返回')
        # 倒序意味着第 1 页是最新的一批，被挤出的是最旧的消息。
        self.assertIn(":1249:t", str(page.items[0].id))
        self.assertIn(":1050:t", str(page.items[-1].id))

    def test_c6_time_window_endpoints_are_inclusive(self):
        # 直接构造落在窗口端点上的消息：闭区间两端都应被返回。
        from product.providers.common import _iso_to_epoch
        lo = _iso_to_epoch(WINDOW_START)
        hi = _iso_to_epoch(WINDOW_END)
        rows = [
            [2001, lo, 2, "最早", 1, "wxid_friend", 0, None],
            [2002, hi, 2, "最晚", 1, "wxid_friend", 0, None],
        ]
        service, conversation_id = self._service(rows)
        page = self._read(service, conversation_id, offset=0)
        self.assertEqual({item.text for item in page.items}, {"最早", "最晚"})

    def test_c7_messages_with_identical_timestamp_are_all_returned(self):
        rows = [
            [3001, BASE + 60, 2, "同一秒 A", 1, "wxid_friend", 0, None],
            [3002, BASE + 60, 2, "同一秒 B", 1, "wxid_friend", 0, None],
        ]
        service, conversation_id = self._service(rows)
        page = self._read(service, conversation_id, offset=0)
        self.assertEqual(len(page.items), 2)

    def test_c8_message_ids_are_stable_across_repeated_reads(self):
        service, conversation_id = self._service(self._rows(30))
        first = self._read(service, conversation_id, offset=0)
        second = self._read(service, conversation_id, offset=0)
        self.assertEqual([item.id for item in first.items],
                         [item.id for item in second.items])

    def test_c9_a_new_message_arriving_between_pages_pushes_the_oldest_out(self):
        service, conversation_id = self._service(self._rows(250))
        before_ids = [str(item.id) for item in self._read(service, conversation_id, offset=0).items]
        oldest_before = before_ids[-1]

        db = service._databases[AccountId("fp:account")]
        db.message_rows.append(
            [9001, BASE + 2000, 2, "刚到的新消息", 1, "wxid_friend", 0, None]
        )
        after_ids = [str(item.id) for item in self._read(service, conversation_id, offset=0).items]

        self.assertTrue(any(value.startswith("fp:conversation:9001:t") for value in after_ids))
        self.assertNotIn(oldest_before, after_ids, '新消息会把最旧的一条挤出第 1 页')
        # 在同一窗口内继续翻 offset=200 仍能取回它：分页本身不会丢。
        self.assertIn(oldest_before,
                      [str(item.id) for item in self._read(service, conversation_id, offset=200).items])

    def test_c11_cursor_advance_drops_the_oldest_message_permanently(self):
        """真正的漏单点：窗口起点随游标前移，而不是分页本身。

        客户端把窗口起点设为「游标 - 2 分钟」。若一次读取返回 200 条以上、
        只处理了第 1 页并把游标推进到该页最新一条，那么被挤出第 1 页的旧消息
        会落到新窗口之外，之后无论翻多少页都取不回来。
        """
        service, conversation_id = self._service(self._rows(250))
        first = self._read(service, conversation_id, offset=0)
        newest_time = int(first.items[0].timestamp.timestamp())
        oldest_of_first_page = str(first.items[-1].id)

        # 模拟下一次读取：游标 = 第 1 页最新一条，窗口起点 = 游标 - 2 分钟
        moved_start = _iso_of(newest_time - 2 * 60)
        next_page = service.getMessages(
            conversation_id,
            TimeRange(start=moved_start, end=WINDOW_END),
            Page(offset=0, limit=200),
        )
        next_ids = [str(item.id) for item in next_page.items]
        # 游标 - 2min 之前的所有消息永久落在窗口外：既含第 1 页里最旧的一条，
        # 也含从未被第 1 页返回的溢出消息。
        self.assertNotIn(oldest_of_first_page, next_ids, '第 1 页最旧消息已落在新窗口之外')
        self.assertNotIn("fp:conversation:1000", next_ids, '溢出消息同样永久不可达')
        # 新窗口只剩 121 条（create_time >= BASE+129），不再满页。
        self.assertEqual(len(next_page.items), 121)
        self.assertFalse(next_page.hasMore)

    def test_c10_offset_beyond_the_end_returns_nothing(self):
        service, conversation_id = self._service(self._rows(400))
        page = self._read(service, conversation_id, offset=400)
        self.assertEqual(len(page.items), 0)
        self.assertFalse(page.hasMore)


if __name__ == "__main__":
    unittest.main()
