# 配送商 Electron 生产级改造检查报告

> 项目：农心乐配送商系统  
> 审查对象：`ai-priter-electic`  
> 审查日期：2026-07-30  
> 审查分支：`main`  
> 审查基线：`dce2c2e`  
> 报告性质：第一阶段生产级代码审查；除本报告外，未修改业务代码

> 状态说明：本报告保留整改前基线结论。其后开展的 Phase 1 代码整改、当前状态和未完成门禁，以《Electron生产化整改实施方案》为准。

## 1. 审查结论

### 1.1 总体结论

当前项目**尚未达到商业产品的生产发布标准**。

项目已有可运行的 Electron + Vue 桌面应用基础，渲染进程也开启了 `contextIsolation` 并关闭了 `nodeIntegration`，现有 Vue 构建能够成功完成；但客户端密钥、IPC 权限、本地 MCP 服务、任意文件访问、动态脚本执行、系统命令拼接、应用签名、自动更新及质量门禁等关键项仍存在发布阻断问题。

在 P0 问题关闭前，不建议：

- 把现有安装包继续分发给新增生产用户；
- 在 Electron 中接入派单、司机、路线和异常处理等高价值业务能力；
- 将当前本地 MCP 能力默认开放在生产版本；
- 把客户端当前保存的身份信息视为可信登录态。

### 1.2 生产门禁概览

| 检查域 | 结果 | 生产判断 |
|---|---|---|
| Electron 基础隔离 | 部分通过 | 已关闭 Node 集成并启用上下文隔离，但未启用沙箱，桥接面过宽 |
| IPC 与本地能力边界 | 不通过 | 暴露原始 `ipcRenderer`，文件、打印、配置等高权限能力缺少统一校验 |
| 密钥与凭证安全 | 不通过 | 第三方密钥进入客户端源文件、构建产物和历史安装包 |
| 本地 MCP 服务 | 不通过 | 无鉴权、CORS 全开放，可触发读取登录信息及打印相关操作 |
| 登录与本地缓存 | 不通过 | 完整用户对象和业务数据明文存储，自动登录只依赖本地状态 |
| 工程质量 | 不通过 | 无 TypeScript、测试、静态检查、统一 API 层和 CI 门禁 |
| 架构可维护性 | 不通过 | 主进程和多个页面文件过大，职责混杂，路由/API 存在重复实现 |
| 打包与签名 | 不通过 | `asar: false`，整包携带配置和大范围依赖，现有 macOS 包为临时签名 |
| 自动更新 | 不通过 | 无发布源、更新检查、签名更新链和回滚机制 |
| 崩溃恢复与可观测性 | 部分通过 | 有基础错误日志，但缺少脱敏、轮转、崩溃上报、单实例和恢复策略 |
| 构建可用性 | 通过 | 本次 `npm run build:vue` 成功，但存在大包告警 |

### 1.3 已具备的正向基础

- 主窗口已设置 `nodeIntegration: false`、`contextIsolation: true`，方向正确；
- 已使用 preload 作为渲染进程与主进程之间的入口；
- 已有 Vue Router、Vuex、Axios 封装和应用日志的初步结构；
- 已形成 Windows NSIS、macOS x64/arm64 DMG 的打包配置；
- 打印窗口有主动销毁处理，主进程也有全局异常日志；
- 本次 Vue 生产构建成功，说明可以采用渐进式改造，不需要推翻重写。

## 2. 范围和方法

### 2.1 本次范围

本报告只审查：

`/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic`

重点覆盖：

- Electron 主进程、preload、IPC 和渲染进程边界；
- Vue 路由、状态、API、缓存和主要业务组件；
- 密钥、凭证、日志、本地文件和本地 HTTP 服务；
- 构建、打包、签名、自动更新、崩溃恢复；
- 工程规范、测试能力、依赖和产物规模。

`boss-mini` 与 `nongxinle-server` 仅作为后续派单迁移的边界背景，**未纳入本轮完整安全审查**。后续 Electron 派单工作台应继续复用 `nongxinle-server` 的业务判断和数据结果。

### 2.2 审查方式

- 静态检查源代码、配置、依赖声明和本地缓存使用；
- 检查主进程与 preload 的所有高权限入口；
- 执行 Vue 生产构建；
- 检查现有 macOS/Windows 解包产物、包体组成和签名状态；
- 统计大文件、日志调用、临时代码和质量工具缺口；
- 对照 Electron 官方安全、更新和发布建议。

### 2.3 风险等级

| 等级 | 定义 |
|---|---|
| P0 | 生产发布阻断项；可能直接造成密钥泄露、越权调用、本机能力滥用或供应链不可控 |
| P1 | 高风险；上线前必须纳入本轮整改并形成自动化验收 |
| P2 | 中风险；影响稳定性、可维护性、性能或后续派单扩展效率 |
| P3 | 低风险；规范、体验、品牌一致性或长期治理问题 |

## 3. 生产发布阻断项

### P0-01 客户端包含真实第三方密钥

**证据**

- `vue/src/config/index.js` 中配置了 DeepSeek API Key 及腾讯云 SecretId/SecretKey；
- `vue/src/views/PlaceOrder.vue` 直接在渲染进程组装 DeepSeek `Authorization` 请求头；
- `package.json:22-29` 将 `config/**/*` 加入安装包，并关闭 ASAR；
- `config/tencent-cloud.json` 在本地为普通可读文件；
- 本次构建检查确认上述配置值进入 `dist` 静态资源；
- 现有 macOS 和 Windows 解包产物中均存在明文 `config/tencent-cloud.json`。

**影响**

任何能获得安装包、应用目录或渲染进程资源的人，都可能提取密钥并在项目账户额度和权限范围内调用第三方服务。`.gitignore` 只能避免 Git 提交，不能阻止 Vite 编译和 electron-builder 打包。

**立即措施**

1. 立即撤销并轮换已进入客户端和安装包的所有相关密钥；
2. 暂停把 DeepSeek、腾讯云长期密钥放入 Electron；
3. 由 `nongxinle-server` 或独立受控服务代理调用，客户端只拿短期、最小权限、可撤销的业务结果；
4. 在 CI 中增加密钥扫描，并对 `dist`、解包目录和安装包做二次扫描；
5. 删除发布包中的 `config/**/*`，建立公开配置与秘密配置的明确边界。

**验收标准**

- 源码、Git 历史、构建产物、解包产物均扫描不到有效长期密钥；
- 旧密钥在供应商后台已失效；
- 客户端无法直接以项目级长期凭据调用第三方服务。

### P0-02 preload 暴露原始 IPC，主进程能力未形成最小权限边界

**证据**

- `src/preload.js:16-18` 将完整 `ipcRenderer` 暴露给页面；
- `src/preload.js:51-63` 暴露文件扫描、任意路径读取、移动、打开和写入；
- `src/preload.js:65-101` 暴露语音、系统打印机和打印能力；
- `src/preload.js:148-178` 暴露 MCP 配置与任意 API 代理；
- `src/main.js:1278-1286` 可把渲染进程传入的内容写到调用方指定路径；
- `src/main.js:1333-1468` 可读取和移动调用方指定路径；
- IPC handler 未统一校验 `event.senderFrame`、窗口身份、参数结构、路径归属和操作权限。

**影响**

一旦页面出现 XSS、第三方前端依赖被污染或错误导航到非可信内容，攻击代码就可能从普通网页权限升级到本地文件、打印和系统能力。当前 `contextIsolation` 的收益会被过宽的 bridge 明显削弱。

**整改要求**

- 删除 `electronAPI.ipcRenderer`；
- 按业务用例定义窄接口，例如 `orders.exportSelected()`，不要暴露通用 `readFile(path)`；
- 每个 IPC 通道都校验来源窗口、来源 URL、参数 schema、长度、枚举和权限；
- 文件操作改为“用户选择目录后发放短期句柄/能力令牌”，所有路径执行 `realpath` 与根目录包含校验；
- 禁止页面直接指定任意写入路径；保存操作必须绑定一次有效的系统保存对话框结果；
- preload 监听接口返回 `unsubscribe()`，组件卸载时释放监听；
- 建立一份可审计的 IPC 清单和威胁模型。

**验收标准**

- 渲染进程无法访问原始 `ipcRenderer`；
- 未登记通道无法调用；
- 非主窗口、非法 frame、非法参数和越界路径全部被拒绝并记录安全日志；
- IPC 契约有单元测试和集成测试。

### P0-03 本地 MCP HTTP 服务无鉴权且允许任意网页跨域调用

**证据**

- `src/main.js:3104-3108` 应用启动时默认启动 MCP HTTP 服务；
- `src/mcp-server.js:786-845` 创建本地 HTTP 服务；
- `src/mcp-server.js:788-791` 设置 `Access-Control-Allow-Origin: *`；
- 服务未验证 Token、Origin、调用者身份、时间戳或重放；
- 请求体没有明确大小上限；
- MCP 工具能够读取当前登录信息、查询订单并触发打印流程。

**影响**

本机恶意进程可以直接调用；用户浏览器中打开的恶意网页也可能借助开放 CORS 请求本地服务。风险不止是信息读取，还包含消耗打印资源和借用当前登录上下文操作业务接口。

**整改要求**

- 生产版默认关闭 MCP；需要时由管理员显式开启；
- 只绑定 `127.0.0.1`，拒绝 `0.0.0.0`、局域网地址和配置绕过；
- 使用每次启动随机生成的高强度令牌，并配合来源校验、短时效和重放保护；
- 移除 `Access-Control-Allow-Origin: *`，原则上不向浏览器网页开放 CORS；
- 建立工具级权限表，读取身份、查询订单、打印必须分别授权；
- 设置请求体、并发、频率、超时限制及完整审计记录；
- 对高风险操作增加桌面端确认或管理员策略。

**验收标准**

- 未授权网页和本地进程不能调用 MCP；
- 生产安装后服务默认不监听；
- MCP 工具的权限、审计、限流和关闭开关通过自动化测试。

### P0-04 动态脚本和系统命令拼接可被输入污染

**证据**

- `src/main.js:239-287` 将 `apiPath`、`method` 和数据拼接进 JavaScript 字符串，再执行 `webContents.executeJavaScript`；
- `src/main.js:289-311` 通过动态 JavaScript 读取渲染进程 `localStorage`；
- `src/mcp-print-push.js:27-39` 使用 `executeJavaScript` 作为消息后援；
- `src/main.js:1103`、`src/main.js:1239` 将打印机名称和分辨率拼接进 shell 命令；
- 打印机名称可由渲染进程保存，缺少严格字符白名单。

**影响**

输入一旦包含引号、命令分隔符或脚本片段，可能改变原本要执行的脚本或命令。即使目前 UI 没有主动提供恶意值，这也不能作为本地高权限边界的安全保证。

**整改要求**

- 主进程直接使用 Node HTTP 客户端调用后端，不借用渲染进程 Axios；
- 主进程通过明确 IPC 获取必要会话摘要，不执行脚本文本读取页面状态；
- MCP 任务统一使用 `webContents.send` 和可靠的 ready/ack 队列；
- 系统命令使用 `execFile`/`spawn` 参数数组，禁止 shell 拼接；
- 打印机名、分辨率和所有枚举值使用 schema 与白名单校验。

**验收标准**

- 业务路径中不再存在由外部输入参与拼接的 `executeJavaScript`；
- 系统命令不经过 shell；
- 注入测试覆盖引号、换行、分隔符、超长输入和非预期类型。

## 4. Electron 架构审查

### 4.1 主进程结构

`src/main.js` 约 3,212 行，同时承担：

- 窗口生命周期；
- IPC 注册；
- 打印任务与打印机管理；
- 文件读写和目录扫描；
- 语音识别与 TTS；
- HTTP/API 调用；
- MCP 服务和轮询；
- 登录状态读取；
- 设备配置和日志。

这会导致安全权限无法按模块收敛、主进程难以测试、修改打印功能时容易影响窗口或网络功能。

**建议结构**

```text
src/main/
├── bootstrap/          应用启动、单实例、生命周期
├── windows/            主窗口、打印窗口及安全策略
├── ipc/                IPC 注册、来源校验、schema
├── services/
│   ├── printing/
│   ├── files/
│   ├── voice/
│   ├── updates/
│   └── mcp/
├── infrastructure/     配置、日志、HTTP、持久化
└── security/           CSP、权限、导航、协议、路径能力
```

要求“按能力拆分”，不是仅把大文件机械切开。每个服务都应有输入契约、错误类型、权限说明和测试。

### 4.2 preload 设计

当前 preload 是单个大对象，包含约四十个主进程通道和若干持续监听，缺少版本化与领域边界。

建议按 `auth`、`printing`、`files`、`system`、`updates` 等领域暴露最小 API，并使用共享 TypeScript 类型定义。所有事件订阅都返回取消函数，禁止渲染进程拿到 Electron 原生对象。

### 4.3 渲染进程边界

**正向项**

- `nodeIntegration: false`；
- `contextIsolation: true`；
- 未启用 remote 模块。

**缺口**

- Electron 19 未明确设置 `sandbox: true`；
- `vue/index.html` 未配置 CSP；
- 未发现 `setPermissionRequestHandler`；
- 未发现对 `will-navigate`、重定向和 `setWindowOpenHandler` 的统一限制；
- `window.axios`、`window.axiosInstance`、`window.$`、`window.jQuery` 被挂到全局；
- 打印 HTML 直接插入订单与客户数据，缺少统一 HTML 转义。

### 4.4 状态管理

- `vue/src/store/index.js` 把完整 `disUser`、用户信息和部分业务对象写入 `localStorage`；
- OCR/任务队列包含订单字段、图片 Base64 和任务状态，也长期存放在 `localStorage`；
- `rememberPrinterUser` 依据本地开关和本地用户对象直接跳转业务页；
- 状态散落在 Vuex、组件、全局变量和多个 localStorage key 中；
- 没有版本迁移、过期时间、完整性校验和统一清理策略。

建议将状态分为：

1. 服务器权威状态：订单、司机、派单状态，每次以服务端为准；
2. 会话状态：只保留最小用户摘要，启动时向后端重新确认；
3. UI 临时状态：不持久化或只在安全范围内短期持久化；
4. 敏感本地秘密：如确需保存，使用系统凭据库并设置过期、撤销和设备绑定。

### 4.5 路由结构

- `vue/src/main.js:42-61` 直接定义并同步加载三个页面；
- `vue/src/router/index.js` 又存在另一套路由定义，但实际未使用；
- 路由守卫根据本地 `disUser` 和“记住用户”标记判断跳转，不能代替服务端鉴权；
- 页面增加派单工作台后，继续在入口文件堆路由会快速失控。

建议统一 `router/index.ts`，使用路由级懒加载和 `meta` 描述权限；进入受保护页面前通过服务端会话校验，路由仅做界面控制，不承担授权。

## 5. 安全专项审查

### 5.1 登录凭证与会话

**P1**

- 完整用户对象明文保存；
- 本地数据可被用户或其他本机进程修改；
- 自动登录没有向服务端重新校验会话有效性；
- `Home.vue` 使用 `Math.random()` 生成扫码会话标识，不适合作为安全随机标识；
- Axios 开启 `withCredentials`，但未见统一的 401、过期、刷新和退出清理流程。

**建议**

- 登录会话以 HttpOnly、Secure、SameSite 合理配置的服务器 Cookie 或受控短期令牌为准；
- 启动时调用“当前会话”接口确认身份和权限；
- 二维码会话由服务端创建，使用加密安全随机数、短过期、一次性消费和设备绑定；
- 退出、换用户、会话失效时集中清理内存及本地缓存；
- 不把用户对象中的权限字段作为客户端可信授权依据。

### 5.2 文件访问

**P0/P1**

当前接口接受页面传入的绝对路径，可扫描、读取、移动、写入、打开和展示。没有根目录白名单、符号链接处理、文件大小上限和内容类型验证。

建议所有文件操作经过：

`系统选择 → 主进程记录已授权目录 → realpath → 路径包含校验 → 扩展名/大小/数量限制 → 执行 → 审计`

Excel 和图片解析还需要防止压缩炸弹、超大图片、畸形文档和公式注入。导出 CSV/Excel 时，对以 `= + - @` 开头的单元格做安全处理。

### 5.3 本地缓存

**P1**

- localStorage 内含用户、配置、订单和任务数据；
- 没有 TTL、容量治理、加密、完整性校验或模式版本；
- 缓存数据可能在共享电脑、维修、备份或恶意本机软件场景下泄露；
- `App.vue:38-49` 启动时先删除 `deviceAdminConfig`，随后又检查其是否存在，造成逻辑自相矛盾。

建议定义缓存数据分级与保留期。订单和图片类数据应默认最小化、短期化；需要离线能力时使用受控数据库、字段加密、清理任务和迁移版本。

### 5.4 日志

**P1**

- `vue/src/api/axios.js` 输出完整请求配置和响应；
- 多处输出用户、订单、设备和打印参数；
- 本次文本统计约有 3,086 处 `console` 调用；
- 应用日志没有统一脱敏、大小轮转、保留期和上传授权。

日志中可能出现 Cookie、Authorization、手机号、客户、商品、订单和路径信息。

建议：

- 生产环境禁用调试级控制台日志；
- 建立字段级脱敏，默认拒绝记录请求体、响应体和认证头；
- 采用结构化事件名、关联 ID、错误码；
- 设置单文件大小、保留天数和磁盘上限；
- 日志导出和远程上报必须由用户或管理员明确授权。

### 5.5 网络与内容安全

**P1**

- 未配置 CSP；
- macOS 现有包的 `Info.plist` 允许任意网络加载；
- 未统一限制导航、新窗口和权限请求；
- 打印预览 HTML 插入服务端文本但未统一转义；
- 生产 API 地址散落在配置和主进程代码中。

建议建立环境化、签名保护的公开配置；CSP 至少从 `default-src 'self'` 起步，并按实际图片、接口、字体逐项放行；所有外部 URL 经过协议和域名白名单。

## 6. 工程质量审查

### 6.1 TypeScript

项目当前为 JavaScript/Vue JavaScript，未发现 TypeScript 配置和编译门禁。对于 Electron IPC、派单状态、订单 DTO 和司机/路线操作，缺少类型约束会放大字段误用与空值错误。

不建议一次性重写。建议：

1. 先为共享 IPC schema、新增主进程模块和 API DTO 使用 TypeScript；
2. 新开发的派单工作台全部使用 TypeScript；
3. 旧组件按变更频率逐步迁移；
4. CI 开启 `vue-tsc --noEmit`。

### 6.2 大文件与职责

本次统计的主要大文件：

| 文件 | 约行数 |
|---|---:|
| `vue/src/views/PlaceOrder.vue` | 8,644 |
| `vue/src/views/TaskOrder.vue` | 4,968 |
| `vue/src/views/OrderList.vue` | 3,474 |
| `vue/src/components/ApplyFiftyPanel.vue` | 3,439 |
| `src/main.js` | 3,212 |

整个 `src` 与 `vue/src` 约 66,123 行，但文件数量相对较少，业务明显集中在大组件中。应按“数据编排、领域组件、纯展示组件、composable、API、类型”拆分。

派单工作台不能继续采用单个数千行页面的模式。建议在第二阶段设计时先确定工作台容器、司机面板、订单池、路线画布、地图、客户详情、装车和异常抽屉的边界。

### 6.3 组件复用与遗留文件

发现：

- `src/main-bf.js`；
- `vue/src/api/all copy.js`；
- `ImageUploadBeifen.vue`；
- `vue/src.zip`；
- 多处 copy、备份、临时和旧版实现。

这会造成修复落错文件、打包多余资源和审查噪声。确认无引用后应通过 Git 历史保留，而不是把备份文件放在源代码目录。

### 6.4 API 管理

当前至少存在两套 Axios 封装：

- `vue/src/api/axios.js`；
- `vue/src/utils/request.js`。

它们的响应语义、错误处理和日志行为不一致；部分主进程 API 地址又直接硬编码。派单工作台接入前必须统一：

- base URL 与环境配置；
- 请求/响应 DTO；
- Cookie/Token 策略；
- 业务错误码；
- 401、403、429、5xx 和网络离线处理；
- 请求取消、超时、重试和幂等键；
- 可观测性关联 ID；
- 禁止把完整请求/响应写入日志。

### 6.5 错误处理

- 多处 catch 只打印或直接吞掉；
- UI 错误提示、业务错误、网络错误和系统错误未分层；
- 全局 loading 使用单一布尔状态，多个并发请求可能提前关闭；
- 打印、文件移动等操作缺少统一的幂等和可恢复事务状态。

建议定义 `AppError`、`BusinessError`、`NetworkError`、`SystemCapabilityError`，统一映射用户提示、重试策略和安全日志。并发 loading 使用计数器或请求作用域。

### 6.6 质量工具和测试

当前根项目和 Vue 项目均未发现：

- `test`；
- `lint`；
- `typecheck`；
- 格式化校验；
- 单元测试框架；
- Electron 端到端测试；
- CI 工作流；
- 覆盖率和发布门禁。

最低质量门禁建议：

```text
install --frozen
secret-scan
lint
typecheck
unit-test
ipc-contract-test
electron-smoke-test
build
package
unpack-and-scan
sign-and-verify
update-smoke-test
```

### 6.7 依赖治理

- Electron `19.1.9` 已停止维护多年；
- electron-builder `23.6.0` 也较旧；
- 根依赖中含多项看起来应由包管理器解析的传递依赖；
- 根目录和 Vue 子目录存在重复依赖管理；
- 没有自动依赖更新和 SCA 门禁。

本次没有向公共 npm registry 提交项目依赖清单，因此**没有得到权威的在线漏洞数量**。不能把这一项解读为“无漏洞”。上线前应在企业 CI、内部镜像或批准的安全平台执行锁文件级 SCA，并人工评估 Electron 大版本升级的破坏性变更。

## 7. 桌面生产能力审查

### 7.1 Electron 版本

Electron 19 发布于 2022 年，已于 2022-11-29 结束支持。Electron 官方仅支持最近三个稳定大版本。继续使用 Electron 19 意味着 Chromium、Node.js 和 Electron 本身的安全修复无法得到保障。

建议先建立冒烟测试，再分阶段升级到审查时受支持的稳定版本；不要直接用“能启动”作为升级完成标准。重点回归打印、preload、权限、语音、系统命令、窗口生命周期和打包。

### 7.2 打包范围与包体

`package.json` 当前：

- `asar: false`；
- 显式包含整个 `node_modules/**/*`；
- 显式包含 `config/**/*`；
- 未区分运行时依赖和开发/构建依赖。

现有产物抽样：

| 项目 | 约大小 |
|---|---:|
| `release` 总目录 | 1.2 GB |
| macOS 解包应用 | 297 MB |
| macOS `Resources/app` | 122 MB |
| Windows 解包应用 | 317 MB |
| Windows `resources/app` | 124 MB |
| macOS DMG | 约 103–105 MB |
| Windows 安装程序 | 约 92 MB |

ASAR 不是安全加密，但开启后可减少散落文件并改善完整性管理；真正的可信发布还需要签名、fuses、产物扫描和最小文件清单。

### 7.3 签名与公证

现有 macOS 应用检查结果为 ad-hoc 签名，无 TeamIdentifier，不是面向用户分发所需的 Developer ID 签名与公证流程。Windows 也未看到代码签名配置和证书策略。

建议：

- macOS：Developer ID Application 签名、hardened runtime、entitlements、公证和 stapling；
- Windows：受保护的代码签名证书、时间戳、签名校验；
- CI 中启用强制签名，签名缺失直接阻断发布；
- 证书只存放在受控密钥系统中，不进入仓库和普通构建机；
- 发布后验证安装包和应用内二进制签名。

### 7.4 自动更新

`package.json:16` 为 `publish: null`，未见 `autoUpdater`、更新源、通道、签名校验、灰度、失败回滚和版本撤回机制。

商业桌面产品至少需要：

- 稳定/灰度更新通道；
- 签名更新包；
- 启动后延迟检查与手动检查入口；
- 下载进度、安装提示和强制更新策略；
- 断点/失败处理；
- 可回滚或可撤回版本；
- 服务端最低安全版本控制；
- 更新流程的端到端测试。

### 7.5 配置管理

当前开发、测试、生产配置与秘密配置边界不清，生产 API 地址在多处硬编码。建议形成：

- 编译期公开配置：环境名称、公开 API 域名、功能开关默认值；
- 服务端远程配置：有签名、版本、缓存和失败兜底；
- 本机管理员配置：存放 userData，schema 校验，最小权限；
- 秘密：不进入客户端；
- 所有配置都有版本、默认值、迁移和审计。

### 7.6 崩溃恢复与运行稳定性

已有主进程和渲染进程基础错误日志，但未见：

- `requestSingleInstanceLock`；
- `render-process-gone`、`child-process-gone`、`unresponsive` 的统一处理；
- crashReporter 或受控崩溃收集；
- 启动失败安全模式；
- 更新失败回滚；
- 页面级错误边界；
- 未完成打印/导出/文件移动任务的恢复策略。

建议建立“单实例 → 会话恢复 → 未完成任务恢复 → 崩溃计数 → 安全模式 → 用户可导出诊断包”的完整链路。

### 7.7 品牌与版本一致性

- `package.json` 产品名为 `GrainPrint`；
- `src/main.js:3091-3092` 应用名设置为“粒子”；
- `vue/index.html` 标题为 `My Electron Appnonono`；
- 当前版本固定为 `1.0.0`。

发布前应统一为“农心乐配送商系统”下明确的桌面产品名称，并建立可追溯的语义版本、构建号、提交号和环境标识。

## 8. 构建与产物验证结果

### 8.1 本次验证

| 验证项 | 结果 | 说明 |
|---|---|---|
| Vue 生产构建 | 通过 | 574 个模块，约 13.48 秒 |
| 主 JS 包 | 告警 | 约 1,536.68 KB，gzip 约 428.45 KB |
| 主 CSS 包 | 偏大 | 约 569.90 KB，gzip 约 80.85 KB |
| XLSX chunk | 偏大 | 约 429.53 KB，gzip 约 143.08 KB |
| Vite chunk 门限 | 不通过 | 主包超过 600 KB 告警 |
| 客户端秘密扫描 | 不通过 | 构建资源和旧安装包中确认存在已配置秘密 |
| macOS 正式签名 | 不通过 | 现有包为 ad-hoc 签名 |
| 自动更新 | 不通过 | 无发布配置与更新代码 |
| 自动化测试 | 无法执行 | 项目没有测试脚本和测试套件 |
| 在线依赖漏洞审计 | 未执行 | 需在获批的企业 CI/内部安全平台完成 |

### 8.2 性能建议

- 页面按路由懒加载；
- XLSX、地图、图表、OCR、派单画布等重量能力按需加载；
- 移除全局 jQuery 和未使用依赖；
- 对 Vue 大组件拆分后再做 chunk 边界；
- 为列表使用虚拟滚动，地图 marker 和路线图层做数量上限；
- 生产构建设包体预算，超过预算阻断 CI。

## 9. 分阶段整改路线

### 阶段 A：立即止血，预计 1–3 个工作日

1. 撤销并轮换已泄露的 DeepSeek、腾讯云密钥；
2. 停止在客户端编译和打包长期密钥；
3. 生产版关闭本地 MCP，或在启用前完成最小鉴权；
4. 删除 raw `ipcRenderer` 暴露；
5. 暂时关闭高危通用文件写入和动态 API 代理；
6. 生产日志停止输出认证头、请求体、响应体、用户和订单详情；
7. 停止分发含旧密钥的安装包，形成受影响版本清单。

**出口条件：** P0 暴露面已封堵，旧密钥已失效，新安装包不含秘密。

### 阶段 B：安全壳与架构基线，预计 1–2 周

1. 建立受支持 Electron 版本升级分支和冒烟测试；
2. 启用 renderer sandbox；
3. 完成 CSP、导航、新窗口、权限和外链策略；
4. 重建最小 preload 与类型化 IPC；
5. 文件能力改为授权目录/句柄模型；
6. 系统命令改为无 shell 参数调用；
7. 拆分主进程服务，移除 `executeJavaScript` 业务通道；
8. 统一会话校验和安全缓存策略。

**出口条件：** Electron 官方安全清单中的适用项均有代码、测试或书面例外。

### 阶段 C：工程质量基线，预计 2–4 周

1. 新代码全面使用 TypeScript；
2. 统一 Router、API client、错误模型和状态分层；
3. 拆分 `main.js` 和高频变更大组件；
4. 清理备份文件、未使用路由和全局对象；
5. 引入 lint、format、typecheck、unit、IPC contract 和 Electron smoke test；
6. 建立日志脱敏、轮转、诊断包和性能指标；
7. 建立依赖升级与 SCA 门禁。

**出口条件：** 主分支必须通过自动化质量门禁，关键 IPC 和登录路径有回归测试。

### 阶段 D：商业发布链，预计 1–2 周

1. 最小化打包文件和生产依赖；
2. 配置 macOS/Windows 正式签名；
3. 完成 macOS 公证；
4. 建立自动更新、灰度、撤回和最低安全版本；
5. CI 生成可追溯产物、SBOM、校验和与发布说明；
6. 验证全新安装、覆盖安装、更新、失败恢复和卸载。

**出口条件：** 签名、更新、回滚、崩溃恢复及安装冒烟测试全部通过。

### 阶段 E：进入派单工作台设计

只有 A、B 阶段完成且 C 阶段质量门禁可运行后，再进入第二阶段“Electron 派单工作台页面结构设计”。

原因是派单工作台将接触订单、司机、路线和操作状态；在当前 IPC、会话和日志边界下直接开发，会把高价值业务叠加到不安全的壳上，后续返工成本更高。

## 10. 派单迁移前置约束

本报告不提前设计页面或改写业务，但为下一阶段确定以下技术边界：

1. Electron 只负责展示与操作，不实现派单规则、路线计算、司机状态判断；
2. `nongxinle-server` 是订单状态与派单结果的权威来源；
3. 分派中、装车中、配送中必须使用服务端定义的状态和允许操作集合；
4. 所有“确认派单、装车、发车、异常处理”操作必须有幂等键、权限校验、操作人和审计记录；
5. 桌面端不能根据本地缓存自行推进订单状态；
6. 实时数据需在后续接口复用阶段确认采用轮询、SSE 或 WebSocket，不在前端虚构实时性；
7. 地图和路线只展示服务端结果；人工调整应提交为明确操作，由服务端验证并保存；
8. 页面结构设计完成后，先形成接口矩阵和状态机对照，再开始编码。

## 11. 生产验收清单

以下项目全部满足，才能给出“可商业发布”结论：

### 安全

- [ ] 所有已暴露密钥已轮换，客户端与安装包不含长期秘密；
- [ ] raw `ipcRenderer` 已移除；
- [ ] IPC 有来源校验、schema、权限和测试；
- [ ] 文件能力有授权根目录、路径包含和文件限制；
- [ ] MCP 默认关闭或完成强鉴权、限流和审计；
- [ ] 无外部输入参与动态脚本或 shell 命令拼接；
- [ ] CSP、导航、新窗口、权限、外链策略生效；
- [ ] 会话以服务端为准，本地身份不可伪造授权；
- [ ] 日志完成脱敏、轮转和保留期治理。

### 工程

- [ ] 新代码 TypeScript 化，`typecheck` 通过；
- [ ] Router、API、错误处理和状态管理只有一套主实现；
- [ ] 主进程按领域拆分；
- [ ] 关键大组件完成职责拆分；
- [ ] lint、unit、IPC、Electron smoke 和核心流程回归测试通过；
- [ ] 依赖 SCA、密钥扫描、SBOM 和包体预算进入 CI。

### 桌面发布

- [ ] Electron 处于官方支持版本；
- [ ] 打包文件清单最小化，生产包不含开发工具和秘密配置；
- [ ] macOS 签名、公证和 Windows 签名验证通过；
- [ ] 自动更新、灰度、撤回和回滚验证通过；
- [ ] 单实例、崩溃恢复、安全模式和诊断包可用；
- [ ] 版本号、构建号、提交号和发布说明可追溯。

### 派单接入

- [ ] Boss 现有流程与服务端状态机已形成对照表；
- [ ] 实时订单、分派、装车、发车、配送和异常接口已形成复用矩阵；
- [ ] 权限、幂等、并发冲突和审计方案经后端确认；
- [ ] Electron 不含派单规则、路线计算和司机状态的重复实现。

## 12. 建议的下一步

按照既定顺序，下一步应先由项目负责人确认本报告中的 P0/P1 范围和整改优先级。

确认后再进行第二步：

**设计 Electron 派单工作台页面结构**

该阶段的产出应包括：

- 左侧司机与订单状态区；
- 中间路线工作区；
- 右侧地图与客户详情区；
- 分派中、装车中、配送中的桌面状态切换；
- 异常处理与操作确认；
- 组件边界、状态来源、空态、冲突态和错误态；
- 不包含后端派单规则的前端职责说明。

随后进入第三步接口复用方案，最后才开始开发。

## 13. 主要证据索引

| 证据 | 位置 |
|---|---|
| 构建、打包、ASAR、依赖版本 | `package.json` |
| preload 与 IPC 暴露 | `src/preload.js` |
| 主进程窗口、IPC、文件、命令、MCP | `src/main.js` |
| MCP HTTP 服务 | `src/mcp-server.js` |
| MCP 动态脚本后援 | `src/mcp-print-push.js` |
| 第三方配置 | `vue/src/config/index.js`、`config/tencent-cloud.json` |
| DeepSeek 客户端调用 | `vue/src/views/PlaceOrder.vue` |
| 登录缓存 | `vue/src/store/index.js`、`vue/src/utils/rememberPrinterUser.js` |
| 路由与全局对象 | `vue/src/main.js`、`vue/src/router/index.js` |
| 启动缓存逻辑 | `vue/src/App.vue` |
| HTTP 日志 | `vue/src/api/axios.js`、`vue/src/utils/request.js` |
| 构建内容安全 | `vue/index.html`、`vue/vite.config.js` |
| 历史解包产物 | `release/mac-arm64`、`release/mac`、`release/win-unpacked` |

## 14. 官方基线参考

- Electron Security：https://www.electronjs.org/docs/latest/tutorial/security
- Electron Releases：https://releases.electronjs.org/schedule
- Electron Support Policy：https://www.electronjs.org/docs/latest/tutorial/electron-timelines
- Electron Updating Applications：https://www.electronjs.org/docs/latest/tutorial/updates
- Electron autoUpdater API：https://www.electronjs.org/docs/latest/api/auto-updater/
- electron-builder Code Signing：https://www.electron.build/docs/features/code-signing/
- electron-builder Notarization：https://www.electron.build/docs/notarization/
