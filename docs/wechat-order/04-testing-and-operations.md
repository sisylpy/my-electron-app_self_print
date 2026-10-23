# 测试、运行与问题排查

## 1. 环境与启动

### 1.1 桌面端

仓库：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic`

```bash
npm install
npm start
```

`npm start` 同时运行 Vue development 模式和 Electron。构建入口：

```bash
npm run build:vue          # production Vue
npm run build:vue:test     # test Vue
npm run dist:mac           # 正式 Mac 包
npm run dist:mac:test      # 测试 Mac 包，独立 appId/输出目录
npm run dist:win           # Windows 包
```

开发、测试安装包和正式包使用不同 runtime mode/API 环境。测试构建、测试部署不能当作生产发布；没有用户明确要求时不得 push、部署或覆盖正式安装包。

### 1.2 Reader

macOS 使用系统 `python3`；Windows 安装包使用 `src/wechat/reader-runtime/python-win/python.exe`。Reader 材料按 `(machine, account)` 隔离：

- Mac：`~/Library/Application Support/nongxinle-pos/reader-materials/mac/materials`
- Windows：`%APPDATA%\nongxinle-pos\reader-materials\windows\materials`

不要复制其他账号/机器的材料，也不要把材料、数据库密钥或库路径写入问题单。

### 1.3 Java 服务端

仓库：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/nongxinle-server`

```bash
mvn test
mvn -DskipTests package
```

真实部署需遵守服务端仓库自己的 `AGENTS.md`、环境脚本和 Migration 流程。本轮文档核查未部署任何环境。

## 2. 核心自动化测试入口

### 2.1 Reader

必须设置 product 的模块搜索路径：

```bash
PYTHONPATH="$PWD/src/wechat/reader-runtime" \
python3 -m unittest discover \
  -s src/wechat/reader-runtime/tests -p 'test_*.py'
```

主要覆盖：

- `test_keyset_pagination_v3.py`：Keyset、令牌、分片变化和同秒边界。
- `test_keyset_provider_sql_v3.py`：provider 查询复合排序。
- `test_message_pagination.py`：跨页消息完整性（核查时为未跟踪测试）。
- `test_message_query_cache.py`：只读查询缓存失效。
- `test_image_attachment.py`、`test_image_resource_fallback.py`：图片定位与恢复。
- `test_message_text.py`、`test_compressed_message_text.py`：文字解码/可见文本。
- `test_self_participant.py`、`test_time_range.py`：自身身份和时间窗。

直接在仓库根执行、不设置 `PYTHONPATH` 会报 `ModuleNotFoundError: product`；这属于测试启动方式错误，不是 Reader 断言失败。

### 2.2 Vue/Electron 纯逻辑测试

这些测试可逐个以 Node 运行：

```bash
node tests/wechat-reliable-scan-gateway.test.mjs
node scripts/wechat-auto-read-scheduler.test.cjs
node scripts/wechat-image-container-decoder.test.js
node scripts/wechat-order-task-split.test.mjs
node vue/src/modules/order/services/wechatOrderMessagePolicy.test.mjs
node vue/src/modules/order/services/wechatOrderReliabilityV2.test.mjs
node vue/src/modules/order/services/wechatOrderImport.test.mjs
node vue/src/modules/order/services/wechatTaskDiscardFlow.test.mjs
node vue/src/modules/order/services/wechatTaskIgnoreFlow.test.mjs
```

相关覆盖索引：

| 主题 | 文件 |
|---|---|
| 450 条 200+200+50 批次 | `tests/wechat-reliable-scan-gateway.test.mjs` |
| 消息过滤/混合群 | `wechatOrderMessagePolicy.test.mjs` |
| 任务切分/图片重复 | `wechatOrderTaskSplit.test.mjs`、`scripts/wechat-order-task-split.test.mjs` |
| pending 图片/任务恢复 | `wechatOrderImport-pending-recovery.test.mjs` |
| 扫描完整性/图片游标 | `wechatOrderImport-completeness.test.mjs`、`wechatOrderImport-image-cursor.test.mjs`（核查时未跟踪） |
| 全部客户扫描 | `wechatAllCustomerScan.test.mjs`、`wechatAllCustomerTiming.test.mjs` |
| 绑定和客户匹配 | `wechatCustomerAssociation.test.mjs`、`wechatCustomerMatchFlow.test.mjs` |
| 草稿刷新/关闭巡查报告 | `wechatScanReportDraftRefresh.test.mjs` |
| 追加/统一添加订单 | `wechatManualAppendOrder.test.mjs`、`unifiedAddOrderEntry.test.mjs` |
| ignore/discard | `wechatTaskIgnoreFlow.test.mjs`、`wechatTaskDiscardFlow.test.mjs` |
| 自动扫描 | `scripts/wechat-auto-read-scheduler.test.cjs` |
| 进程/登录状态 | `tests/wechat-process-state.test.mjs`、`tests/wechat-login-state-probe.test.mjs` |

`scripts/wechat-current-conversation-smoke.js`、`scripts/wechat-ui-automation-smoke.js`、`scripts/wechat-reader-runtime-smoke.js` 是真机/环境 smoke，不应在无微信、无辅助功能授权或生产账号上盲跑。

### 2.3 Java 服务端

定向命令：

```bash
mvn -Dtest=CustomerWechatBindingTransferContractTest,\
CustomerWechatGroupBindingContractTest,\
CustomerWechatNicknameProfileContractTest,\
CustomerWechatOrderSaveReliabilityTest,\
CustomerWechatScanV2MigrationContractTest,\
CustomerWechatScanV2ServiceTest test
```

覆盖：绑定/群规则、Migration 合同、<=200 与多批事务、幂等重试、附件状态、任务领取/恢复/草稿、订单保存事务。正式修改 `OcrController` 图片链路时还应运行 `OcrControllerImagePersistenceTest` 和相关 OCR 保存测试。

## 3. 2026-10-23 实际测试记录

测试针对 README 所列版本以及核查时桌面端未提交工作区；因此结果不能等同于纯 HEAD CI。

| 测试 | 结果 | 说明 |
|---|---|---|
| Reader unittest | **55/55 通过** | 修正 `PYTHONPATH` 后执行 |
| 可靠扫描网关 | **2/2 通过** | 包含 450 条 200+200+50 和任务增量领取 |
| Node 微信测试批次 | **合计 26 个文件通过、7 个文件失败** | 包含自动扫描测试；失败清单如下 |
| Java 微信定向测试 | **33 项中 31 通过、2 失败** | 构建失败来自 `CustomerWechatBindingTransferContractTest` 两项 |
| Mac 人工验收 | **用户确认上方测试全部通过** | 连续新消息、全面检查、报告关闭刷新、添加/追加订单；为当前 Mac 工作区观察 |
| Windows 真机全链路 | **未验证** | 静态 PowerShell/Node 测试不能替代 |

桌面端失败文件：

- `scripts/wechat-order-task-routing.test.mjs`
- `vue/src/modules/order/services/wechatAllCustomerTiming.test.mjs`
- `wechatOrderImport-completeness.test.mjs`
- `wechatOrderImport-image-cursor.test.mjs`
- `wechatOrderImport.test.mjs`
- `wechatOrderWorkspaceEntry.test.mjs`
- `wechatScanQuickSave.test.mjs`

它们主要是源码字符串/结构契约与当前未提交重构不同步。不能简单认定产品一定坏，也不能忽略；提交桌面端业务改动前必须逐项判断“实现回归”还是“测试需更新”，使目标集合全绿。

Java 失败：

- `CustomerWechatBindingTransferContractTest.bindingUpdateMovesAnExistingConversationAndKeepsItsCursor`
- `CustomerWechatBindingTransferContractTest.unfinishedMessagesFollowTheConversationButCreatedOrdersDoNot`

服务端仓库当时是干净 HEAD，因此这是当前正式基线的明确待核实项。后续不得在未解释语义差异的情况下删除测试。

## 4. 性能测量

### 4.1 日志

`OrderWorkbenchV2.vue` 的 `createWechatOrderTiming` / `recordWechatServiceTiming` 写入 `wechat-order-timing` 结构化日志。每次操作有 `traceId`，记录：

- 当前会话识别/客户目录。
- 微信工作区打开与会话聚焦。
- Reader 冷启动、账号/参与者、消息分页查询。
- 消息过滤、图片恢复。
- 服务端 pending、scan commit、task claim。
- 报告或确认页展示前总耗时与结果计数。

日志只能记录时间、数量、状态和脱敏错误；不得记录聊天原文、微信数据库密钥、数据库路径、原始 wxid、Cookie 或 API Token。

### 4.2 分析脚本

核查时本地有未跟踪脚本 `scripts/wechat-order-perf-analyze.mjs`：

```bash
node scripts/wechat-order-perf-analyze.mjs \
  --log-dir "$HOME/Library/Application Support/GrainPrint/logs" \
  --out wechat-order-perf-report.csv \
  --jsonl wechat-order-perf.jsonl
```

它按 traceId 聚合 `wechat-order-timing`。在该脚本正式提交前，不能作为发布流水线必备工具。

### 4.3 记录性能基线的最低信息

每个性能结论必须写明：日期、桌面端 commit/是否有 dirty worktree、Java commit、Mac/Windows 和硬件、微信版本、冷/热 Reader、当前会话或全部客户、绑定客户数、原始消息数/图片数、网络环境、P50/P95 或至少多次样本。

目前没有满足上述条件的 V2 可复现报告。因此历史“2～4 秒”只能作为旧场景观察，不能成为当前全部扫描、图片恢复或冷启动的 SLA。

## 5. 真机验证清单

### 5.1 Mac

1. 确认微信已登录、目标会话标题唯一，GrainPrint 获得辅助功能权限。
2. 绑定一个好友、专属群、混合群；切换另一微信账号验证旧绑定不误读。
3. 首次 24 小时读取；分别测试 199/200/201/400/450 条 fixture 或可控测试数据。
4. 发送同秒多条、连续新增、关闭/重启 Electron，确认任务和草稿恢复。
5. 原图已下载/未下载、相同图片重复、混合群图片提醒。
6. 绑定改名/转移后确认旧请求冲突而非串客户。
7. 保存文本订单后重复扫描/重复保存，确认无第二张正式订单。
8. 查看 `wechat-order-timing`，确认没有敏感内容。

### 5.2 Windows

必须在真实 Windows + 支持版本微信上重复上述关键路径，并验证 UIA 标题、窗口聚焦、随包 Python、Reader 材料路径和原图解码。Mac 成功不能替代 Windows 验收。

## 6. 故障排查顺序

### 6.1 当前微信账号无法识别

1. 确认微信进程和登录状态。
2. 调用 Reader `diagnose`、`listAccounts`，查看产品错误码。
3. 检查材料是否属于当前 machine/account，是否过期。
4. 检查微信版本是否在已验证矩阵；未知组合应返回 `UNSUPPORTED_WECHAT_VERSION`。
5. 不要输出密钥、路径或原始账号 ID。

### 6.2 无法切换好友/群

1. 检查辅助功能/UIA 权限。
2. 用 `currentConversation` 读取当前可见标题。
3. 查看目标是否同名歧义、改名或头像/名称缓存过期。
4. 聚焦后再次验证标题；标题不符立即停止 Reader 归属。
5. 分平台检查 `src/wechat/ui-automation/mac` 或 `windows`，不要改共享业务规则绕过。

### 6.3 Reader 无数据或只到 200 条

1. 检查固定 start/end 和首个 `pageKey=null`。
2. 逐页记录 `items.length`、`hasMore`、是否有 `nextPageKey`（不记录 token 内容）。
3. 若 `hasMore=true` 但 key 缺失/重复，按协议失败，不能 finalize。
4. 检查分片 manifest 变化、Reader stderr 的脱敏错误码。
5. 运行三项分页测试，不要把 page size 当总上限。

### 6.4 图片原图未下载

1. 查消息 `processing_state`、attachment ID、retry count、next retry time。
2. 确认微信中打开的是正确会话并等待原图下载。
3. 用 locator 重试 `getAttachment`，不要保存缩略图路径。
4. 上报稳定错误码；不要把错误正文/路径写入数据库。

### 6.5 重复订单或任务丢失

1. 按账号/会话/消息指纹查唯一台账。
2. 查 `status`、`processing_state`、`wechat_task_id`、task `source_key/status/draft_revision`。
3. 核对是否错误使用 discard（会再出现）代替 ignore（永久非订单）。
4. 核对保存 payload 是否携带原 `wechatOrderSource` 和 task ID。
5. 不直接手改数据库“修复”；先重现幂等/事务路径。

### 6.6 服务端游标异常

1. 对比 binding revision、account/conversation fingerprint。
2. 查 scanId、protocol version 和 fixed window end。
3. 确认所有 batch 收据/digest 完整后才 finalize。
4. 绑定变化或任何批失败时游标必须保持原值。

### 6.7 待确认任务无法恢复

1. 调用 `/tasks/pending` 分页，不只读第一页。
2. 查任务是否 PENDING、是否已有 `ocr_task_id`。
3. 查消息是否仍 `TASK_CLAIMED` 且指向同一 task。
4. 查草稿 revision 冲突和客户/部门权限。
5. 检查前端关闭路径是否误调用 ignore/discard。

## 7. 日志和隐私

允许：traceId、阶段名、耗时、消息/页/任务数量、脱敏指纹前后无原文的错误码、是否冷启动。

禁止：聊天原文、图片 Base64、数据库密钥、API Token/Cookie、数据库/附件绝对路径、原始 wxid/chatroom、完整 Reader locator/pageKey。提交日志样本前必须再次脱敏。
