# 数据完整性与可靠性

## 1. 可靠性边界

本模块采用“Reader 稳定分页 + 服务端消息台账 + 任务独占领取 + 保存事务”四层保护。它能拒绝已知的不完整/重复提交，但不能承诺任何微信版本、任意本地库延迟或永久缺失原图下“绝对不漏单”。失败必须可见、可重试，且不能把失败当作空结果推进游标。

## 2. 200 条分页合同

### 2.1 “200 条”的含义

200 是每页最多 200 条**微信原始消息**，不是客户数，也不是商品行数：

- 20 个人各发一条消息 = 20 条。
- 一条消息包含 30 个商品 = 1 条。
- 同一张图被发送两次 = 2 条物理消息；任务层可以按相同原图字节合并展示，但台账仍登记两个消息指纹。

首次没有 V2 扫描游标时，Vue 默认查询最近 24 小时。`readWechatMessageWindow` 每页发送 `limit=200`；只要 `hasMore=true` 就传回 `nextPageKey` 继续，设有异常循环上限以防错误协议无限翻页。

### 2.2 Keyset 与 pageKey

稳定分页必须使用固定 `timeRange.start/end`。Reader 当前排序身份由以下元组构成（降序）：

```text
(create_time, source_kind_rank, source_id, server_id, local_id, sequence)
```

其中 `source_kind_rank` 用于在消息分片/会话补充/资源记录之间稳定排序；具体值是内部实现，业务层不得依赖。`pageKey` 是 Reader 签名令牌，不等于 `Message.id`，包含：

- 协议版本和查询指纹。
- 本次固定的消息分片 manifest。
- 当前游标元组。
- 同秒已见消息身份摘要。
- 初始结果规模等完整性信息。

`nextPageKey` 必须原样回传。调用方不得解析、修改或用业务消息 ID 替代。

### 2.3 同秒、分片与并发新消息

- 同毫秒/同秒消息由完整复合键和已见身份集合消除页边界重复。
- 201、400、450 条等场景按 200/200/余数读取；Electron 到 Java 的登记也以 200 条为批次。
- 翻页开始后，排在当前 key **之后**的新消息不插入本次结果集，由下一次扫描读取。
- 排在当前 key **之前**且仍在固定窗口内的延迟写入消息可在后续页被看见。
- 分片新增/移除/替换、查询条件变化或令牌篡改返回可重试错误，不返回伪造的完整页。
- `hasMore=true` 却没有 `nextPageKey`，或 pageKey 重复，Vue 必须报错并停止提交。

Reader 测试 `test_keyset_pagination_v3.py`、`test_keyset_provider_sql_v3.py` 和 `test_message_pagination.py` 覆盖分页、同秒/多分片和消息完整性。2026-10-23 当前工作区 Reader 55 项测试通过。

## 3. 三层身份与去重

### 3.1 Reader 原始消息 ID

Reader `Message.id` 是不泄露 wxid/表名的稳定不可逆标识。它来源于只读库中的稳定记录身份，而不是显示文本，因此老板修改商品文字不能改变它。

### 3.2 业务消息指纹

Vue 把 Reader `Message.id` 作为 `messageFingerprint` 提交。数据库唯一约束：

```text
uk_dep_wechat_message(
  dis_id,
  account_fingerprint,
  conversation_fingerprint,
  message_fingerprint
)
```

同一租户、账号、会话和消息的重复扫描只更新允许变化的恢复字段，不新建第二条台账。正式订单完成后仍保留行用于全局去重。

### 3.3 Reader 分页键

`pageKey` 只保证一次查询窗口的页连续性；它不能持久化为业务消息身份，也不能代替服务端扫描游标。

### 3.4 任务和订单幂等

- 任务：`nx_department_wechat_order_task` 的 `(dis_id, source_key)` 唯一；消息从 `UNCLAIMED` 原子变为 `TASK_CLAIMED` 并绑定 `wechat_task_id`。同一消息不能同时进入两个 PENDING 任务。
- 扫描请求：begin/batch/finalize 使用稳定动作名、幂等 key 和 SHA-256 内容摘要；成功响应丢失后相同请求可取得原收据。
- 正式订单：保存前校验消息仍为 `RECEIVED` 且属于当前任务；保存后 `markOrderCreated` 的更新数量必须等于来源消息数，随后任务变 `ORDER_CREATED`。数量不符抛异常并让订单事务回滚。

三层不能互相替代：数据库消息唯一键不等于任务 source key；任务复用也不代表订单已经保存。

## 4. 扫描游标

### 4.1 旧游标与 V2 游标

`nx_department` 同时保留：

- 旧：`nx_department_wechat_cursor_time_ms`、`nx_department_wechat_cursor_message_id`。
- V2：`nx_department_wechat_scan_cursor_time_ms`、`nx_department_wechat_scan_protocol_version`、`nx_department_wechat_scan_last_id`。

可靠扫描以 V2 固定窗口结束时间为主；旧字段为兼容和旧保存语义保留，后续不能混写成同一概念。

### 4.2 允许推进的条件

只有 `CustomerWechatScanV2Service.finalizeScan` 验证以下条件后才推进：

1. 当前租户/客户仍存在同一账号和会话绑定。
2. `bindingRevision` 与 begin 时一致。
3. expected batch count/message count 合法（最多 100 批、20,000 条）。
4. 每批幂等收据存在，批号、条数和 batch digest 一致。
5. scan digest 和消息指纹集合无重复/缺失。
6. 消息台账登记完成。

游标单调推进到完整扫描的固定 `windowEndTimeMs`，并记录协议版本和 `scanId`。任一批失败、Reader 分页失败、绑定变化、摘要不符或事务回滚，都不得 finalize。

### 4.3 重新绑定与恢复

账号、会话或群规则变化会递增 `bindingRevision` 并重置扫描身份/游标。旧 revision 的 begin、batch、finalize、claim 或正式保存请求返回冲突，要求重新读取。

网络超时后，客户端可用同一 scan/batch/finalize 请求重试；服务端幂等收据防止重复副作用。Reader 崩溃由 Electron bridge 重启；Electron 重启后，服务端台账、pending 消息和 PENDING 任务仍可恢复。

### 4.4 重叠窗口与晚写范围

HEAD 的稳定保证来自固定查询窗口、Keyset 分页和“完成后才推进”。核查时**未提交本地工作区**额外实现：

- 已有游标时向前重叠约 15 分钟。
- 查询结束时间向未来容忍约 2 分钟微信/电脑时钟偏差。
- 对服务端仍为 `UNCLAIMED` 的更早消息扩展恢复起点。
- 读取可见会话 `SessionTable` 补充最近消息。

这些能力有助于处理微信延迟写库，但尚未形成可复现提交且相关桌面测试并非全绿，不能写成正式发布保证。即使提交后，也只能覆盖重叠范围内的晚写消息；超出窗口或源库永久缺失仍需人工检查。

## 5. 图片 deferred 与恢复

### 5.1 初始登记

图片消息先登记：

- `message_kind=IMAGE`
- `processing_state=ATTACHMENT_PENDING`
- `reader_attachment_id`
- 签名 `reader_locator`

Reader locator 封装重新定位所需的非明文信息，使 Reader 重启后仍可根据 `attachmentId + locator` 查找原图；数据库不保存本地路径、wxid 或解密材料。

### 5.2 恢复流程

1. Vue 查询 `GET /{customerId}/messages/pending`。
2. 到达 `attachment_next_retry_at` 的图片调用 Reader `getAttachment`。
3. 成功：上报 `recovered=true`，服务端改为 `UNCLAIMED`，随后可进入图片任务领取。
4. 暂不可用：上报稳定错误码，服务端改为 `ATTACHMENT_UNAVAILABLE`，增加 `attachment_retry_count`，按指数退避设置下次时间（上限 60 分钟）。
5. 后续扫描或重启恢复继续查询 pending；不因一次失败推进为正式订单。

系统必须使用可验证原图。缩略图只可用于提示/预览，不能作为正式 OCR 输入。若原图永久不可用，当前实际行为是保留 unavailable 状态和错误码供人工处理；没有自动“猜图”或自动忽略。

## 6. 待确认任务生命周期

### 6.1 表与状态

`nx_department_wechat_order_task` 关键字段：

- 身份：`dis_id`、`customer_id`、`department_id`、`binding_revision`、`source_key`。
- 内容：`task_kind`、`draft_text`、`draft_revision`。
- 完成：`ocr_task_id`、`status`。
- 唯一：`uk_wechat_order_task_source(dis_id, source_key)`。

状态：

- `PENDING`：待老板确认，重启可恢复。
- `DISCARDED`：回退；未完成消息释放，可再次领取/重新激活。
- `IGNORED`：明确非订单；消息也被忽略，不再出现。
- `ORDER_CREATED`：正式订单已生成并关联 `ocr_task_id`。

消息台账的 `processing_state` 与任务状态分开：`UNCLAIMED`、`TASK_CLAIMED`、`ATTACHMENT_PENDING`、`ATTACHMENT_UNAVAILABLE`、`MIXED_IMAGE_NOTICE_PENDING`、`MIXED_IMAGE_NOTICE_SHOWN`、`IGNORED`。

### 6.2 草稿和增量消息

`claimTask` 在事务内锁定绑定和消息，按 source key 创建或复用任务。已 `DISCARDED` 且未生成 OCR 任务的相同 source 可恢复为 `PENDING`。后续新增消息可以原子追加到同一任务，前提是仍处于允许领取的状态。

老板修改后的文本通过 `PATCH /tasks/{id}/draft` 保存。请求携带当前 `draftRevision`；成功后 revision 递增。过期 revision 必须冲突，不能覆盖更新较新的草稿。

### 6.3 关闭、重复读取和正式保存

- 普通关闭：PENDING 和草稿留在服务端，下次 `tasks/pending` 分页恢复。
- 重复读取：消息唯一键与 task source key 复用原任务，而不是复制任务。
- discard：释放消息为 `UNCLAIMED` 或图片 pending；任务可再次激活。
- ignore：消息/任务永久忽略。
- 保存：订单写入与消息/任务完成同事务（已验证文本链路）。

## 7. 数据库索引

### 7.1 `nx_department`

微信绑定字段：`nx_department_wechat_display_name`、`_account_fp`、`_conversation_fp`、`_conversation_kind`、`_group_mode`、`_binding_revision`、`_enabled`。游标字段见 4.1；`_last_sync_at` 记录最近读取时间。

唯一约束 `uk_nx_department_wechat_friend(distributor, account_fp, conversation_fp)` 防止同一会话在同租户重复绑定。

### 7.2 `nx_department_wechat_order_message`

身份字段：`dis_id`、`department_id`、`account_fingerprint`、`conversation_fingerprint`、`message_fingerprint`、`message_time_ms`、`binding_revision`。状态/恢复字段：`status`、`processing_state`、`order_task_id`、`wechat_task_id`、`message_kind`、`reader_locator`、`reader_attachment_id`、附件重试字段。

允许更新：绑定转移时未完成行的客户/revision，Reader locator/附件状态和重试信息，任务领取关系，最终 status/process 时间。不可因老板编辑订单而更新：账号、会话、消息指纹和消息时间。

### 7.3 `nx_department_wechat_order_task`

详见 6.1。Migration 03 明确：微信待确认草稿不是 OCR 任务；只有用户实际保存文字订单或发起图片识别时才创建/关联 `nx_ocr_task`。Migration 02 曾向 `nx_ocr_task` 添加来源/草稿字段，Migration 03 的独立任务表是当前模型，不能退回到扫描即创建 OCR 任务。

## 8. 异常场景矩阵

| 场景 | 当前机制 | 结果 |
|---|---|---|
| <=200 条正常提交 | 单次 `scans/commit`，内部复用 begin/batch/finalize 事务 | 台账和游标一起完成 |
| 450 条 | 200+200+50 三批，最后 finalize | 任一批缺失不推进 |
| 中间批失败 | 客户端停止，保留已成功幂等收据 | 同 scan 重试缺失批；不伪完成 |
| 成功但响应丢失 | action/key/content digest 幂等收据 | 相同请求返回既有结果 |
| 重复扫描 | 消息唯一键 + upsert 限制 | 不复制已完成消息 |
| 客户绑定变化 | FOR UPDATE + revision/identity 校验 | 409 冲突，要求重读 |
| 同任务重复保存 | preflight 状态/归属校验 + 精确更新计数 | 第二次拒绝，避免第二张订单 |
| 保存中异常 | 外层订单事务 rollback-only | 订单与消息完成状态一起回滚（文本链路） |
| Reader 崩溃 | bridge 重启 + 服务端 pending/locator | 重新查询并恢复，不靠内存任务 |
| 原图未下载 | deferred + 退避重试 | 保留警告，不用缩略图冒充 |
