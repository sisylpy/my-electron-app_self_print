# 技术架构与真实调用链

## 1. 总体数据流

```text
用户点击读取/全面检查
  -> Vue OrderWorkbenchV2 / WechatOrderImportModal
  -> Electron preload 暴露的 wechatUi / wechatReader / customerWechatOrders
  -> main.js IPC handler
  -> (界面定位) UI Automation: macOS Accessibility/AppleScript 或 Windows UIA/PowerShell
  -> (本地消息) reader-service -> reader-bridge -> Python NDJSON Reader -> 微信只读本地库/资源库
  -> Vue 过滤、分组、附件恢复、构造 source
  -> dispatch-gateway -> Java DesktopCustomerWechat*Controller
  -> CustomerWechatScanV2Service -> 消息台账、扫描游标、待确认任务
  -> Vue 订单编辑/AI解析/图片识别
  -> OcrController 正式保存
  -> CustomerWechatOrderService 同事务完成消息和任务
```

UI 自动化只负责找到/打开正确会话和验证可见标题；Reader 才负责读取本地消息。Electron 不应向微信发送订单文本，也不应修改微信聊天数据库。

## 2. Vue 工作台

### 2.1 入口和编排

主入口：`vue/src/modules/order/views/OrderWorkbenchV2.vue`。

| 目的 | 当前函数/对象 | 执行方式 |
|---|---|---|
| 打开微信读取流程 | `handleWechatScan` | async；恢复任务并打开/聚焦微信工作区 |
| 读取未读会话 | `readUnreadWechatOrders` | async；通过 `wechatUi` 逐个读取允许的标题 |
| 扫描全部绑定 | `requestWechatFullRescan` -> `scanAllBoundWechatOrders` | async 串行编排；逐客户记录结果与性能阶段 |
| 显示选中会话 | `showSelectedWechatConversation` | async；可见标题匹配客户并加载今日订单 |
| 刷新选中会话 | `refreshSelectedWechatConversation` | async；读取新增消息并合并到当前任务 |
| 恢复草稿 | `restoreWechatDraftTasks` | async；分页调用服务端 pending tasks |

弹窗：`vue/src/modules/order/components/workbench/WechatOrderImportModal.vue`。它展示扫描状态、任务卡片、巡查报告、当前会话客户匹配以及活动任务的订单编辑插槽；不自行读数据库。

### 2.2 客户匹配与绑定

- `wechatCustomerAssociation.js`：建立客户目录、核查名称/头像和已有绑定。
- `wechatCustomerMatchFlow`（核查时为本地工作区测试覆盖能力）：当前微信未匹配时由用户选择客户。
- `customerWechatBinding.js`：客户中心绑定展示和群模式。
- 真正的保存通过 `window.electronAPI.customerWechatOrders.saveBinding`，再由 Java 唯一约束裁决。

### 2.3 消息读取与过滤

`vue/src/modules/order/services/wechatOrderImport.js` 的 `prepareWechatOrderImport` 是核心同步编排函数（内部大量异步 I/O）：

1. 校验 Electron API、客户 ID 和绑定。
2. 获取当前账号参与者/自身身份。
3. 依据扫描游标决定时间窗；首次无游标读取最近 24 小时。
4. `readWechatMessageWindow` 用固定 `timeRange.end` 和 Keyset `pageKey` 读取每页最多 200 条，直到 `hasMore=false`。
5. `selectWechatOrderMessages` 执行发送人、文本可读性、好友/群/@规则过滤。
6. 为文字、图片、混合群图片构造不同 processing state。
7. `commitReliableScan` 先登记台账并在完整提交后推进游标。
8. 恢复 deferred 图片，领取/复用任务，生成导入 payload。

核查时本地工作区在 HEAD 之上还加入 15 分钟扫描重叠、2 分钟时钟偏差和 `SessionTable` 补充等改动。它们未提交，不能作为正式 HEAD 合同；见 [可靠性文档](./03-reliability.md)。

消息政策：`wechatOrderMessagePolicy.js`。任务切分：`wechatOrderTaskSplit.js`。相同原图字节的去重只影响任务展示，不改变物理消息指纹集合。

### 2.4 编辑与保存

`AiOrderPanel.vue` 和现有 `PlaceOrderWorkspace`/`placeOrderController.js` 承接导入 payload：

- 文字写入现有粘贴编辑区，老板可修改/删除并使用 AI 解析。
- 图片进入现有识别流程。
- 草稿变化回传工作台，由 `customerWechatOrders.updateDraft` 持久化。
- 正式保存 payload 保留 `wechatOrderSource`，进入 Java `OcrController`。

用户编辑的是订单内容，不得改写 `source.messages[].messageFingerprint` 等来源身份。

## 3. Electron 主进程与 IPC

### 3.1 preload 公共接口

`src/preload.js` 通过 `contextBridge` 暴露受限接口：

**`wechatReader`**

- `diagnose()`
- `listAccounts()`
- `warmUp()`
- `findConversation(accountId, name)`
- `getParticipants(conversationId)`
- `getSelfParticipant(conversationId)`
- `getMessages(conversationId, timeRange, page)`
- `getAttachment(attachmentId, locator)`
- `lastColdStart()`

**`wechatUi`**

- `inspectUnread({allowedTitles})`
- `readUnread({allowedTitles})`
- `currentConversation(...)`
- `focusConversation(...)`
- `openWorkspace()` / `focusWorkspace()` / `closeWorkspace()`
- `onWorkspaceCloseRequested`、`onConversationChanged` 事件。

**`customerWechatOrders`**

- V1 绑定：`loadBinding`、`saveBinding`、`clearBinding`。
- V2：`commitReliableScan`、`claimTask`、`loadPendingTasks`、`discardTasks`、`ignoreTasks`、`loadPendingMessages`、`updateDraft`、`reportAttachment`、`acknowledgeMixedImage`。

**`wechatAutoRead`**

- `getConfig` / `setConfig`
- `getCustomerParticipation` / `setCustomerParticipation`
- `onTrigger` / `finish`

### 3.2 主进程职责

`src/main.js` 的 `setupIpcHandlers` 注册对应 `wechat-reader-*`、`wechat-ui-*`、`customer-wechat-*`、`wechat-auto-read-*` handler，并对渲染来源调用 `assertTrustedRendererEvent`。

- Reader handler 委托 `src/wechat/reader-service.js`。
- UI handler 委托 `src/wechat/ui-automation-service.js` 和 `src/wechat/workspace-window-service.js`。
- 客户微信订单 handler 委托 `src/dispatch/dispatch-gateway.js`。
- 应用退出时停止 Reader/UI 自动化并恢复微信工作区窗口；错误只记脱敏日志。

### 3.3 Mac/Windows UI 自动化

macOS 实现在 `src/wechat/ui-automation/mac/`，使用 Accessibility、AppleScript、CoreGraphics/截图辅助。Windows 实现在 `src/wechat/ui-automation/windows/`，使用 PowerShell/UI Automation。两端都必须在读取前后验证可见会话标题；平台适配层不能把“点击成功”当作“进入目标会话成功”。

跨平台共享业务逻辑位于 Vue、Electron IPC 和 Reader 产品层。平台差异不得扩散成两套消息/任务业务规则。

## 4. Reader 架构

### 4.1 生命周期

- `src/wechat/reader-service.js`：对 IPC 提供稳定 `{ok,data/error}` 结果，负责参数约束和 DTO 清理。
- `src/wechat/reader-bridge.js`：启动持久 Python 子进程，按行发送 NDJSON，匹配请求 ID，跟踪冷启动。
- `src/wechat/reader-runtime-resolver.js`：macOS 选择系统 `python3`；Windows 安装包使用随包 `python-win/python.exe`。
- `src/wechat/reader-runtime/product/bridge/ndjson_main.py`：协议入口。
- `src/wechat/reader-runtime/product/WechatLocalDataService.py`：产品服务。
- `src/wechat/reader-runtime/product/providers/mac|windows` 与 `providers/common.py`：只读库/分片查询和平台材料适配。

Bridge 启动超时 15 秒，普通请求 60 秒，附件请求 90 秒；连续失败会终止/重建子进程。关闭时先发 `shutdown`，再做进程级兜底。所有请求异步，stdout 只允许协议帧，调试信息走 stderr。

### 4.2 NDJSON 合同

请求：

```json
{"id":"request-id","method":"getMessages","params":{"conversationId":"fp:...","timeRange":{"start":"...","end":"..."},"page":{"limit":200,"pageKey":null}}}
```

响应：

```json
{"id":"request-id","ok":true,"result":{"items":[],"hasMore":false,"nextPageKey":null}}
```

错误：

```json
{"id":"request-id","ok":false,"error":{"code":"NO_DATA","message":"...","retryable":true,"needsReinit":false,"needsUserAction":false}}
```

ready 事件当前 Python runtime 协议版本为 `3`；Electron `reader-bridge.js` 的最低接受版本是 `2`，即按整数比较接受 `>=2`。方法集合包括 `diagnose`、`listAccounts`、`findConversation`、`getMessages`、`searchMessages`、`getParticipants`、`resolveSender`、`getAttachment`、`ping`、`shutdown`；Electron preload 只开放业务需要的子集。

产品错误码：`READY`、`NO_ACCOUNT`、`WECHAT_NOT_INSTALLED`、`ACCESS_NOT_READY`、`ACCESS_MATERIAL_EXPIRED`、`UNSUPPORTED_WECHAT_VERSION`、`SCHEMA_UNSUPPORTED`、`CONVERSATION_NOT_FOUND`、`CONVERSATION_AMBIGUOUS`、`NO_DATA`、`PERMISSION_REQUIRED`、`INTEGRITY_CHECK_FAILED`、`INTERNAL_ERROR`。

### 4.3 DTO

消息核心字段：

```text
id, conversationId, timestamp, senderId, senderName,
type(text|image|...), text, attachmentRef?, source
```

附件引用包含不可逆 `id`、`kind`、`mimeHint`，新协议可带签名 `locator`。本地文件路径不跨进程。Reader 会在消息库和资源记录中定位图片变体；缩略图不能冒充正式订单原图。

## 5. Java 服务端

### 5.1 Controller/API 索引

V1 基址：`/api/desktop-dispatch/v1/customer-wechat-orders`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/{customerId}/binding` | 读取绑定 |
| PUT | `/{customerId}/binding` | 保存/转移绑定 |
| DELETE | `/{customerId}/binding` | 清除绑定并提升版本 |

V2 基址：`/api/desktop-dispatch/v2/customer-wechat-orders`

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/{customerId}/scans/begin` | 创建扫描清单/幂等收据 |
| PUT | `/{customerId}/scans/{scanId}/batches/{batchNo}` | 登记最多 200 条消息批次 |
| POST | `/{customerId}/scans/{scanId}/finalize` | 验证所有批次并推进游标 |
| POST | `/{customerId}/scans/commit` | 不超过 200 条的快速原子提交 |
| GET | `/{customerId}/messages/pending` | 查询未完成/附件待恢复消息 |
| POST | `/{customerId}/tasks/claim` | 创建、复用或增量合并任务 |
| GET | `/tasks/pending` | 分页恢复待确认任务 |
| POST | `/tasks/discard` | 回退任务并释放消息 |
| POST | `/tasks/ignore` | 永久忽略非订单任务 |
| PATCH | `/tasks/{taskId}/draft` | 乐观锁更新草稿 |
| POST | `/{customerId}/messages/{messageFingerprint}/attachment` | 上报附件成功/失败 |
| POST | `/{customerId}/messages/{messageFingerprint}/mixed-image-notice` | 确认混合群图片提醒 |

Controller 从 `DesktopDispatchContext` 取得租户 principal；读取要求客户读取权限，写入要求微信订单写权限。客户端不能提交任意 `disId` 绕过租户。

### 5.2 Service 和事务

- `CustomerWechatScanV2Service`：扫描清单、批次摘要、台账、游标、任务、草稿、附件状态。所有写方法 `@Transactional(rollbackFor=Exception.class)`。
- `CustomerWechatOrderService`：绑定、转绑、正式保存 preflight 和 complete。
- `OcrController.pasteSearchGoods`/内部实现：在订单事务开始时 `preflightForOrderSave`，订单落库后 `completeOrderSave`；失败设置 rollback-only。
- 图片异步入口 `recognizeOrderAsync` 已在建任务前 preflight，并把 `wechatOrderSource` 传给后续识别 payload。完整最终落库路径仍需专项测试确认消息完成与订单提交始终共享事务。

### 5.3 Electron 到 Java

`src/dispatch/dispatch-gateway.js` 是唯一网络边界。它严格过滤 payload、校验指纹/数量，计算批次和扫描 SHA-256 摘要；不超过 200 条走 `scans/commit`，超过 200 条依次 begin、PUT batch、finalize。网关返回稳定 `{ok,status,errorCode,message,data}` 形态，Vue 根据错误码决定重试、提示或要求重新绑定。

## 6. 自动扫描如何复用

`src/wechat/auto-read-scheduler.js` 只产生“到时执行”的 trigger，不实现另一套读取逻辑。Vue 接收 trigger 后调用同一 `scanAllBoundWechatOrders({automatic:true,...})`，使用同一绑定目录、Reader、消息政策、V2 台账和任务恢复。成功或失败结束后必须调用 `finish(runId)`；否则调度器会保持活动状态并阻止重复运行。
