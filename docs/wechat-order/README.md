# GrainPrint 微信订单读取模块

本文档集是 GrainPrint 微信订单读取模块的工程技术合同。它面向维护者和后续开发 Agent，描述当前业务边界、真实调用链、可靠性机制、测试入口与交接规则。任何与代码冲突的旧设计稿均不应覆盖这里列出的、已经由源码核查的事实。

## 阅读导航

1. [业务功能与用户操作规则](./01-business-rules.md)：先确认产品边界和不可擅自改变项。
2. [技术架构与真实调用链](./02-architecture.md)：按 Vue、Electron、Reader、Java、数据库定位实现。
3. [数据完整性与可靠性](./03-reliability.md)：理解分页、指纹、游标、任务和事务合同。
4. [测试、运行与问题排查](./04-testing-and-operations.md)：执行定向测试和真机排查。
5. [Agent 交接手册](./05-agent-handoff.md)：按最小上下文、安全协作流程接手修改。

## 仓库和版本基线

核查日期：2026-10-23（Asia/Shanghai）。

| 范围 | 仓库根目录 | 分支 | 文档核查时业务代码 HEAD |
|---|---|---|---|
| Electron、Vue、Python Reader | `/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic` | `main` | `725da233b91e28ea7cac597b1d4d02a515b5adaa` |
| Java 服务端、Migration | `/Users/lpy/Documents/javaWeb/imJava/nongxinle/nongxinle-server` | `main` | `1c4a24264f8e75cd7d60c3c00d79b3c0b5b4a56d` |

重要历史提交均已由 `git merge-base --is-ancestor` 核实为上述 HEAD 的祖先：

- Reader 稳定 Keyset 分页：`2ccb419c6df62204fe7740624498c4632e334c35`。
- Electron 可靠扫描工作流：`e82cc09f11da53870a08126c84f25b7bbe6fd97d`。
- Java V2 扫描与任务生命周期：`cf90960b38e4424733dd8f871a91ddd6407badc5`。

## 实现状态的判定口径

本文档使用以下标签，避免把设计、代码和验证混为一谈：

- **HEAD 已实现**：能够从上表 Git HEAD 重现。
- **本地工作区实现**：核查时存在于未提交修改或未跟踪文件；不能当作正式发布基线。
- **自动化已验证**：本次核查实际执行测试并通过。
- **Mac 人工已验证**：2026-10-23 用户在真实 Mac 微信和 GrainPrint 界面完成了连续新增消息、全面检查、报告关闭后刷新、追加/添加订单等验收；不是自动化性能保证。
- **待验证**：没有足够的真机或自动化证据。

核查时 Java 仓库干净；桌面端仓库已有大量其他 Agent/用户的未提交改动。本轮文档没有修改、暂存或提交这些业务文件。尤其是以下能力只在当时本地工作区观察到或被继续增强，正式交付前必须先形成独立提交并重新跑测试：

- Reader `SessionTable` 可见消息补充、扫描窗口重叠与时钟偏差容忍。
- 全面检查后的页面刷新、当前会话识别和追加订单相关改动。
- `scripts/wechat-order-perf-analyze.mjs`、若干完整性/性能测试仍为未跟踪文件。

## 当前能力摘要

| 能力 | 状态 | 证据入口 |
|---|---|---|
| 客户与微信账号/会话指纹绑定、好友/群模式 | HEAD 已实现 | `CustomerWechatOrderService`、`wechatOrderMessagePolicy.js` |
| 单会话、未读会话、全部已绑定客户扫描 | HEAD 已实现；Mac 流程又有本地增强 | `OrderWorkbenchV2.vue` |
| 每页 200 条、450 条跨页/跨批读取与登记 | HEAD 已实现；自动化已验证核心链路 | Reader Keyset 测试、`wechat-reliable-scan-gateway.test.mjs` |
| 消息台账、任务恢复、草稿版本、忽略/回退 | HEAD 已实现 | V2 Service、三项 2026-10-22 Migration |
| 图片 deferred、签名 locator、重启后恢复 | HEAD 已实现；单元测试覆盖 | Reader 附件测试、V2 attachment 接口 |
| 文本正式订单与消息状态同事务完成 | HEAD 已实现；Java 定向测试通过 | `OcrController.pasteSearchGoodsInternal` |
| 图片异步链路携带微信来源 | 已有前置校验与来源传递代码；完整最终事务需继续专项验证 | `OcrController.recognizeOrderAsync` |
| 自动扫描复用同一全面检查流程 | HEAD 已实现 | `auto-read-scheduler.js`、`OrderWorkbenchV2.vue` |
| Windows 全链路真机 | 待验证 | 不能用 Mac 或 PowerShell 静态测试代替 |

## 权威源码入口

桌面端仓库内：

- Vue 工作台：`vue/src/modules/order/views/OrderWorkbenchV2.vue`。
- 微信导入弹窗：`vue/src/modules/order/components/workbench/WechatOrderImportModal.vue`。
- 扫描与过滤：`vue/src/modules/order/services/wechatOrderImport.js`、`wechatOrderMessagePolicy.js`、`wechatOrderTaskSplit.js`。
- Electron IPC：`src/preload.js`、`src/main.js`。
- 服务端网关：`src/dispatch/dispatch-gateway.js`。
- Reader 生命周期：`src/wechat/reader-service.js`、`src/wechat/reader-bridge.js`。
- Reader 产品实现：`src/wechat/reader-runtime/product/`。
- NDJSON 协议：`src/wechat/reader-runtime/product/bridge/protocol.md`。
- 自动扫描：`src/wechat/auto-read-scheduler.js`。

Java 服务端仓库内：

- V1 绑定接口：`src/main/java/com/nongxinle/distribute/customer/wechatorder/api/DesktopCustomerWechatOrderController.java`。
- V2 扫描/任务接口：`src/main/java/com/nongxinle/distribute/customer/wechatorder/api/DesktopCustomerWechatScanV2Controller.java`。
- 可靠扫描服务：`src/main/java/com/nongxinle/distribute/customer/wechatorder/application/CustomerWechatScanV2Service.java`。
- 绑定与保存前后校验：`src/main/java/com/nongxinle/distribute/customer/wechatorder/application/CustomerWechatOrderService.java`。
- MyBatis 合同：`src/main/java/com/nongxinle/dao/CustomerWechatOrderDao.java`、`src/main/resources/com/nongxinle/dao/CustomerWechatOrderDao.xml`。
- 正式订单入口：`src/main/java/com/nongxinle/controller/OcrController.java`。
- 数据库结构：`src/main/resources/db/migration/V20260930_01__department_wechat_order_ingestion.sql`、`V20261001_01__department_wechat_group_binding.sql`、`V20261022_01__department_wechat_scan_v2_foundation.sql`、`V20261022_02__customer_wechat_task_recovery.sql`、`V20261022_03__separate_wechat_drafts_from_ocr_tasks.sql`。

## 已知限制和待核实事项

1. 核查时桌面端有未提交业务改动，且 7 个微信相关契约测试与当前工作区不一致；详见 [测试与运维](./04-testing-and-operations.md)。这些失败不能被文档提交掩盖。
2. Java 定向测试 33 项中 31 项通过，`CustomerWechatBindingTransferContractTest` 有 2 项失败；绑定转移/游标语义必须在后续修改前重新对齐测试和实现。
3. `src/wechat/reader-runtime/product/README.md` 仍写着“当前无实现代码”，已经过时；实际实现与 `bridge/protocol.md` 才是当前依据。本轮为避免修改非目标文档，仅在此显式纠正。
4. 没有可复现的 Windows 真实微信全链路验收记录。
5. 没有可作为 SLA 的、带设备/数据规模/冷热启动条件的 V2 性能基线；历史“2～4 秒”不能写成所有场景保证。
6. 文档不承诺“绝对不漏单”。现有机制能发现并拒绝多类不完整提交，但微信客户端本地库延迟、原图未下载、平台版本变化仍需重试或人工确认。
