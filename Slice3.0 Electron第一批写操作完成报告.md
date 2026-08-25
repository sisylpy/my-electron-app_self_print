# 《Slice 3.0 Electron第一批写操作完成报告》

## 1. 完成结论

Slice 3.0 已完成首批 Electron 调度写操作接入：

1. 分配司机。
2. 确认派单。

Electron 写请求只通过 `/api/desktop-dispatch/v1/**` 发起，没有调用 Boss 小程序兼容写接口。写操作身份由扫码登录 Token 确定，Electron 不提交 `disId`、`operatorUserId`，也不在客户端判断司机可用性、路线合法性或业务状态推进。

本 Slice 未实现路线拖拽修改、装车确认、发车确认和配送异常。

## 2. 实现范围

### 2.1 Electron 主进程安全网关

新增独立调度网关和凭证存储：

- `src/dispatch/dispatch-gateway.js`
- `src/dispatch/credential-store.js`

实现内容：

- 创建一次性桌面登录挑战并生成二维码。
- 轮询交换短期调度 Token。
- Token 只保存在 Electron 主进程。
- 勾选“在本机安全保存登录”时，使用 Electron `safeStorage` 调用操作系统安全存储加密。
- preload 只向渲染进程返回用户、配送商、角色、权限和到期时间等会话摘要，不返回 Token。
- 所有写请求由主进程添加 Bearer Token、`Idempotency-Key`、`X-Request-Id` 和 `X-Client-Version`。
- 白名单只开放分配司机与确认派单，不提供任意 URL、任意 HTTP 方法或任意 IPC 通道。
- 对请求体递归检查并拒绝 `disId`、`operatorUserId`、`actorUserId`、`tenantId`、`roleCode`、`permissions`。

### 2.2 Boss 小程序扫码授权

在 Boss 小程序“分派中”页面增加“电脑调度登录”入口：

- 只接受类型为 `NXL_DESKTOP_DISPATCH_LOGIN`、版本为 `1` 的二维码。
- 显示目标电脑名称并要求老板二次确认。
- 使用 Boss 当前短期调度 Token 调用：
  `POST /api/desktop-dispatch/v1/auth/challenges/{challengeId}/approve`
- 授权请求不提交 `disId` 或 `operatorUserId`。

### 2.3 DispatchWorkbench 写操作

在现有只读工作台基础上新增：

- 手机扫码登录弹窗。
- 登录状态和退出入口。
- 司机选择弹窗。
- 确认派单二次确认。
- 操作成功、失败、权限不足、登录失效和并发冲突反馈。

页面不会根据本地状态直接推进业务阶段。写成功后先展示服务端结果，再重新读取正式 `pageViewModel`。

## 3. 接口合同落实

| 操作 | HTTP | 路径 | 版本字段 | 幂等 |
| --- | --- | --- | --- | --- |
| 分配司机 | POST | `/api/desktop-dispatch/v1/stops/confirm` | `expectedTaskVersion`、`expectedRouteVersion` | 必须 |
| 确认派单 | POST | `/api/desktop-dispatch/v1/route-edits/confirm` | `expectedRouteVersion`、`expectedTaskVersions[]` | 必须 |

Electron payload 不包含：

- `disId`
- `operatorUserId`
- `actorUserId`
- `tenantId`
- `roleCode`
- `permissions`

服务端 DTO 也不定义 `disId/operatorUserId`。服务端捕获未冻结字段；发现身份字段返回 `400 FORBIDDEN_IDENTITY_FIELD`。

## 4. 服务端版本与响应补齐

### 4.1 正式读模型

可触发写操作的站点现在返回：

- `taskId`
- `taskVersion`
- `taskStatus`
- `sandboxStopKey`
- `liveOrderIds`

可触发写操作的司机路线现在返回：

- `driverRouteId`
- `routeVersion`
- `routeStatus`

页面根模型补充：

- `routeDate`
- `batchCode`

### 4.2 分配司机

服务端继续执行既有司机归属、司机可用性、任务状态、路线插入和业务规则校验。

成功响应补充：

- `operationId`
- `replayed`
- `task`
- `route`
- `serverTime`

任务并发冲突返回 `409 TASK_VERSION_CONFLICT`；路线并发冲突返回 `409 ROUTE_VERSION_CONFLICT`。

### 4.3 确认派单

服务端在同一事务内校验：

- `driverRouteId` 与当前配送商、司机、日期和批次一致。
- `expectedRouteVersion` 与当前路线一致。
- `expectedTaskVersions` 完整覆盖当前命令涉及的全部活动任务。
- 不存在重复、遗漏或非本路线任务版本。
- 原有路线合法性、司机状态和状态推进规则。

成功响应返回真实落库后的：

- `route.routeVersion`
- `route.routeStatus`
- `tasks[].taskVersion`
- `tasks[].taskStatus`
- `enteredLoading`
- `nextPhase`

Electron 不自行推断是否进入装车。

## 5. 失败处理

| HTTP | Electron 处理 |
| --- | --- |
| 401 | 清除主进程会话，提示重新扫码，不自动重放写操作 |
| 403 | 提示当前账号无权限，保留只读工作台 |
| 409 | 提示数据已变化，自动重新读取工作台，不覆盖服务端 |
| 422 | 展示服务端业务拒绝原因，不在客户端绕过规则 |

网络失败和 5xx 不会被当作业务成功。每次新的用户确认生成新的幂等键；同一次 HTTP 命令由服务端幂等底座防止重复落库。

## 6. 模块边界

本次新增代码位于 dispatch 边界：

- Electron 主进程：`src/dispatch/**`
- Vue：`vue/src/modules/dispatch/**`
- Boss：只增加桌面扫码授权入口
- nongxinle-server：只补桌面 v1 合同、版本读模型和统一响应

未修改打印业务计算、纸型、DPI、边距、打印机配置、Bills 业务页面、OCR 业务逻辑和 MCP 打印投递流程。

## 7. 验证结果

已通过：

- Electron/Vue 生产构建。
- Slice 3.0 写合同烟雾测试。
- Slice 0 模块边界回归。
- Electron Phase 1 安全回归。
- 现场打印合同回归。
- Electron 主进程、preload、调度网关 Node 语法检查。
- Boss 小程序调度 API 与分派中页面 JavaScript 语法检查。
- nongxinle-server Maven 打包编译。
- 服务端桌面调度认证、权限、幂等定向 JUnit：`11 tests, 0 failures`。

当前未执行：

- 连接生产数据库的真实订单写入。
- 真实 Boss 微信扫码到 Electron 的现场联调。
- Epson 或其他打印机实机回归。

上述三项需要在测试配送商、测试订单和测试设备环境中执行，不能用自动化构建结果替代。

## 8. 验收建议

1. 使用无权限配送商账号扫码，验证 403 且工作台仍可只读。
2. 使用有权限账号给测试任务分配司机，确认请求体无 `disId/operatorUserId`。
3. 两台电脑同时打开同一任务，一台成功后另一台应收到 409 并自动刷新。
4. 双击或网络超时重试时检查同一逻辑命令只落库一次。
5. 确认路线后，以服务端返回的 `enteredLoading/nextPhase` 为准进入后续只读展示。
6. 回归 Bills、OCR、MCP 打印，并至少使用一台现场 Epson 打印机打印 1/3、1/2、全张纸各一单。
