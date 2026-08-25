# Electron 生产化整改实施方案

> 项目：农心乐配送商系统  
> 审查对象：`ai-priter-electic`  
> 项目路径：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic`  
> 方案日期：2026-07-30  
> 当前阶段：Electron 生产化整改 Phase 1  
> 明确不在范围：派单工作台开发、派单规则、路线计算、司机状态判断

## 1. 目标与结论

Phase 1 的目标不是改写现有业务，而是为后续承载派单工作台建立安全、稳定、可回归的 Electron 基础。

本轮遵守三条红线：

1. 不改变六种打印模板的纸张尺寸、分页行数、边距算法、DPI 策略和走纸等待；
2. 不改变图片 OCR 继续调用 `nongxinle-server` 的现有业务链路；
3. MCP 继续复用桌面端既有模板和打印流程，不另建第二套打印引擎。

当前代码侧 P0 整改已形成第一版：

- 客户端长期密钥已从公开配置和打包范围移除；
- preload 已改为具名白名单 API，不再暴露原始 `ipcRenderer`；
- 主进程 IPC 增加主窗口身份、来源地址和参数/路径边界校验；
- 内嵌 MCP 与 Stdio 打印桥只监听回环地址，要求 Bearer Token，并拒绝浏览器来源；
- 活跃业务代码已移除 `executeJavaScript` 动态执行；
- 系统命令改为 `execFile` 参数数组调用，不再由输入拼接 shell；
- 已增加安全冒烟测试和打印契约冻结测试。

但目前还不能直接判定“可生产发布”。以下四项仍是发布门禁：

- 已泄露或曾进入安装包的第三方密钥必须在供应商后台撤销并轮换；
- Windows/macOS 安装包、签名、自动更新和回滚链路尚未建立；
- Electron 19 升级到受支持版本后，必须重新做真实打印机回归；
- Epson 与至少一种其他品牌打印机的六种模板实物测试尚未执行。

## 2. Phase 1 范围

### 2.1 P0

| 项目 | 当前状态 | 本轮结果 | 仍需完成 |
|---|---|---|---|
| 删除客户端长期密钥 | 代码侧已完成第一版 | 公共配置只保留服务地址；构建不再包含私密 `config`；渲染端不再直连 DeepSeek | 供应商后台轮换旧密钥；扫描 Git 历史、旧安装包和发布存储 |
| preload 白名单 API | 已完成第一版 | 只暴露具名业务方法；监听可取消；原始 IPC 和任意 MCP API 代理已删除 | 目标系统 Electron 运行时回归；后续为参数补 schema |
| MCP 鉴权和来源限制 | 已完成第一版 | 只监听 `127.0.0.1`；Bearer Token；拒绝 Origin/Sec-Fetch-Site；无 CORS；后端路由白名单；1 MB 请求上限 | 增加限流、审计保留策略、生产启停策略和 Token 轮换入口 |
| 动态脚本/系统命令风险 | 已完成第一版 | 活跃路径无 `executeJavaScript`；系统命令使用程序名和参数数组；打印机名/DPI 有白名单 | Windows/macOS 真实环境确认命令结果；清理被打包排除的历史备份文件 |

### 2.2 P1

本轮只设计、不直接实施大版本升级和大文件重构：

- Electron 升级方案；
- 主进程拆分方案；
- Vue 大文件模块化方案；
- 打包、签名、更新和崩溃恢复的后续落地顺序。

## 3. 修改顺序、风险和验收标准

### 步骤 0：冻结现场打印基线

状态：已建立代码契约，实物基线待执行。

动作：

1. 把现有六模板视为 `legacy-v1`；
2. 冻结 30/60/12/26/5/12 行分页规则；
3. 冻结 240/241 × 279/140/93 mm 历史尺寸；
4. 冻结 `marginsType: 0`、驱动控制 DPI、隐藏窗口 `zoomFactor = 1.0`；
5. 冻结 400/1500/4000 ms 逐页等待；
6. 准备空数据、临界行数、多一行、多页、长名称、中文/数字混排样本；
7. 保存打印 HTML、设备配置、驱动设置和实物照片。

风险：

- 只有静态测试，没有物理样张时，无法发现驱动缩放、不可打印区域和走纸误差。

验收：

- `npm run test:print-contract` 通过；
- Epson 现场设备六模板页数、裁切、偏移、顺序和回执不低于当前基线；
- 每个结果可追溯到电脑、系统、驱动、打印机、连接方式和 Profile。

### 步骤 1：密钥退出客户端

状态：代码侧已完成第一版；外部密钥轮换待完成。

已实施：

- `vue/src/config/index.js` 只保存公开 API 地址；
- 构建文件清单不再包含私密 `config/**/*`；
- 本地腾讯云配置改为禁用标记，不再读取长期 SecretId/SecretKey；
- 下单页不再直接向 DeepSeek 发送长期 Key；
- 腾讯云 ASR/TTS 的 preload 契约暂时保留，但无密钥时明确返回不可用；
- 图片 OCR 的既有服务端接口未改。

风险：

- 删除本机文件不能让已发布安装包和供应商后台的旧密钥自动失效；
- 两个原来直连 DeepSeek 的文本/Excel 智能整理入口会暂时不可用；
- 如果把第三方代理简单搬到后端但不做用户鉴权、额度和审计，风险只是转移而不是消失。

验收：

- 当前源码、`dist`、解包产物和安装包扫描不到有效长期密钥；
- 旧 Key 在供应商后台已撤销；
- 服务端代理使用服务端秘密管理，具备用户鉴权、超时、额度、审计和错误降级；
- 图片 OCR 的三个现有后端入口完成真实登录态回归；
- 客户端不能直接使用项目级凭据调用第三方服务。

回滚：

- 不允许把长期 Key 回填客户端；
- 如代理未上线，仅回滚 UI 入口显示，不回滚密钥架构。

### 步骤 2：收窄 preload 与 IPC

状态：代码侧已完成第一版。

已实施：

- preload 只暴露打印、打印机配置、受限文件、语音契约、日志和 MCP 等具名方法；
- 不暴露 `ipcRenderer`、通用 `send(channel)` 或 `invoke(channel)`；
- 事件监听返回取消函数，组件卸载时可释放；
- 主窗口启用 `sandbox: true`，保留 `nodeIntegration: false` 和 `contextIsolation: true`；
- 主窗口拒绝新窗口，并只允许开发地址或打包后的准确入口文件；
- 所有 IPC 处理器验证来源主窗口；
- 文件读写绑定用户选择或已保存的客户目录能力，保存文件绑定系统保存对话框结果；
- 打印 HTML 增加非空和 50 MB 上限，不改变 HTML 内容和打印参数。

风险：

- Electron 19 的沙箱 preload 与未来 Electron 42/43 的行为可能有差异；
- 个别页面若依赖未登记的旧 IPC，会在运行时暴露；
- 文件能力收紧后，历史配置中的异常路径可能被拒绝；
- 同步 IPC 仍保留少量兼容接口，后续应逐步退出。

验收：

- 自动测试确认原始 IPC 和未登记通道不可见；
- 非主窗口、错误 frame、错误生产文件 URL 的 IPC 被拒绝；
- 未经过选择或配置的任意文件路径不能读取、写入、移动或打开；
- 登录、订单、OCR、打印机选择、打印校准、六模板打印和菜单清理登录状态均通过桌面运行时测试；
- preload 方法名和打印参数顺序与整改前一致。

回滚：

- 只允许按单个业务方法补回白名单；
- 禁止恢复原始 `ipcRenderer` 或通用通道代理。

### 步骤 3：MCP 鉴权和来源限制

状态：代码侧已完成第一版。

已实施：

- 内嵌 MCP 和 Stdio 打印桥强制监听 `127.0.0.1`；
- 请求必须携带本机生成的 Bearer Token，Token 文件权限设为 `0600`；
- 拒绝带 `Origin` 或 `Sec-Fetch-Site` 的浏览器请求，不提供 CORS；
- 请求体限制为 1 MB；
- 内嵌 MCP 直接由主进程调用后端，不执行渲染脚本、不读取页面 `localStorage`；
- 后端调用只允许两条现有订单路由；
- 传给 MCP 的用户信息只保留配送商 ID 和名称；
- MCP 打印任务使用 IPC、taskId、确认和有限重试，继续走现有桌面模板；
- 本地联调已验证：无 Token 返回 401，浏览器来源返回 403，合法本机请求返回 200。

风险：

- 本机同一用户权限下的恶意程序仍可能读取 Token 文件；
- 当前 Token 是本机持久令牌，不是每次启动轮换；
- 内嵌 MCP 当前随应用启动，尚未增加管理员启停开关；
- 当前配送商 ID 来源于已登录渲染状态，生产前必须由 `nongxinle-server` 再做会话身份和租户归属校验，不能只信客户端 ID；
- MCP 客户端必须同步配置 Token，否则会从“可匿名访问”变为 401；
- Electron 回执只能确认任务已交给渲染打印链路，不能证明纸张物理完成。

验收：

- 非回环连接、无 Token、错误 Token、浏览器来源、超大请求和非白名单 API 均失败；
- 合法 MCP 查询不读取完整登录对象；
- 篡改配送商 ID 时，`nongxinle-server` 必须按当前会话拒绝跨配送商访问；
- 同一 taskId 不重复打印；
- 渲染窗口未就绪或短暂刷新时，任务能重试且有明确失败日志；
- 普通界面打印和 MCP 打印的模板、Profile、纸型、分页和保存记录结果一致；
- 至少完成一次“订单查询 → 下发任务 → 桌面确认 → Epson 实物打印”的端到端回归。

回滚：

- 可关闭 MCP 入口，但不能回滚为匿名 HTTP；
- 打印任务可暂存并提示人工处理，不能静默丢弃后伪造成功。

### 步骤 4：动态脚本和系统命令治理

状态：代码侧已完成第一版；设备回归待完成。

已实施：

- 主进程和 MCP 活跃路径不再使用 `executeJavaScript`；
- MCP 后端请求改由主进程受限 HTTP 客户端完成；
- 打印任务投递改为 IPC；
- macOS 的 `lpstat`、`lpoptions`，Windows 的 `wmic`、PowerShell 均用 `execFile` 参数数组执行；
- 打印机队列名限制为 CUPS 安全字符；
- 可写入的 DPI 只允许 120 × 60、180 × 180、360 × 180。

风险：

- 从 shell 改为参数数组后，标准错误流行为可能与原先的 `2>/dev/null` 有差异；
- 部分品牌驱动的队列名可能包含当前白名单以外字符；
- Windows 新系统可能缺少 `wmic`；
- PowerShell 固定脚本已使用独占临时目录和文件，但仍需验证异常退出后的残留清理；
- 历史 `src/main-bf.js` 仍保留旧实现，但已排除打包。

验收：

- 活跃和打包代码中不存在外部输入参与的脚本字符串执行；
- 系统命令全部由固定可执行文件和参数数组组成；
- 引号、换行、分号、管道符、超长名称和非法 DPI 注入测试全部被拒绝；
- Windows 和 macOS 能读取与整改前一致的打印机名称、默认设备、DPI 和纸型；
- 在真实 Epson 上设置三种已支持 DPI 后，系统驱动显示值和打印结果与整改前一致。

回滚：

- 若特定驱动名称被误拒绝，应扩大经过验证的队列名规则或建立设备映射；
- 禁止为了兼容恢复任意 shell 拼接。

### 步骤 5：自动化与发布门禁

状态：基础测试已建立，完整发布门禁待建设。

当前命令：

```text
npm run test:security
npm run test:print-contract
npm run test:phase1
npm run build:vue
```

后续增加：

- IPC 参数和越权路径单元测试；
- MCP 401/403/413/404、重试、去重和超时集成测试；
- 密钥扫描、依赖漏洞、许可证和安装包解包扫描；
- Electron 主窗口启动、登录、OCR、打印的桌面自动化冒烟测试；
- Windows/macOS 双平台构建；
- 签名、安装、升级、降级阻止和回滚演练；
- 物理打印测试记录上传到发布单。

发布验收：

- 代码测试、Vue 构建、双平台安装包、签名验证全部通过；
- P0 安全项无未接受风险；
- 真实打印机矩阵通过；
- 旧版本升级后保留打印机配置，并可回退到上一签名版本；
- OCR、普通打印和 MCP 打印均有负责人签字。

## 4. Electron 升级方案

### 4.1 版本判断

当前项目使用：

- Electron `^19.1.9`
- electron-builder `^23.6.0`

Electron 官方只支持最新三个稳定大版本，并建议使用当前受支持版本。2026-07-30 查阅官方发布页时，稳定线为：

- 43.2.0
- 42.7.1
- 41.10.3

Electron 19 已远离官方安全支持范围，不能作为生产派单工作台的长期底座。

参考：

- [Electron 发布与支持策略](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Electron 当前稳定版本](https://releases.electronjs.org/?channel=stable)
- [Electron 安全清单](https://www.electronjs.org/docs/latest/tutorial/security)

### 4.2 推荐目标

建议把 Electron 42.7.1 作为第一轮生产候选基线，把 43.2.x 作为紧随其后的验证线：

- 42 属于官方支持的中间稳定线，适合先消化从 19 跨越带来的兼容变化；
- 43 同时建立 CI 验证，42 实物回归稳定后再决定是否直接发布 43；
- 不在生产主线逐个安装所有中间大版本；遇到兼容问题时，再用中间版本做定位；
- `electron`、`electron-builder` 和关键构建插件使用精确版本，不用 `^` 漂移。

具体小版本必须在实施当天重新查阅官方发布页和安全公告后锁定。

### 4.3 升级批次

#### 批次 E0：冻结 Electron 19 行为

- 保存六模板 HTML 和实物样张；
- 导出打印机配置；
- 记录启动、窗口、IPC、文件、OCR、MCP 和打印日志；
- 记录现有 Windows/macOS 安装包结构。

验收：形成可重复的 19 基线，不修改业务输出。

#### 批次 E1：只升级运行时

- 在独立升级分支锁定 Electron 42.7.1；
- 暂时保持 `asar: false` 和现有 builder，先隔离运行时变量；
- 修复废弃 API、沙箱 preload、窗口生命周期和权限处理；
- `getPrinters()` 统一迁移到异步 API，但保持结果结构；
- 比较 Electron 19 与 42 的打印 HTML、打印选项和实际样张。

验收：应用能启动、登录、调用 OCR、读取打印机、完成普通/MCP 打印；六模板实物回归通过。

#### 批次 E2：升级构建工具

- 单独升级 electron-builder 和签名相关工具；
- 保持 Electron 版本不变，避免同时引入两组变量；
- 校验 Windows x64、macOS x64/arm64 产物；
- 建立安装包解包清单和敏感文件扫描。

验收：安装、卸载、覆盖升级、用户数据保留和安装目录权限符合预期。

#### 批次 E3：开启 ASAR

- 从 `asar: false` 迁移到 `asar: true`；
- 对确需外部执行或原生加载的文件使用最小 `asarUnpack`；
- MCP CLI、图标、原生依赖和打印相关资源逐项验证；
- 禁止把服务端配置、测试样本、备份主进程和源码秘密带入包。

验收：解包清单只有预期资源；MCP、OCR、打印全部可用。

#### 批次 E4：签名和更新

- Windows 使用组织代码签名证书或受支持的云签名；
- macOS 完成 Developer ID 签名和 notarization；
- 私有商业应用使用自有 HTTPS 更新源；
- 更新元数据、安装包和差分包都进入发布签名与校验流程；
- 更新只在 `app.isPackaged` 时启用，支持灰度通道、延后安装、失败回滚和最低兼容版本；
- 不允许未签名包覆盖签名生产包。

Electron 官方建议分发应用进行代码签名，并提供 `autoUpdater`/受控更新服务方案：

- [Electron 代码签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron 应用更新](https://www.electronjs.org/docs/latest/tutorial/updates)

验收：签名验证、首次安装、覆盖升级、配置保留、更新失败恢复和回滚演练通过。

### 4.4 升级停止条件

出现任一情况即停止升级并回到上一候选版本：

- 任一纸型裁切、偏移或分页劣于 Epson 基线；
- 同一任务出现重复打印、漏页或保存记录时机变化；
- MCP 打印任务丢失或重复；
- OCR 入口、登录态或客户目录不可恢复；
- 安装包无法验证签名或更新链不能安全回滚。

## 5. 主进程拆分方案

### 5.1 当前问题

`src/main.js` 已超过 3,500 行，同时承担：

- 应用和窗口生命周期；
- IPC 注册与安全校验；
- 六类打印入口和打印窗口；
- 打印机枚举、系统配置、Profile；
- 文件扫描、移动、打开和保存；
- 语音识别/TTS；
- MCP 服务、后端请求和打印投递；
- 菜单、日志和配置文件。

继续在单文件中增加派单相关能力会放大回归范围。

### 5.2 目标结构

```text
src/main/
  bootstrap.js
  lifecycle/
    appLifecycle.js
  windows/
    createMainWindow.js
    navigationPolicy.js
  ipc/
    registerIpc.js
    ipcGuard.js
    validators.js
  printing/
    printService.js
    printWindowFactory.js
    printJobRepository.js
    printerRepository.js
    printerProfileRepository.js
    systemPrinterAdapter.js
  files/
    customerFolderService.js
    fileCapabilityService.js
  mcp/
    embeddedServer.js
    auth.js
    backendGateway.js
    printDelivery.js
  voice/
    voiceGateway.js
  logging/
    appLogger.js
```

### 5.3 拆分顺序

1. 先抽取无副作用的校验器、路径判断和配置读写；
2. 再抽取文件能力和 MCP，保持原 IPC 名称；
3. 抽取窗口创建、导航策略和生命周期；
4. 抽取语音契约，迁移到服务端代理；
5. 最后拆打印：先移动、不改逻辑，再逐个模板回归；
6. 每个步骤单独提交、单独验证、可单独回滚。

打印模块必须最后拆分，因为它包含现场参数、驱动兼容和异步走纸语义。

### 5.4 验收

- `src/main.js` 最终只负责启动和模块注册；
- 每个 IPC 通道只在一个模块注册；
- IPC 名称、参数顺序和返回结构在迁移期间不变；
- 打印服务有契约测试，六模板实物回归通过；
- 模块之间不通过全局变量读取完整 Vue 状态；
- 主进程异常可定位到具体域，日志不记录凭证和完整订单内容。

## 6. Vue 大文件模块化方案

### 6.1 当前优先级

当前主要大文件：

| 文件 | 约行数 | 建议 |
|---|---:|---|
| `PlaceOrder.vue` | 8,511 | 第一优先，先拆非打印的录入、OCR、草稿和提交流程 |
| `TaskOrder.vue` | 4,968 | 第二优先，拆列表、筛选、任务状态和数据访问 |
| `OrderList.vue` | 3,474 | 抽取订单表格、行操作和格式化 |
| 六种 Apply 模板 | 2,438–3,439/个 | 最后处理；先冻结，不直接合并 CSS 和尺寸 |
| `TodayOrders.vue` | 2,649 | 拆订单加载、打印编排和本地缓存 |
| `Bills.vue` | 2,586 | 拆视图状态、客户查询和模板选择 |
| `Screen.vue` | 1,537 | 拆登录、设备配置和自动登录 |

### 6.2 推荐边界

```text
features/place-order/
  components/
    OrderSourceTabs.vue
    DraftList.vue
    OrderEditor.vue
    SubmitSummary.vue
  composables/
    useOrderDraft.js
    useOrderOcr.js
    useOrderSubmit.js
    useCustomerSelection.js
  services/
    orderApi.js
    ocrApi.js
  schemas/
    orderDto.ts

features/printing/
  contracts/
    templateContracts.js
  orchestration/
    usePrintJob.js
    printReceiptPolicy.js
  legacy/
    ApplyPanel.vue
    ApplyFiftyPanel.vue
    ApplyHalfWholePanel.vue
    ApplyHalfPanel.vue
    ApplyThirtyWholePanel.vue
    ApplyThirtyPanel.vue
```

### 6.3 实施原则

- 保留 Vuex，Phase 1 不同时迁移 Pinia；
- 先把 API、纯计算和状态流程移出组件，再拆 UI；
- 新增边界类型优先使用 TypeScript，旧组件渐进迁移，不一次性全量改写；
- 为 `window.electronAPI` 增加 TypeScript 声明和参数 DTO；
- 统一 `vue/src/main.js` 与 `vue/src/router/index.js` 的重复路由定义；
- API 统一经过服务层，组件不直接拼 URL；
- `localStorage` 只保存非敏感、可恢复 UI 状态；登录凭证改为服务端会话或系统安全存储；
- 打印模板在黄金样本和实物回归就绪前只放入 `legacy` 目录，不改布局；
- 共享打印引擎按“一次一个模板”迁移，保留 `legacy-v1` 开关。

### 6.4 验收

- `PlaceOrder.vue` 和 `TaskOrder.vue` 不再同时承担 API、状态机、缓存和全部 UI；
- 路由只有一个权威定义；
- 新增模块有错误处理、超时、取消和可测试的返回类型；
- OCR、草稿恢复、提交、打印和 MCP 的行为不变；
- 六模板逐个对照黄金 HTML 和实物样张，没有一次性全量替换。

## 7. 打印兼容专项验收矩阵

详细现状和演进路线见《打印模块兼容性分析报告》。Phase 1 至少使用以下矩阵：

| 维度 | 最低范围 |
|---|---|
| 品牌 | 现场 Epson + 至少一种非 Epson |
| 操作系统 | 主要生产 Windows；如实际支持 macOS，再覆盖 x64/arm64 |
| 连接 | 现场真实 USB/网络/共享方式 |
| 纸型 | 全张、1/2、1/3 |
| 排版 | 每种纸型单列、双列，共六模板 |
| 数据 | 空、临界行、临界 + 1、多页、超长名称、中文/数字 |
| 动作 | 界面打印、MCP 打印、重复打印、取消、断纸/离线后恢复 |
| 校准 | 默认 Profile、人工边距、缩放、三种已支持 DPI |
| 升级 | Electron 19 基线、42 候选、最终发布候选 |

建议初始实物判定：

- 无裁切、无重叠、无漏页、无重复页；
- 页数和分页点完全一致；
- 打印记录只在正确时机保存；
- 连续打印顺序一致；
- 几何偏移以当前 Epson 黄金样张为基准，建议先用 ±1 mm 作为候选容差，再由现场确认；
- 不能以 Electron `print` 回调代替物理出纸确认。

## 8. 关键风险与处置

| 风险 | 等级 | 处置 |
|---|---:|---|
| Electron 19 → 42/43 改变 Chromium 打印排版 | 高 | 独立升级分支；六模板黄金 HTML + 实物回归；打印不与重构同时进行 |
| 旧密钥仍在供应商或旧安装包有效 | 高 | 立即轮换；旧包下架；历史与发布存储扫描 |
| MCP Token 被同用户本机进程读取 | 高 | 0600 权限、可轮换、管理员启停、工具级审计和后续短期令牌 |
| MCP 新鉴权导致旧客户端 401 | 中 | 发布前更新客户端配置并联调，禁止临时开放匿名访问 |
| 直连 AI 功能暂时不可用 | 中 | 服务端代理完成后恢复入口，不把密钥放回客户端 |
| 文件权限收紧影响旧客户目录 | 中 | 启动时迁移并验证已保存目录；提示用户重新选择 |
| `execFile` 后不同系统输出变化 | 中 | Windows/macOS 对照测试；保留日志；不恢复 shell 拼接 |
| 主进程拆分引入时序变化 | 高 | 保持 IPC 契约；小步搬移；打印最后拆；单步回滚 |
| ASAR 影响 MCP CLI/原生依赖 | 高 | 先升级运行时，再升级 builder，最后开启 ASAR 和最小 unpack |
| 更新失败导致现场停打 | 高 | 灰度、延后安装、上一版本保留、签名校验、回滚演练 |

## 9. Phase 1 完成定义

只有同时满足以下条件，才可以进入派单工作台页面结构设计：

1. 旧第三方密钥已在供应商后台失效；
2. 安全测试、打印契约、Vue 构建和安装包扫描通过；
3. Electron 目标版本完成 Windows 生产环境和打印机矩阵回归；
4. Epson 现有六模板不低于现场基线；
5. 至少一种非 Epson 设备完成兼容记录；
6. OCR 真实服务端链路通过；
7. MCP 鉴权、查询、投递、去重和实物打印端到端通过；
8. Windows/macOS 适用平台签名和安装验证通过；
9. 自动更新具备灰度、错误日志和可执行回滚；
10. 仍未完成的风险有明确负责人、期限和书面接受记录。

满足上述条件后，第二阶段仍按既定边界执行：Electron 只负责派单工作台的展示和操作，派单规则、路线计算和司机状态判断继续由 `nongxinle-server` 提供。
