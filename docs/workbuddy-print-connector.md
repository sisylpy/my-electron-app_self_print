# 精彩接单 · WorkBuddy 打印连接器开发交接

> 本文档是持续更新的交接入口。整合完成、构建完成或发布状态变化时，更新**同一份**文件，
> 不要新增「最终版 / 最终修正版」等平行文档。
> 最后核查：2026-09-16（基线 `main` / `480da2dcc69967ba93c7bbc9609402e7c42ece7a`）。
> 目录名按实际磁盘名记录：**ai-priter-electic**（非 electric）。
> **2026-09-16 进度更新**：3010 桥的 Electron 侧（`mcp-bridge-client.js` / `mcp-task-runner.js` / `main.js` 接线）已落地正式工程，并通过隔离 smoke 测试（12/12）。详见第二节「哪些已实现」与第五节的遗留项更新。
> **2026-09-16 晚 · 本机联调轮**：R2 渲染端结果回传链路已落地（`preload.js` 新增 `reportPrintResult` + `Bills.vue` 透传 `taskId` 并在成功/失败/超时回传）；修复连接器 `backend.js` URL 拼接丢上下文 Bug；新增 `local-test/` 持久化隔离测试体系；`~/.workbuddy/mcp.json` 备份后新增 `grain-print-local-test` 测试 server（Node 路径纠正为 `22.22.2-3`）。**真实后台 `/connector/credential/resolve` 仍 404（未部署），真实授权与订单查询暂不可达**，详见第四节 4.3 与第五节。
> **2026-09-16 深夜 · 正式服务器数据库核实轮**：按用户要求改为查**正式服务器**数据库（不再折腾本机）。已确认 404 的**真正根因**是「生产库无 connector 表 + 生产 Tomcat 未部署 Controller」，而非凭证无效；并确定以服务器上**隔离测试库 `nongxinletest`**（含 disId=160 真实数据）作为联调环境，凭证表已迁移到该库。同时收尾两项：TLS 默认改为严格校验、printOnly 按可判定结果回传。详见第六节。

> **2026-09-17 凌晨 · 本地真实后台联调轮**：按用户最终口径改为「**本地服务端 + 正式数据库 `nongxinle`**」。凭证表建在正式库；凭证经项目自带、仅测试环境开放的登录入口（`api/desktop-test-login/v1/session`，生产固定 404）取得真实调度会话后由 `/api/connector/credential/issue` 正式签发。**连接器 → 本机后台 → 正式库**真实链路已跑通：`get_delivery_customers` 返回 disId=160「米线李」、`preview_delivery_order(1417)` 返回 2 单 32 元（与桌面端打印中心一致）。同时修复预览字段名失真（金额恒 0、版本号恒定）。**剩下一步：在 WorkBuddy 连接器管理页信任 `grain-print-local-test`**，之后即可在本会话直接调用。详见第七节。

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
- 3010 桥的 Electron 侧已于 **2026-09-16 落地正式工程 `ai-priter-electic`**（`src/mcp-bridge-client.js`、`src/mcp-task-runner.js`、`src/main.js` 接线），并经隔离 smoke 测试（12/12）验证；不再仅存于临时副本 / 安装包。
- 正式工程当前**并行保留** 3002 轮询（`mcp-server-cli.js` + `main.js` 的 `pollMcpCliPrintTasks`）与 3010 桥轮询；两者消费不同任务源（3002 队列当前无写入方，连接器走 3010），且 3010 路径有 `markExecuted` 持久去重，**不会双打**。3002/3001 按用户要求**本轮不删**，待 3010 替代链路本机验证通过、确认相关调用已迁移后再退出。
- 整合核心缺口（3010 桥不联通）**已闭合**：正式工程现可经 3010 桥拉取连接器任务。

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
- ✅ **【2026-09-16 新增】3010 桥 Electron 侧落地 `ai-priter-electic`**：
  - `src/mcp-bridge-client.js`：身份上报 / 心跳 / 领取任务 / 结果回传 / 执行端防重复（`markExecuted` 持久化 `~/.grain-print-mcp` 或 userData）；`getLoggedInDisId` 读渲染端 `localStorage.disUser.nxDiuDistributerId`，支持 `GRAIN_LOCAL_DIS_ID` 注入；惰性 `require('electron')`。
  - `src/mcp-task-runner.js`：`processTask`（disId 一致性 → markExecuted → acceptTask → pushToRenderer，受理≠完成）、`pollOnce`（身份/心跳 → 拉任务 → 逐个受理下发，不在轮询中自动重打）。
  - `src/main.js` 接线：顶部 `require` 两文件；`ready` 回调中 3002 轮询后新增 `bridgePollTick()` + `setInterval(…, 2000)`；`will-quit` 清理 `bridgePollingInterval`；`pushToRenderer` 仅补 `type:'nx_delivery'` 常量（R1 字段映射，禁填假值）；新增 `ipcMain.on('mcp-print-result')` 调 `reportResult`（R2 main 侧钩子已就绪）。
  - 新增文件已确认被 `package.json` `build.files`（`src/**/*` + `asar:false`）自动打包，无需改打包配置。
  - 隔离 smoke 测试 12/12 通过（见第四节 4.3）。
  - **【2026-09-16 晚 · 本机联调轮】R2 渲染端→main 结果回传链路落地 `ai-priter-electic`**：
    - `src/preload.js`：在 `electronAPI` 内新增 `reportPrintResult(taskId, success, message)` → `ipcRenderer.send('mcp-print-result', …)`；主进程 `ipcMain.on('mcp-print-result')`（上一轮已落 `main.js`）再经 `mcpBridgeClient.reportResult` 上报 3010 桥。
    - `vue/src/views/Bills.vue`：`processMcpPrintQueue` 的 `params` 透传 `taskId`；`runMcpDeliveryPrint` 取 `_mcpTaskId`、`departmentId` 无效 / `sub-not-found` / `department-not-found` / 异常均回传失败，`waitAndTriggerOrderViewPrint` 出纸成功后回传 `printed`、超时回传 `timeout`；**仅当 `_mcpTaskId` 存在（3010 桥任务）才回传**，旧 3002 任务（taskId 空）不污染。
    - 正式业务代码完整（受理≠完成、失败/超时回传、结果未知绝不自动重打，与 `mcp-task-runner` 的 `markExecuted` 一致）；出纸验证留待用户授权真实打印时实施。详见第四节 4.3。

### 哪些仍待整合（桌面端）
- ⏳ **3002 / 3001 退役**：本轮按用户要求**保留不删**；待 3010 替代链路本机验证完成、确认 3002 相关调用已迁移后再退出（不得仅因 USAGE 写「不兼容」就删旧入口）。
- ✅ **R2 渲染端→main 的结果回传链路（代码已完成，待真实出纸验证）**：`main.js` 侧 `mcp-print-result` handler（上一轮）+ `preload.js` 的 `reportPrintResult`（本轮）+ `Bills.vue` 的 `taskId` 透传与成功/失败/超时回传（本轮）已闭合。**仅剩真实出纸时的端到端验证**（需用户授权选定订单/打印机/份数）。出纸业务本身未改动逻辑，仅新增结果回传钩子。
- ⏳ **桥接层部门级校验**：`processTask` 目前仅 disId 一致性；NX 部门归属主要靠后端端点拦截（见 3.4），桥接层是否叠加部门级比对仍待确认。
- ⏳ 正式工程内的桌面端**真实构建产物**（`dist:mac` / `dist:win`，含 3010 桥）尚未产出；本轮仅做了 Node 层隔离测试，未构建 `.app`。

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

### 3.2 计划实现（单链，3010 设计；**已于 2026-09-16 落地正式工程 `ai-priter-electic`**）

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
- **当前落地状态（2026-09-16）**：正式工程 `main.js` 同时启用了 3002 轮询（`pollMcpCliPrintTasks`）与 3010 桥轮询（`bridgePollTick`）。
  - 二者**消费不同任务源**：3002 队列仅由 `mcp-server-cli.js` 填充（当前连接器已改走 3010，故 3002 队列实际无写入方）；3010 桥任务来自连接器 `store`。
  - 3010 路径有 `markExecuted` 持久去重，**同一任务不会重复出纸**；服务端 `/bridge/tasks` 还按 `disId` 过滤，进一步隔离。
  - **未启用 3001 链**（进程内 HTTP MCP，`mcp-server.js`）执行打印，保持现状。
- **3002 / 3001 本轮保留不删**：按用户明确要求，不得仅因连接器 USAGE 写「不兼容」就直接删旧入口；待 3010 替代链路**本机验证完成、确认 3002 相关调用已迁移**后再退出，确保只有一条有效消费链。
- **退役条件（后续）**：确认无客户端仍依赖 3002 队列、且 3010 链路在生产环境实测稳定后，移除 `pollMcpCliPrintTasks` 及其定时器与 `mcp-server-cli.js` 轮询相关代码。

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
  - **【2026-09-16】3010 桥 Electron 侧代码落地正式工程 `ai-priter-electic`**（见第二节），`node --check` 三文件语法通过。
  - **【2026-09-16】隔离 smoke 测试 12/12 通过**：在临时目录用**真实连接器 `bridge.js`+`store.js`** 驱动已落地的 `mcp-bridge-client.js` / `mcp-task-runner.js`，覆盖身份上报、心跳、fetch、accept、`markExecuted` 去重、`reportResult`、`pollOnce` 受理下发、二次 poll 不再下发（防双打）、服务端按 disId 过滤、runner disId-mismatch 兜底。**不调用未发布 npm 包、不启动 Electron、不触发打印、不触碰 `~/.grain-print-mcp`**。`smoke-3010.js` 留存于工作区 `/Users/lpy/WorkBuddy/2026-09-16-17-38-55/smoke-3010.js` 以备复跑。
  - **【2026-09-16 晚 · 本机联调轮】R2 渲染端结果回传代码落地 `ai-priter-electic`**：`preload.js` 新增 `reportPrintResult`、`Bills.vue` 透传 `taskId` 并在成功(`printed`)/失败/超时(`timeout`)回传；`node --check` 两文件语法通过（见第二节）。
  - **【2026-09-16 晚 · 本机联调轮】连接器 `backend.js` URL 拼接 Bug 修复**：原 `new URL(p, targetUrl)` 在 `p` 为绝对路径时会替换 base 的 path 上下文，丢失 `/nongxinle/api` 前缀，导致所有端点（resolve/customers/orders）落到 `http://host/<path>` 而 404。改为先剥掉前导 `/` 再拼 base，已用 Node 复刻验证修复。
  - **【2026-09-16 晚 · 本机联调轮】新增 `local-test/` 持久化隔离测试体系**（`grain-print-connector/local-test/`）：`run-connector-live.js`（指向真实后台 `https://grainservice.club:8443/nongxinle/api/`、`GRAIN_TLS_INSECURE=0`、桥端口 3011、独立密钥/任务/执行记录/token 文件）、`run-connector-stub.js` + `stub-backend.js`（合成后台，resolve 从 `Authorization: Bearer` 取 token 返回 `disId=160`，customers 返回 1 客户含 2 子部门，orders 校验 disId 一致）、`verify-chain.js`（spawn 连接器 + 跑 initialize/tools/list/get_delivery_customers/preview_delivery_order/桥握手；默认 stub，`--live` 切真实后台）。`token`(0600) / `bridge-secret` / `tasks.json` / `executed.json` 经 `.gitignore` 忽略，不进 Git。
  - **【2026-09-16 晚 · 本机联调轮】stub 链路端到端验证通过（实际运行结果）**：`verify-chain.js` 默认 stub 模式输出——`get_delivery_customers` 返回客户「测试客户·鲜丰果蔬」含 2 子部门（31 朝阳店 / 32 海淀店）；`preview_delivery_order(30)` 返回 `orderCount:3, totalAmount:245.5, orderVersion:6d89b64802c3db1f`；桥 `/identity` `/heartbeat` `/tasks?disId=160` 均 200。证明连接/查询/预览/桥握手全链路在合成环境下完全跑通。
- ⏳ 尚未完成（联调 / 打包 / 普通用户接入）：
  - 桌面端 3010 桥接入正式工程（**代码已落地 2026-09-16**；仅剩 3002/3001 退役，见下）。
  - 正式工程内的桌面端集成测试与 `dist:mac` / `dist:win` **真实构建产物**（本轮仅做了 Node 层隔离 smoke 测试 12/12 + stub 链路验证，未构建 `.app`）。
  - R2 渲染端→main 的结果回传链路（Bills/OrderPrint 组件改动）**代码已完成**（见上），仅剩真实出纸端到端验证，留待打印验证步骤。
  - **【当前真实阻塞】真实后台连接器凭证解析接口未部署**：`https://grainservice.club:8443/nongxinle/api/connector/credential/resolve` 返回 **404**（`ConnectorCredentialController` 源码在 `nongxinle-server` 但**未部署到该服务器**）；而同环境 `webNxDisGetTodayOrderCustomer` 返回 200。后果：连接器 `--live` 模式在 `get_delivery_customers` 即报 `连接器凭证无效或已失效: HTTP 404`，**真实授权配送商识别与订单预览暂不可达**。最小解法见第五节第 6 项。本地 `localhost:8080` 当前未运行（连接被拒），也非可用后台。
  - 普通用户凭证获取/查看有效期/撤销的真实 UI 入口（目前仅有后端 `/api/connector/credential/*`，依赖现有登录会话；文档中曾误写的「开放平台→连接器凭证」菜单已删除）。
- 🚫 尚未授权 / 尚未执行（不得写为已验收）：
  - **真实出纸**（仅在用户授权并在生产环境实测后验收）。
  - 生产部署、替换 `/Applications` 安装包、npm 发布、平台审核、git push 远端。

---

## 五、后续工作与操作边界

> 只列当前实际遗留项，不扩展新功能。

### 实际遗留项（待办）
1. **桌面端整合（代码落地已完成，剩余收尾）**：3010 桥 Electron 侧（`mcp-bridge-client.js` / `mcp-task-runner.js` / `main.js` 接线）**已于 2026-09-16 按 `ai-priter-electic` 真实结构落地并通过隔离测试**。R2 渲染端结果回传（`preload.js` + `Bills.vue`）**已于 2026-09-16 晚本机联调轮落地，代码完整、仅待真实出纸验证**。剩余：
   - **3002 / 3001 退役**：待 3010 替代链路本机验证完成、确认 3002 调用已迁移后再退出（本轮保留，不删）。
   - R2 真实出纸端到端验证：需用户在 GrainPrint 内登录并授权选定订单/打印机/份数后实测（受理≠完成、成功/失败/超时回传、结果未知不自动重打）。— *代码：已完成；验证：待用户授权*
2. **桥接层部门级校验**：确认并在 `processTask` 补 `departmentId` 归属比对（需先明确登录会话可打印部门集合）。— *待确认+实施*
3. **正式工程构建与测试**：在干净检出上跑 `dist:mac`，产出真实 `.app`；补桌面端集成测试（本轮仅 Node 层隔离 smoke 12/12 + stub 链路验证，未构建 `.app`）。— *待实施*
4. **普通用户接入 UI**：凭证获取/撤销的可视化入口（后端接口已具备）。— *待实施*
5. **远端保存**：`grain-print-connector` 无 remote；`nongxinle-server` 9 个本地提交未 push；`ai-priter-electric` 当前已与远端一致（本轮 3010 落地 + R2 + 文档更新将产生新本地提交，按用户要求**本轮不 push**）。— *待你确认远端归属后再 push*
6. **【本机联调轮新增】测试接入与配置修正**：
   - `~/.workbuddy/mcp.json` 已备份为 `~/.workbuddy/mcp.json.bak-20260916`，新增测试 server `grain-print-local-test`（command 指向 managed Node `/Users/lpy/.workbuddy/binaries/node/versions/22.22.2-3/bin/node`，args 指向 `grain-print-connector/local-test/run-connector-live.js`），仅加测试连接、保留其余 server 不动。
   - **Node 路径纠正**：managed Node 真实目录为 `22.22.2-3`（非 `22.22.2`）。本轮测试 server 已用正确路径。**提示**：现有 `mcp.json` 中 `grain-print` / `bwl-*` / `ibook` 四 server 仍误指不存在的 `22.22.2`，按用户「保留其他 server」要求本轮未改，建议后续一并修正。
   - 隔离：测试用 3011 端口、独立 `bridge-secret`/`tasks.json`/`executed.json`/`token`（0600），不触碰 `~/.grain-print-mcp`、不消费在用任务、不触发打印。
7. **【当前真实阻塞 · 需用户操作】真实后台连接器凭证解析接口未部署**：`/nongxinle/api/connector/credential/resolve` 在 `grainservice.club:8443` 返回 404，`--live` 验证在 `get_delivery_customers` 即报 `连接器凭证无效或已失效: HTTP 404`。当前 `local-test/token` 文件存在但为**空（0 字节）**。需用户二选一：
   - **(A) 部署凭证接口**：将 `nongxinle-server` 的 `ConnectorCredentialController`（含 `credential/resolve`）部署到 `grainservice.club:8443`；或本地起 dev 后端（`localhost:8080`，当前未运行）。
   - **(B) 提供真实 token**：把真实连接器 token 写入 `grain-print-connector/local-test/token`（0600，**绝不进聊天/Git/日志**），再跑 `verify-chain.js --live` 即可看到真实连接/查询/预览。
   - 在此之前，真实授权链路不可达；可用 `verify-chain.js`（默认 stub）先完整看到连接/查询/预览/桥握手效果。

### 操作边界（硬约束）
- **不用临时副本或安装包覆盖正式工程**：整合时对照真实源码结构重写/适配，不整体拷贝。
- **临时副本在整合核验完成前原样保留**，不删除、不移动、不继续在其中开发。
- **不夹带后台其他并行任务的修改**：nongxinle-server 的 3 个并行文件（见第二节）保持原样。
- **提交 / 推送 / 生产部署 / npm 发布 / 平台审核 分别记录，不能相互替代或视为一并授权**：本交接截至核查日，上述动作**均未执行**（未 push、未部署、未发布、未提交平台审核、未触发真实打印）。

---

## 六、正式服务器数据库核实（2026-09-16 深夜轮）

> 用户纠正：不要查本机，要查**正式服务器**的数据库，目标 disId=160。以下均为实测结果。

### 6.1 正式服务器与数据库实况

| 项 | 实测结果 |
|---|---|
| 服务器 | `101.42.222.149`（VM-24-17-ubuntu，Ubuntu 20.04），**SSH 免密可连**（root，`~/.ssh/id_rsa`） |
| MySQL | 8.0.27，库：`nongxinle`（**生产**）、`nongxinletest`（**服务器上的隔离测试库**，237 表） |
| 生产 Tomcat | `/opt/tomcat/apache-tomcat-9.0.56`，端口 8080 / 8443；运行时配置 `conf/nongxinle-runtime-secrets.properties`（61 键，含 JDBC 凭证） |
| 生产 JDBC | `jdbc:mysql://101.42.222.149:3306/nongxinle` |
| 8090 | 实为 **aigrain-server.jar**（与 nongxinle 无关），不是测试实例 |
| `/opt/tomcat_test/tom` | 有 `nongxinle_server_war_exploded.war`，但**未运行且缺运行时配置**（DB 指向无法确认，存在误连生产库风险，故不启用） |

- 沙箱环境注意：`sudo` 在本工具环境被完全禁用；`~/.ssh` 读取会被沙箱拦截（易误判为"私钥缺失"），需沙箱豁免后才可见（私钥实际都存在）。`osascript ... with administrator privileges` 可用。

### 6.2 `/connector/credential/resolve` 404 的真正根因（纠正"凭证无效"的误判）

1. **生产库 `nongxinle` 无任何 connector 表** —— 凭证表从未迁移到生产。
2. **生产 Tomcat 未部署 `ConnectorCredentialController`** —— 接口不存在。
3. 连接器把 404 统一报成「连接器凭证无效或已失效」，属**误导**，掩盖了"接口不存在/未部署"这一真实原因。→ 已知待办：区分 URL 错误 / 接口不存在 / 缺凭证 / 凭证无效。

### 6.3 disId=160 真实业务数据（正式服务器）

- **160 = 粒子配送**（手机 13910825707），生产库与测试库均存在。
- 部门字段注意：关联字段是 **`nx_department_dis_id`**（不是 `nx_distributer_id`）；`nx_distributer_department` 表用 `nx_DD_distributer_id`，160 的记录数为 0。
- 测试库 `nongxinletest` 中 160 有 **19 个部门**，一级 6 个：1383 演示二店、1384 演示一店、1417 米线李、1436 三店（子：1437 前厅 / 1438 后厨 / 1439 凉菜）、1447 宋丹味百味-1、1459 现场零售（子：R5~R28 等）。

### 6.4 确定的隔离联调环境（不动生产）

| 层 | 方案 |
|---|---|
| 数据库 | 服务器上 **`nongxinletest`**（非生产库），经 SSH 隧道 `127.0.0.1:13306 → 服务器 3306` |
| 本机 runtime | `~/.nongxinle/nongxinle-local-runtime.properties`（0600，由服务器配置取回后改写 JDBC_URL 指向 `127.0.0.1:13306/nongxinletest`），密码不进聊天/Git/日志 |
| 凭证表 | `nx_connector_credential` **已迁移到 nongxinletest**（9 列），迁移脚本带 `assert db=='nongxinletest'` 安全校验 |
| 后台 | 本机 `mvn tomcat7:run -Dmaven.tomcat.path=/nongxinle -Dmaven.tomcat.port=8081`（pom 默认 `port=8081`/`path=/`，覆盖 path 以对齐生产 `/nongxinle/api/...` 路径结构）；JDK 用 `ms-17.0.18`（非系统 Java 24） |

### 6.5 本轮收尾的两项修正

1. **TLS 默认行为**（`grain-print-connector` commit `c15e71b`）：原判断 `GRAIN_TLS_INSECURE !== '0'` 导致**未设置该变量时反而跳过证书校验**。改为 `=== '1'`：未设置 / `0` / 其他值一律严格校验，跳过需显式 opt-in；同步 `mcp.json` 设为 `0`，并更新 USAGE/token-schema 说明。
2. **printOnly 真实完成语义**（`ai-priter-electic` commit `f4d36b5`）：
   - 原实现单页错误仅 `continue`、外层 catch 只打日志 → **`await printOnly()` 正常返回 ≠ 打印成功**。
   - 现 `printOnly` 统计 `printedPages/failedPages` 并返回 `{success,totalPages,printedPages,failedPages,reason}`（含 `no-pages` / `not-electron` / `no-target` / `page-failed`）；`Bills.vue` 按 `printOutcome.success` 回传，失败带 `reason`，不再"调用返回即成功"。
   - **如实记录的语义边界**：`success=true` 的判定依据是主进程 `webContents.print` 回调 `success`，即**打印任务已进入系统打印队列**；**物理出纸完成软件无法确认**。此部分仍需真实出纸时人工验证，不因查询/预览通过而宣布回传已验收。

### 6.6 当前进度与阻塞（**已由第七节取代，口径已修正**）

> ⚠️ 本节原以「隔离测试库 `nongxinletest`」为目标。用户随后明确改为「**本地服务端 + 正式数据库 `nongxinle`**」，
> 且实测真相是：本机后台连正式库（经 SSH 隧道），凭证表建在**正式库**。**以第七节为准。**

- ✅ 已完成：正式服务器数据库核实、404 根因定位、TLS 默认修正、printOnly 结果语义修正、凭证表建到正式库（均已本地提交，未 push）。
- ❌ 已作废：以 `nongxinletest` 作为联调库的方案（用户改口径）。
- ✅ 已完成（见第七节）：本机后台启动、正规登录取凭证、WorkBuddy 连接器真实连接/查询/预览。
- 🚫 未做：真实出纸（须用户选定订单/打印机/份数并明确确认）、push、npm 发布、平台审核、生产部署、替换 `/Applications`。

### 6.7 原「需用户配合」条目（**已由 7.4 取代**）

> 原条目要求用户提供 `nongxinletest` 的测试账号。实际执行时改用项目自带、仅测试环境开放的
> 测试登录入口（`NXL_DESKTOP_TEST_LOGIN_ENABLED=true`），无需用户手填账号，见 7.2。

---

## 七、本地服务端 + 正式数据库联调（2026-09-17 凌晨轮）

### 7.1 最终口径与生效配置

| 项 | 实际值 |
|---|---|
| 后台 | **本机** `http://127.0.0.1:8081/nongxinle_server_war_exploded/`（用户自行启动，非我部署） |
| 数据库 | **正式库 `nongxinle`**（服务器 `101.42.222.149`，经 SSH 隧道 `127.0.0.1:13306`） |
| 本机运行时配置 | `~/.nongxinle/nongxinle-local-runtime.properties`（0600），JDBC 指向 `127.0.0.1:13306/nongxinle` |
| 测试登录开关 | `NXL_DESKTOP_TEST_LOGIN_ENABLED=true`（**该文件里已存在**，是本次取凭证的关键前提） |
| 渲染端地址 | `vue/.env.development.local` → `VITE_API_URL=http://localhost:8081/nongxinle_server_war_exploded/api/`（gitignore，不进仓库） |
| 连接器地址 | `local-test/run-connector-live.js` → `GRAIN_API_URL` 默认本机 8081（可用同名环境变量覆盖） |
| 桥接端口 | 连接器测试实例 **3011**；桌面端 `mcp-bridge-client.js` 默认 **3010**（`GRAIN_BRIDGE_PORT` 可覆盖） |

### 7.2 凭证的正规取得路径（不手填 disId、不写令牌表）

1. `POST /api/desktop-test-login/v1/session` `{userId:289}` —— 项目自带的**测试环境 Electron 登录入口**
   （`DesktopTestLoginController`，仅当部署环境设置 `NXL_DESKTOP_TEST_LOGIN_ENABLED=true` 才开放，**正式服务器固定返回 404**）。
   身份由服务端按 `userId` 查库得出（289 = disId=160 管理员「芳芳」），客户端不上送 disId。
2. 用返回的**真实调度会话**做 Bearer：`POST /api/connector/credential/issue` → 正式签发连接器凭证。
3. 实测结果：`credentialId=1`、`disId=160`、`scope=print:delivery`、有效期至 `2026-12-16`；
   复核 `POST /api/connector/credential/resolve` → `{status:"active", disId:160, userId:289}`。
4. 凭证落盘 `grain-print-connector/local-test/token`（**0600**，`.gitignore` 已忽略；不进聊天、不进日志、不进 Git）。
5. 补记：调度会话在库中**只存 SHA-256 哈希**（`nx_dis_dispatch_session.nx_dds_token_hash`），因此原始会话令牌无法从库里反查——这是正确设计，也说明凭证只能从登录响应获取。

### 7.3 WorkBuddy 连接器真实链路实测结果

真实链路：**连接器 → 本机后台 → 正式库**（`verify-chain.js --live --dep=1417`）：

```
=== get_delivery_customers ===
{ "success": true, "disId": 160,
  "customers": [ { "id": 1417, "name": "米线李", "subDepartmentCount": 0,
                   "subDepartments": [], "requiresPrintModeChoice": false } ],
  "total": 1 }

=== preview_delivery_order(1417) ===
{ "success": true, "disId": 160, "departmentId": 1417, "printMode": "all",
  "orderCount": 2, "totalAmount": 32, "totalAmountHanzi": "叁拾貳元整",
  "items": [
    { "orderId": 204803, "goodsName": "油菜",       "standard": "斤", "quantity": "5", "weight": "5", "price": "2",  "subtotal": "10.0" },
    { "orderId": 204804, "goodsName": "红黄彩椒各", "standard": "个", "quantity": "5", "weight": "2", "price": "11", "subtotal": "22.0" } ],
  "orderVersion": "0109318fb198fdc5", "message": "预览数据（未入队）" }

=== bridge /identity === 200 ok   /heartbeat === 200   /tasks?disId=160 === 200 {"tasks":[]}
```

- 与桌面端打印中心截图（米线李 / LZPS-09-17-NKGW / 油菜 5斤×2=10.0 / 红黄彩椒各 2×11=22.0 / 合计 32 元）**逐项一致**。
- `bridge /tasks` 返回空 —— **未消费正在使用的程序中的待打印任务**（独立端口 3011 + 独立密钥/任务/执行记录）。
- 部门权限是**真实校验**的：错误部门（如 30）返回 `HTTP 403`，不是「disId 相同即有权限」。

### 7.4 预览字段名失真修复（本轮发现并修复，commit `4d9fa81`）

| 问题 | 原实现 | 真实字段 | 现象 |
|---|---|---|---|
| 金额 | `o.nxDepartmentOrderSubTotal` | `nxDoSubtotal`；且 `data.total` 已给汇总 | `totalAmount` 恒为 0（真实 32 元） |
| 版本号 | `o.nxDepartmentOrderId` / `o.nxDepartmentOrderQuantity` | `nxDepartmentOrdersId` / `nxDoQuantity` | 种子恒为空串 → `orderVersion` **恒定不变**，订单内容变化无法被察觉 |
| 明细 | 未返回 | 商品名在 `nxDistributerGoodsEntity.nxDgGoodsName` | 预览无法看到商品 |

修复后：`totalAmount` 优先取后台 `data.total`（回退按行小计求和）；`orderVersion` 随订单ID/数量/小计变化；预览新增 `items` 逐行明细与 `totalAmountHanzi`。

- **待你确认的疑点**：订单 204804 的 `nxDoQuantity=5` 而 `nxDoWeight=2`，账面小计 22=2×11 与 `weight` 一致。
  两个字段的真实业务含义以**出纸逻辑**为准，本次**不代为取舍**，仅按原始字段名返回。
- 同理，`nxDoGoodsName` 在真实返回中为空串，商品名需从 `nxDistributerEntity.nxDgGoodsName` 取 —— 已按此实现。

### 7.5 环境一致性核对与出纸前必须对齐的两项

| 环节 | 现状 | 出纸前需要 |
|---|---|---|
| Electron 渲染端 | ✅ 已指本机 8081（`vue/.env.development.local`） | — |
| 连接器（本会话 MCP） | ✅ 已指本机 8081（`local-test`） | — |
| Electron **主进程** 调度网关 | ⚠️ 默认仍指**生产** `PRODUCTION_API_BASE_URL`（`dispatch-gateway.js`，仅 `NXL_DISPATCH_API_BASE_URL` 可覆盖） | 若要主进程也走本机，需设 `NXL_DISPATCH_API_BASE_URL` |
| 桥接端口 | ⚠️ 连接器测试实例 3011 / 桌面端默认 3010 | 给 Electron 设 `GRAIN_BRIDGE_PORT=3011`（两端一致） |
| 身份一致性 | ✅ 连接器 `disId=160`；桌面端登录同为 disId=160 | — |

### 7.6 下一步（需要你操作）

1. **在 WorkBuddy 连接器管理页信任测试连接器**：右上角「自定义连接器」入口 → 找到 `grain-print-local-test` → 点「信任」（必要时重启 WorkBuddy）。
   在此之前，本会话里查不到该连接器的任何工具（已实测确认）。
2. 信任后我会在本会话直接调用 `get_delivery_customers` / `preview_delivery_order` / `get_app_status` 复现上面的结果。
3. 等你说「可以出纸」并**指定订单、打印机、份数**后，才进入 `confirm_print_delivery_order`；届时需先按 7.5 对齐主进程地址与桥接端口。
4. 仍未做：push、npm 发布、平台审核、生产部署、替换 `/Applications`、真实出纸。
