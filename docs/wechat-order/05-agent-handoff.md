# 新 Agent 交接手册

## 1. 最省 Token 的阅读顺序

不要每次从整个项目开始读。按任务选择最小路径：

1. 本目录 `README.md`：版本、状态、限制。
2. `01-business-rules.md`：产品规则和不可改变项。
3. 按问题选择：
   - 漏读/重复/分页/恢复：`03-reliability.md`。
   - 调用链/接口：`02-architecture.md`。
   - 运行/失败/真机：`04-testing-and-operations.md`。
4. 只读相关真实源码与对应测试。
5. 涉及跨平台时再读 `docs/DESKTOP_PLATFORM_MATRIX.md`（如果该文件已正式提交）；未提交文件只能作工作区参考。
6. 涉及 Reader 协议时读 `src/wechat/reader-runtime/product/bridge/protocol.md`，不要依赖已过时的 `product/README.md`。

### 按任务快速定位

| 任务 | 首读源码 | 首跑测试 |
|---|---|---|
| 群/@/发送人过滤 | `wechatOrderMessagePolicy.js` | `wechatOrderMessagePolicy.test.mjs` |
| 200+ 分页/漏最新消息 | `wechatOrderImport.js`、Reader service/provider | Reader keyset/message pagination tests |
| 当前会话/微信切换 | `OrderWorkbenchV2.vue`、`ui-automation-service.js`、平台 adapter | current conversation/UI smoke + 真机 |
| 图片不出现/恢复 | Reader attachments、`wechatOrderImport.js`、V2 attachment endpoint | image attachment/resource fallback tests |
| 重复任务/关闭后重现 | task split、claim/discard/ignore | task claim/discard/ignore tests |
| 正式订单重复 | `CustomerWechatOrderService`、`OcrController` | order save reliability tests |
| 自动扫描 | `auto-read-scheduler.js`、`scanAllBoundWechatOrders` | scheduler + all-customer tests |
| 绑定错客户/改名 | customer association、V1 binding service/mapper | binding/group/transfer tests + 真机 |

## 2. 固定修改流程

```text
确认业务需求
-> 定点定位代码与文档合同
-> 检查两个仓库 HEAD/状态
-> 评估 Vue/Electron/Reader/Java/DB/平台影响
-> 先向用户提出最小修改方案和用户可见变化
-> 用户明确批准
-> 最小修改
-> 定向自动化测试
-> 必要的 Mac/Windows 真机验收
-> 更新本目录对应文档
-> 只暂存本任务文件
-> 本地提交
-> 未经要求不 push、不部署
```

用户可见操作流程未经批准不得改变。诊断请求只诊断，不顺手实现；文档任务只写文档，不顺手修业务代码。

## 3. 修改前工作区保护

桌面端和 Java 是两个 Git 仓库。每次开始先分别执行：

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
```

规则：

- 不对用户/其他 Agent 的改动执行 `reset --hard`、`checkout --`、`clean` 或未经允许的 stash。
- 不把无关 dirty 文件混入自己的提交。
- 先用 `git diff -- <目标文件>` 判断是否与他人改动重叠；重叠且无法安全合并时停下说明。
- 使用精确 `git add path1 path2`，暂存后用 `git diff --cached --name-only` 二次核对。
- 不擅自 push；不擅自部署测试或生产；测试包和正式包必须不同 appId/runtime mode。
- 不能用“本地工作区能跑”替代可复现 commit。交付必须同时写 HEAD、dirty 状态和测试目标。

## 4. 不可破坏的技术合同

### 4.1 消息身份

- `Message.id/messageFingerprint` 必须基于稳定源记录，不基于聊天文字、显示名、数组下标或当前时间。
- 老板编辑商品文字不能改变账号、会话、消息指纹、消息时间和 binding revision。
- 不得在日志/接口暴露 wxid、chatroom、DB 路径/密钥、原图路径。

### 4.2 Reader 分页/响应

- 每页最多 200，不是总上限。
- Keyset 必须固定 `timeRange.end`，`nextPageKey` 原样回传。
- `hasMore=true` 且 key 缺失/重复必须失败；分片/令牌变化不能伪完成。
- NDJSON stdout 只发请求响应/事件帧；调试走 stderr。
- 保持稳定结果 envelope 和 13 个产品错误码；不要让 sqlite/解密内部异常穿透 Vue。

### 4.3 租户、客户和绑定

- Java 从认证 principal 得到租户，不信任客户端自报 disId。
- 同一租户的账号+会话只能绑定一个客户。
- 好友不接受 groupMode；群必须明确 ALL 或 @当前账号模式。
- 绑定 identity/revision 变化后旧扫描、旧任务保存必须冲突。
- 可见标题验证不能被“按名称直接相信缓存”替代。

### 4.4 游标和扫描提交

- Reader 全部分页成功 + 服务端全部 batch/digest 验证成功后才能 finalize。
- 任一失败、绑定变化、响应不完整时游标不推进。
- <=200 快速提交和 >200 分批提交必须产生相同台账/游标语义。
- scanId/batch/finalize 重试必须幂等。

### 4.5 消息、任务和保存

- 数据库消息唯一键不能删除或弱化。
- 消息只能被一个有效待确认任务领取。
- task `source_key` 必须稳定，草稿必须带 revision 乐观锁。
- discard 是可恢复回退；ignore 是明确永久非订单；不能混用。
- 保存必须携带原 `wechatOrderSource`，preflight 在订单写入前执行。
- 文本订单、消息 `ORDER_CREATED`、任务完成必须共享事务；精确更新数量不符要回滚。
- 图片异步链路若修改，必须证明来源能到达最终保存事务，不能只做入口 preflight。

### 4.6 deferred 图片

- locator 必须可签名验证且不泄露本地路径/材料。
- 原图未下载保持 pending/unavailable + 退避重试。
- 缩略图不能冒充正式 OCR 原图。
- Reader/Electron 重启后必须可从服务端 pending 恢复。

### 4.7 用户草稿和自动扫描

- 用户编辑草稿不能被重复扫描、页面切换或旧 revision 覆盖。
- 普通关闭不等于 ignore/discard。
- 自动扫描必须复用现有 scheduler 和全面检查流程。
- 不增加第二套定时器，不改变用户已有启用状态、时间和参与客户。

## 5. 影响范围检查表

修改前逐项回答：

- 是否改变用户按钮、弹窗、步骤或默认行为？若是，是否已明确批准？
- 是否改变 Message.id、source key、scan digest、binding revision 或状态枚举？
- 是否同时影响 Mac/Windows？平台 adapter 是否都保持标题验证？
- 是否需要新 Migration？旧客户端/旧字段如何兼容？
- 是否改变 <=200 和 >200 路径的一致性？
- 是否影响待确认草稿、ignore/discard、重复保存？
- 是否会输出聊天内容、密钥、Token、路径？
- 是否需要真机微信、冷启动、图片未下载、断网/重启测试？
- 是否有其他 Agent 的未提交修改重叠？

## 6. 最低测试门槛

根据改动范围选定向测试，但以下场景不能用纯静态检查替代：

- Reader/分页：Reader unittest，至少 199/200/201/400/450、同秒、分片变化。
- 扫描网关：<=200 和 200+ 分批、响应丢失重试、中间批失败。
- 任务：重复 claim、增量追加、重启恢复、草稿 revision、discard/ignore。
- 保存：第一次成功、重复保存拒绝、保存中异常回滚。
- UI 自动化：目标标题一致/不一致、同名/改名、微信未登录。
- 图片：原图可用/未下载/重启 locator/永久不可用/混合群。
- 平台 adapter：改 Mac 验 Mac；改 Windows 必须验 Windows。共享代码重大变化至少需要两端冒烟。

先记录失败基线。若开始时已有失败，不得把它们隐藏在“全部通过”中；交付要列出原失败、是否与本改动相关和结束状态。

## 7. 文档维护规则

任何微信订单正式修改，交付时都要同步更新最相关章节：

- 产品流程/规则变更 -> `01-business-rules.md`。
- 文件、IPC、API、DTO、Migration 变更 -> `02-architecture.md`。
- 指纹、游标、状态、事务、恢复变更 -> `03-reliability.md`。
- 命令、测试、平台支持、性能或排查变更 -> `04-testing-and-operations.md`。
- 新的长期禁区/接手路径 -> 本文件。

更新必须说明：

1. 发生了什么变化。
2. 哪些业务规则保持不变。
3. 对应 commit 和两仓库版本。
4. 哪些自动化测试实际运行且通过/失败。
5. 哪些真机平台和条件已验证。
6. 仍有哪些风险或未验证项。

不要把“计划”“待讨论方案”写成已实现合同。工作区未提交能力只能单列，形成可复现提交并验证后才能提升为 HEAD 能力。

## 8. 提交前自检模板

```text
[ ] 已读业务规则，不改变未获批准的用户流程
[ ] 已记录桌面端和服务端 HEAD/dirty 状态
[ ] 修改集中在最小文件集合
[ ] 消息指纹、Reader分页、绑定、游标、任务、图片、保存事务合同未破坏
[ ] 定向自动化结果已记录，失败没有被隐藏
[ ] 必要 Mac/Windows 真机验收已完成或明确列为待验证
[ ] 文档已同步
[ ] git diff --cached 只包含本任务文件
[ ] 未 push，未擅自部署
```
