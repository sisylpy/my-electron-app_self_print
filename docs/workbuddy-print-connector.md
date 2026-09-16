# 精彩接单 · WorkBuddy 打印连接器开发交接

> 本文档是持续更新的交接入口。整合完成、构建完成或发布状态变化时，更新**同一份**文件，
> 不要新增「最终版 / 最终修正版」等平行文档。
> 最后核查：2026-09-16（基线 `main` / `480da2dcc69967ba93c7bbc9609402e7c42ece7a`）。
> 目录名按实际磁盘名记录：**ai-priter-electic**（非 electric）。

---

## 一、项目目标与三个仓库的职责

本次是把**已有的「精彩接单」打印能力接入公开 WorkBuddy 连接器**，不是另写一个桌面打印软件。

### 三个正式仓库（实际路径与职责）

| 仓库 | 实际路径 | 职责 |
|---|---|---|
| **ai-priter-electic** | `/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic` | Electron 桌面源码、Vue 页面、打印执行与打包。产品名 **GrainPrint**，appId `club.grainservice.www`，`main: src/main.js`。**本仓库是桌面端的唯一权威源码。** |
| **grain-print-connector** | `/Users/lpy/Documents/javaWeb/imJava/nongxinle/grain-print-connector` | 独立的 MCP 程序（即发布后的 `grain-print-mcp` npm 包）、连接器配置（`connector-meta.json` / `token-schema.json`）、Skill 与使用说明（FORENSIC/USAGE）。 |
| **nongxinle-server** | `/Users/lpy/Documents/javaWeb/imJava/nongxinle/nongxinle-server` | 业务接口、身份与归属校验、连接凭证管理。端点 `/api/connector/credential/{issue,revoke,list,resolve}` 与 `ConnectorAuthInterceptor` 在此。 |

### 源码工程 / 已安装 GrainPrint.app / 临时 GrainPrint 副本 的关系

- **源码工程（ai-priter-electic）**：唯一可信源，从它构建出 `.app` / `.exe`。
- **已安装 GrainPrint.app**：`/Applications/GrainPrint.app/Contents/Resources/app/`，**无 git**，是构建/运行产物，**不是源码主线**。历史上一度把 3010 桥接改造直接落在它的 `Resources/app/src/` 里，未回流到源码工程。
- **临时 GrainPrint 副本**：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/GrainPrint`（git `master`，`e1c77d583b463e86c8432231b2fa217900a0940f`，无 remote）。它是「从已安装 app 复制 + 本轮改造」出的**临时参考副本**，仅供取证与实现参考，**原样保留、不得覆盖正式工程、不得当作正式主线**。待整合核验完成后由原作者决定是否废弃。

---

## 二、当前代码落点与整合进度

### 关键事实（本轮已核实）
- 本轮桌面端修改**曾误落在安装包及临时副本**，尚未进入正式工程 `ai-priter-electric`。
- 正式工程当前仍是 **3002 CLI 桥设计**（见第三节「当前实现」）；已发布的连接器用的是 **3010 本地安全桥设计**，二者**当前不联通**——这是整合的核心缺口。

### Git 状态（核查 2026-09-16，分支 / 提交号 / 远端保存情况）

| 仓库 | 分支 | 完整 HEAD | 工作树 | remote / upstream | 远端实际 HEAD（ls-remote 实测） | 本轮提交是否在分支内 | 是否保存到远端 |
|---|---|---|---|---|---|---|---|
| ai-priter-electic | `main` | `480da2dcc69967ba93c7bbc9609402e7c42ece7a` | 干净 | `origin` git@github.com:sisylpy/my-electron-app_self_print.git / `origin/main` | `480da2d…`（==本地） | 本轮未向此仓库提交 | ✅ 已同步（live 实测一致） |
| grain-print-connector | `master` | `a673b384e293ac96a3464d742d92b78739a1f8a1` | 干净 | **无 remote** | 无法确认（无 remote） | ✅ `a673b38` 即分支 tip | ❌ 无 remote，无法保存 |
| nongxinle-server | `main` | `b9eafd0fcc48aba4d76324992c5b12ea98fb0ef5` | 3 个未暂存的并行任务文件（见下） | `origin` git@github.com:sisylpy/nongxinle-master.git / `origin/main` | `a607063…`（≠本地） | ✅ `b9eafd0` 即分支 tip | ❌ 本地领先远端 9 个提交，未 push |

- **nongxinle-server 本地领先远端的 9 个提交**（均分类准确，不得笼统写作「退货历史」）：
  - 连接器相关（2 个）：`b9eafd0` `fix(connector): ConnectorAuthInterceptor 强制双身份校验（拒绝匿名）…`；`e5c8140` `feat(connector): 新增连接器凭证与打印端点端到端鉴权`。
  - 退货 / return 相关（7 个）：`a34dc5a`、`5ed1437`、`979a777`、`781eb45`、`ded193f`、`10d445b`、`6928b9d`（均为 `fix(return): …`）。
- **后台 3 个并行任务文件（保持不变，不暂存/不提交/不 stash/不还原/不清理）**：
  - `src/main/java/com/nongxinle/community/customer/controller/NxCustomerUserGoodsController.java`
  - `src/main/java/com/nongxinle/controller/NxDepartmentBillController.java`
  - `src/main/resources/com/nongxinle/dao/NxCustomerUserGoodsDao.xml`

### 哪些实现已进入正式工程
- ✅ 后端连接器鉴权：`nongxinle-server` `b9eafd0`（强制双身份校验）+ 两个测试类共 14 例 Maven 离线测试通过。
- ✅ 连接器文档修正：`grain-print-connector` `a673b38`（删除虚构的「开放平台→连接器凭证」菜单）。
- ✅ 连接器 npm 包：`grain-print-mcp-1.0.0.tgz` 经 `npm pack` + 干净环境 `npm install` 验证通过（bin 软链、index.js 语法校验通过）。

### 哪些仍待整合（桌面端）
- ❌ 3010 桥接的 Electron 侧（`mcp-bridge-client.js`、`mcp-task-runner.js`、改造后的 `main.js` 轮询）**仅存在于临时副本 / 安装包**，未进入 `ai-priter-electic`。
- ❌ 正式工程仍跑 3002 轮询（`mcp-server-cli.js` + `main.js` 中的 `pollMcpCliPrintTasks`），与已发布连接器的 3010 桥不联通。
- ❌ 正式工程内尚无桌面端集成测试（临时副本里的 19/19 Node 测试不属于正式工程，不计入正式验证）。

---

## 三、真实调用链与关键约束

> 端口、文件名、接口路径和状态名称均以真实代码为准；未查实处标注**待确认**。

### 3.1 当前实现（正式工程内，3002 设计）

```
WorkBuddy/Cursor
   └─ 运行 mcp-server-cli.js（ai-priter-electric/src/mcp-server-cli.js，Stdio MCP）
         ├─ HTTP 队列 127.0.0.1:3002，Bearer = mcpCliBridgeToken
         │     （令牌文件 ~/.grain-print/mcp-bridge-token，见 src/mcp-auth.js）
         ├─ GET /print-tasks   → 返回任务并清空队列
         └─ 工具：get_delivery_customers / preview_delivery_order /
                   confirm_print_delivery_order / print_each_subdepartment_delivery_order / get_app_status
请求打印 → confirmPrintDeliveryOrder() 构造 printTask（taskId = Date.now()）推入 pendingPrintTasks
   ↓
Electron main.js：pollMcpCliPrintTasks() 每 2s GET 127.0.0.1:3002/print-tasks（Bearer 令牌）
   ↓ webContents.send('mcp-print-trigger', task)
preload.js：onMcpPrintTrigger 捕获 task.taskId → 渲染进程
   ↓ sendPrintRequestWithCallback → IPC 'print-request-with-callback'
main.js：ipcMain.handle('print-request-with-callback', …) → 实际出纸
```

**当前实现的缺口（即整合要补的）**：
- 无**结果回传**端点（`mcp-server-cli.js` 只有 GET /print-tasks、/status，无 POST /result）。
- 无**执行端防重复**（任务取后队列即清空，但无 `markExecuted` 这类持久去重；App.vue 侧按 taskId 去重属渲染层，非执行端强约束）。
- 无**身份一致性二次校验**：桥只校验共享 `mcpCliBridgeToken`，未核对「任务 disId == 当前登录会话 disId」。
- 与已发布连接器的 **3010 桥不联通**（见 3.2）。

### 3.2 计划实现（单链，3010 设计；当前仅在临时副本 / 安装包中验证过）

```
WorkBuddy/Cursor
   └─ 运行连接器包 grain-print-mcp（= grain-print-connector/mcp-server）
         ├─ 启动 3010 本地安全桥（lib/bridge.js 的 start()，
         │     监听 127.0.0.1:3010，校验 X-Bridge-Secret，
         │     令牌文件 ~/.grain-print-mcp/bridge-secret）
         ├─ 任务持久化于 ~/.grain-print-mcp/tasks.json（lib/store.js）
         └─ MCP 工具建单时写入指纹 fingerprint = sha256(
              disId|departmentId|printMode|subDepartmentId|purpose|orderVersion)
请求打印 → 连接器在 store 建任务（status=pending）
   ↓
Electron（mcp-bridge-client.js，仅 127.0.0.1:3010 + X-Bridge-Secret）
   fetchTasks(disId) → 取 pending 任务
   ↓
mcp-task-runner.js：processTask(task, deps)
   1) 一致性校验：task.disId 必须 == 当前登录会话 disId（否则 skipped:'disId-mismatch'）
   2) 执行端防重复：markExecuted(taskId)（~/.grain-print-executed.json，重启仍有效）
   3) 上报「已受理」：acceptTask → 3010 POST /bridge/task/:id/accept（pending/acked → accepted）
   4) 下发渲染：pushToRenderer → IPC mcp-print-trigger（复用既有出纸链路）
   ↓（实际出纸由 GrainPrint 打印回调完成）
打印回调 → mcp-bridge-client.reportResult(taskId, success, message)
   → 3010 POST /bridge/task/:id/result → store 置 done / failed
```

### 3.3 身份来源与两种身份体系
- **连接器凭证**：前缀 `gpc_`，由 `nongxinle-server` `/api/connector/credential/issue` 签发（一次性明文，SHA-256 哈希落库），用于**连接器 → 后端**的调用鉴权（`ConnectorCredentialService`）。
- **桌面登录会话**：`DesktopDispatchAuthService` 会话令牌；Electron 侧通过 `localStorage.disUser.nxDiuDistributerId` 读取当前登录配送商（`mcp-bridge-client.js getLoggedInDisId()`）。
- **桥接链的一致性**：`processTask` 要求「连接器建单时写入的 `task.disId`（来自连接器 `GRAIN_DIS_ID` 环境变量）== Electron 当前登录会话 `disId`」，不一致则拒绝执行——这是防越权打印他人订单的关键。

### 3.4 配送商与 NX 部门归属
- **配送商归属 / 部门归属**：后端 `ConnectorAuthInterceptor` 已强制——无有效身份（连接器凭证或原桌面会话）一律 401；解析出的 `disId` 必须匹配请求 `disId`（403）；对 `phoneGetToFillDepOrders` 额外校验 `departmentId` 属于该 `disId`（`countByDepIdAndDisId`，403）。
- **桥接侧部门校验**：当前 `processTask` 仅做 `disId` 一致性；NX 部门归属主要在后端端点层面拦截（见上）。桥接层是否再叠加部门级校验——**待确认**（建议在 `processTask` 内补充 `task.departmentId` 与登录会话可打印部门集合的比对，但需先明确登录会话能拿到哪些部门）。

### 3.5 任务状态、去重与失败处理
- **状态机**：`pending → accepted（受理≠完成，可查询）→ done / failed`（结果回传后）。
- **受理 ≠ 打印完成**：`accept` 只是「已领取并将执行」；只有 `reportResult(success=true)` 才置 `done`。
- **去重双层**：
  1. 连接器 `store.fingerprint`（含 `orderVersion`）复用 `pending/accepted` 任务，避免重复建单；`orderVersion` = 订单 `id:数量` 的 SHA1（内容哈希），订单变化后自然形成新打印。
  2. 执行端 `markExecuted(taskId)` 持久记录已执行的任务 id，进程重启后仍有效，防止重复出纸。
- **失败 / 结果未知**：`mcp-task-runner.js` **不在轮询中自动重打**；结果不确定（无 `reportResult` 或 `success=false`）**不得自动重复打印**。仅当用户显式要求补打（`purpose:'reprint'`）时，连接器才会生成新的 `taskId` 新建任务。
- **明确补打**：走 `purpose:'reprint'` 分支 → 不同 fingerprint → 新 `taskId` → 重新打印。

### 3.6 关键约束：不能形成两条同时消费同一任务的执行链
- 3002 轮询（`mcp-server-cli.js`）与 3010 桥（`mcp-bridge-client.js`）**不能同时启用**，否则同一任务会被两条链重复消费。
- **整合方向**：以正式工程为基线，把 3010 桥的 Electron 侧（`mcp-bridge-client.js` / `mcp-task-runner.js` 及 `main.js` 接线）按真实源码结构移植进 `ai-priter-electric`，**退役 3002 轮询**（`mcp-server-cli.js` 的轮询部分或整体收敛），确保只有一条消费链。

---

## 四、构建、安装与验收

### 4.1 从哪个正式工程构建、真实命令
- 工程：`ai-priter-electric`（Vue 3 + Vite 在 `vue/`，Electron 主进程在 `src/`）。
- 安装依赖：`npm install`（含 `vue` 子目录依赖，见 `vue/package.json`）。
- 构建 Vue：`npm run build:vue`（= `cd vue && vite build`）。
- 打包桌面端：`npm run dist:mac`（mac dmg，x64+arm64）/ `npm run dist:win`（nsis），产物落 `release/`。打包配置在根 `package.json` 的 `build` 段（`appId: club.grainservice.www`，`productName: GrainPrint`，`asar:false`）。

### 4.2 隔离环境验证
- 测试替身**只用于测试边界**（如 mock `electron` 的 `contextBridge`/`ipcRenderer`、注入 `GRAIN_LOCAL_DIS_ID` / `GRAIN_EXECUTED_STORE_PATH`），**不能替代生产业务实现**。
- 测试须使用**隔离任务存储**（独立的 `tasks.json` / `executed.json` 路径），**不读取、不消费正在使用的真实打印任务**，**不触发真实打印**。
- 从**最终提交的干净检出**构建独立测试产物；打包配置存在 / 语法通过 / Node 测试通过，**都不能替代实际 `dist:mac` / `dist:win` 打包结果**。

### 4.3 已完成的代码与测试 vs 待办（如实区分）
- ✅ 已完成（代码/测试）：
  - 后端 `ConnectorAuthInterceptor` 强制双身份（14 例 Maven 离线测试通过）。
  - 连接器文档修正、npm 包 `npm pack` + 干净安装验证。
  - 临时副本中 3010 桥的 19/19 Node 测试（仅限临时副本，**尚未迁入正式工程**）。
- ⏳ 尚未完成（联调 / 打包 / 普通用户接入）：
  - 桌面端 3010 桥接入正式工程（代码落地 + 退役 3002 轮询）。
  - 正式工程内的桌面端集成测试与 `dist:mac` / `dist:win` **真实构建产物**。
  - 普通用户凭证获取/查看有效期/撤销的真实 UI 入口（目前仅有后端 `/api/connector/credential/*`，依赖现有登录会话；文档中曾误写的「开放平台→连接器凭证」菜单已删除）。
- 🚫 尚未授权 / 尚未执行（不得写为已验收）：
  - **真实出纸**（仅在用户授权并在生产环境实测后验收）。
  - 生产部署、替换 `/Applications` 安装包、npm 发布、平台审核、git push 远端。

---

## 五、后续工作与操作边界

> 只列当前实际遗留项，不扩展新功能。

### 实际遗留项（待办）
1. **桌面端整合**：将 3010 桥 Electron 侧（`mcp-bridge-client.js` / `mcp-task-runner.js` / `main.js` 接线）按 `ai-priter-electric` 真实结构移植，退役 3002 轮询，确保单链消费。— *待实施*
2. **桥接层部门级校验**：确认并在 `processTask` 补 `departmentId` 归属比对（需先明确登录会话可打印部门集合）。— *待确认+实施*
3. **正式工程构建与测试**：在干净检出上跑 `dist:mac`，产出真实 `.app`；补桌面端集成测试。— *待实施*
4. **普通用户接入 UI**：凭证获取/撤销的可视化入口（后端接口已具备）。— *待实施*
5. **远端保存**：`grain-print-connector` 无 remote；`nongxinle-server` 9 个本地提交未 push；`ai-priter-electric` 当前已与远端一致。— *待你确认远端归属后再 push*

### 操作边界（硬约束）
- **不用临时副本或安装包覆盖正式工程**：整合时对照真实源码结构重写/适配，不整体拷贝。
- **临时副本在整合核验完成前原样保留**，不删除、不移动、不继续在其中开发。
- **不夹带后台其他并行任务的修改**：nongxinle-server 的 3 个并行文件（见第二节）保持原样。
- **提交 / 推送 / 生产部署 / npm 发布 / 平台审核 分别记录，不能相互替代或视为一并授权**：本交接截至核查日，上述动作**均未执行**（未 push、未部署、未发布、未提交平台审核、未触发真实打印）。
