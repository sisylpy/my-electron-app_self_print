# GrainPrint Windows / Mac 双平台差异与打包检查

> 本文档是桌面端跨平台修改的必读入口。适用于 Electron、微信 Reader、微信界面自动化、窗口停靠、权限和安装包相关工作。
>
> 最后核对：2026-10-22。实际配置以 `package.json`、`src/main.js` 和本文列出的平台适配文件为准；三者发生变化时必须同步更新本文档。

## 1. 最重要的边界

GrainPrint 不是两套独立业务程序，而是：

- 一套共用的 Vue 页面、Electron IPC、微信消息读取和订单业务逻辑；
- 两套操作系统适配：Mac 使用 AppleScript、辅助功能和 Python/CoreGraphics，Windows 使用 PowerShell、UI Automation 和 Win32；
- 两种不同的 Reader 运行环境和安装包资源；
- Mac 额外受代码签名及系统隐私权限约束。

因此修改时遵守以下原则：

1. 消息、附件、订单、去重和客户归属的业务契约保持共用，不按操作系统复制一套业务逻辑。
2. 进程探测、窗口查找、键鼠操作、屏幕识别、权限和运行时路径必须放在对应平台分支。
3. 修改共用层后，Windows 和 Mac 都要验证；修改平台层后，也要确认共用调用方的返回格式没有变化。
4. 任何会话切换或读取都必须核验微信当前真实标题。不能用旧缓存冒充实时结果，否则可能把 A 群订单归到 B 客户。
5. 修改源码后必须重新构建对应安装包。直接热修某台电脑上的已安装文件，只能用于诊断，不能代替把修复写回仓库。

## 2. 文件职责矩阵

| 能力 | 共用入口/契约 | Mac 实现 | Windows 实现 |
|---|---|---|---|
| Electron 生命周期、IPC、运行环境 | `src/main.js`、`src/preload.js` | `src/main.js` 中 `darwin` 分支 | `src/main.js` 中 `win32` 分支 |
| 微信进程是否运行 | `src/wechat/process-state.js` | `pgrep -x WeChat` | `tasklist.exe` 检查 `Weixin.exe`，兼容旧版 `WeChat.exe` |
| 微信 UI 自动化调度 | `src/wechat/ui-automation-service.js` | `src/wechat/ui-automation/mac/` | `src/wechat/ui-automation/windows/` |
| 读取当前会话 | `wechatUi.currentConversation` IPC | `src/wechat/ui-automation/mac/scripts/current_conversation.py` 及 `src/wechat/ui-automation/mac/automation/flows/current_conversation.py` | `src/wechat/ui-automation/windows/current-conversation.ps1` |
| 搜索并打开会话 | `wechatUi.focusConversation` IPC | `src/wechat/ui-automation/mac/scripts/focus_conversation.py`、AppleScript 快速路径 | `src/wechat/ui-automation/windows/focus-conversation.ps1` |
| 读取未读会话 | `wechatUi.readUnread` IPC | `src/wechat/ui-automation/mac/scripts/read_unread.py` 及 `src/wechat/ui-automation/mac/automation/flows/read_unread.py` | `src/wechat/ui-automation/windows/read-unread.ps1` |
| 微信与工作台停靠/恢复 | `src/wechat/workspace-window-service.js` | AppleScript/System Events | `src/wechat/ui-automation/windows/dock-window.ps1`、`src/wechat/ui-automation/windows/focus-window.ps1` |
| Reader JS 桥与服务 | `src/wechat/reader-bridge.js`、`src/wechat/reader-service.js` | 共用 | 共用 |
| Reader Python 业务 | `src/wechat/reader-runtime/product/` | 共用源码 | 共用源码 |
| Reader 启动与数据目录 | `src/wechat/reader-runtime-resolver.js` | 系统 `python3`；材料默认在 `~/Library/Application Support/nongxinle-pos/reader-materials/mac/materials` | 安装包携带 `python-win/python.exe`；材料默认在 `%APPDATA%\nongxinle-pos\reader-materials\windows\materials` |
| 图片容器解码 | `src/wechat/image-container-decoder.js` | 共用解码逻辑及系统可用工具 | 额外打包 `src/wechat/image-tools/windows/` |
| 微信订单编排 | `vue/src/modules/order/services/wechatOrderImport.js` | 共用 | 共用 |
| 订单工作台页面 | `vue/src/modules/order/views/OrderWorkbenchV2.vue` | 共用 | 共用 |
| 构建后处理 | `scripts/after-pack.js` | 固定身份签名并校验 | 不执行 Mac 签名流程 |

注意：表中的“共用”只表示业务代码共用，不表示可以假设两个操作系统的进程名、窗口结构、路径、权限或命令相同。

## 3. 微信客户端的关键差异

| 项目 | Mac | Windows |
|---|---|---|
| Electron 平台值 | `darwin` | `win32` |
| 当前微信名称/进程 | `WeChat` | 微信 4.x 为 `Weixin.exe`；旧版兼容 `WeChat.exe` |
| 进程探测 | `/usr/bin/pgrep -x WeChat` | `tasklist.exe /FI "IMAGENAME eq ..."` |
| UI 技术 | AppleScript、System Events、Accessibility、Python/CoreGraphics | PowerShell、UI Automation、Win32 API |
| 主要系统权限 | 辅助功能、屏幕录制、自动化/AppleEvents | 一般不走 Mac TCC；需要能运行 PowerShell/UIA，权限级别要与微信兼容 |
| 窗口识别 | 按微信进程及实时标题读取辅助功能树 | 必须筛选真正的微信主窗口，不能把 `WeChatAppEx` 辅助窗口或 GrainPrint 停靠面板当作微信 |
| 运行时外部命令 | `osascript`、`python3` | `powershell.exe`、安装包自带 `python.exe`、`tasklist.exe` |

### 已发生过、必须防止复发的问题

- **不能在 Windows 使用 `pgrep -x WeChat`。** Windows 没有 `pgrep`，而且微信 4.x 的主进程是 `Weixin.exe`。否则微信明明打开，状态栏仍会显示“微信未打开”。
- **Windows 不能只按类名或包含关系认窗口。** UIA 曾把 GrainPrint 自己的“读取微信订单”面板识别为微信会话标题。当前会话读取必须绑定真实微信主进程/窗口句柄，并核验主窗口标题。
- **Mac 不能绕过辅助功能和屏幕录制授权。** 自动化失败时先区分权限、签名和功能错误，不要用缓存标题兜底成功。
- **两端都不能因为提速删除最终标题核验。** “已在目标会话”可以走快速路径，但必须实时读取可见标题后才能跳过搜索。

## 4. 共用 Reader 契约不能因性能埋点改变

Reader 调用链为：

`Vue wechatOrderImport` → `preload` → `Electron IPC` → `reader-service` → `reader-bridge` → Python Reader。

必须保持以下约束：

- `reader-bridge.request()` 对业务调用方的返回结构保持稳定。计时信息应留在日志或内部包装层，不能把原值悄悄改成 `{ value, start }` 后只修一部分调用方。
- 回归测试至少覆盖 `getSelfParticipant`、`getParticipants`、`getMessages` 和 `getAttachment` 的解包。
- Reader Python 源码由两个平台共用；Windows 只是自带独立 Python，不应维护旧的业务可执行文件副本。
- 首次没有服务器游标时读取最近 24 小时；`200` 可以是单页大小，不能成为整个时间范围的消息总上限。
- 图片只有缩略图而没有高清原图时，不得把模糊缩略图当正式订单输入。附件延迟、重试或提示策略可以优化，但不能静默制造错误订单。
- 消息去重、客户绑定和订单归属是共用规则，平台适配代码不得各自改写。

## 5. 运行环境与服务器

运行模式由 `src/main.js` 明确决定，不按页面 URL、`NODE_ENV`、登录状态或操作系统猜测：

| 启动方式 | `grainRuntimeMode` | 应用数据目录 | 服务器 | 用户 ID 测试登录 |
|---|---|---|---|---|
| 本地源码 `npm run start` | `development` | `粒子-dev` | 测试服务器 | 允许 |
| Mac 测试安装包 | `test` | `粒子-test` | 测试服务器 | 允许 |
| 正式 Mac/Windows 安装包 | `production` | `粒子` | 正式服务器 | 不允许 |

约束：

- 本地源码只能使用 `development`，必须连接测试服务器，并保留用户 ID 登录入口。
- 正式包必须使用 `production`。不能为了临时测试在正式包中打开用户 ID 登录，也不能用环境变量覆盖安装包模式。
- 测试、打包、安装和部署服务器是四件独立的事。构建桌面安装包不会自动更新服务器；没有明确授权不要部署测试或正式服务器。

## 6. 打包配置差异

### Mac 正式版

```bash
GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac
```

- Vue 使用 production 模式。
- 应用 ID：`club.grainservice.www`。
- 产品名：`GrainPrint`。
- 输出目录：`release/`。
- 同时构建 x64 和 arm64 DMG。
- `package.json` 中 `mac.identity` 为 `null` 是有意设计；稳定签名统一由 `scripts/after-pack.js` 完成。
- 打包前必须完整阅读 `docs/MAC_SIGNING.md`，不能更换证书、改 Bundle ID 或用 ad-hoc 包交付。

### Mac 测试版

```bash
GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac:test
```

- Vue 使用 test 模式。
- 应用 ID：`club.grainservice.www.dev`。
- 产品名：`GrainPrint-Test`。
- 输出目录：`release-test/`。
- 运行时固定连接测试服务器，并允许用户 ID 登录。

### Windows 正式版

```bash
npm run dist:win
```

- Vue 使用 production 模式。
- NSIS 安装包输出到 `release/`。
- 安装包必须额外携带：
  - `src/wechat/reader-runtime/python-win/` → `wechat-reader-runtime/python-win/`
  - `src/wechat/reader-runtime/product/` → `wechat-reader-runtime/product/`
  - `src/wechat/reader-runtime/tools/scquery.exe`
  - `src/wechat/image-tools/windows/`
- 不要把 Windows 独立 Python 重新塞回通用 `files`；它由 `extraResources` 放置在 Reader resolver 约定的位置。

### 所有平台共同注意

- `package.json` 的 `version` 是安装包版本来源；同一次双平台发布应从同一个已确认提交、同一个版本号构建。
- `asar` 当前为 `false`。这便于诊断，但不能把修改已安装目录当作正式修复。
- `release/`、`release-test/`、`release-*` 都是构建产物，不提交 Git。
- 未获明确授权不要运行打包、安装、上传或部署命令。
- 工作区有其他 Agent 的修改时，不要为了打包执行 reset、stash、clean 或全量暂存；正式交付包应等代码边界确认并从干净的正式提交构建。

## 7. 修改时如何判断要检查哪些文件

### 修改微信是否打开/是否登录

至少检查：

- `src/wechat/process-state.js`
- `src/main.js` 的状态缓存与发送逻辑
- Windows 的 `Weixin.exe` / `WeChat.exe`
- Mac 的 `WeChat`
- Reader `listAccounts()` 的登录态判定

### 修改“读取当前微信”或“程序打开微信”

至少检查：

- `src/main.js` 对应 IPC
- `src/preload.js`
- `src/wechat/ui-automation-service.js`
- Mac 对应 Python flow/script
- Windows 对应 PowerShell 脚本
- 最终可见标题核验和失败分支
- 工作台窗口停靠/焦点恢复是否受影响

### 修改消息或附件读取

至少检查：

- `src/wechat/reader-bridge.js`
- `src/wechat/reader-service.js`
- `src/wechat/reader-runtime/product/`
- `src/wechat/reader-runtime-resolver.js`
- `src/wechat/image-container-decoder.js`
- `vue/src/modules/order/services/wechatOrderImport.js`
- Windows 安装包是否仍带齐 Python、`scquery.exe` 和图片工具

### 修改 IPC 或页面调用

三层必须同步：

1. `src/main.js` 的 `ipcMain.handle(...)`；
2. `src/preload.js` 的安全暴露；
3. Vue 调用方及测试。

只改其中一层，开发环境可能看似正常，但安装包会因旧 main/preload 或缺少 API 失败。修改后要完全退出并重启 Electron；刷新 Vue 页面不能加载新的主进程或 preload。

## 8. 双平台验收矩阵

### 共用回归

- 当前微信账号能正确识别。
- `getSelfParticipant`、`getParticipants`、`getMessages`、`getAttachment` 返回契约正常。
- 微信群与微信好友都能读取。
- A 会话切到 B 会话后，不发生客户或订单归属错配。
- 文字订单不丢失；图片附件逻辑不退化。
- 服务端去重结果、客户绑定和首次最近 24 小时规则不变。
- 冷启动与 Reader 已启动两种路径都能工作。

### Mac 真机

- 辅助功能、屏幕录制、自动化权限状态正确。
- 当前会话识别、搜索切换、未读巡查和窗口停靠均验证。
- 微信在前台、后台、最小化以及 GrainPrint 在前台的场景都不误判。
- x64/arm64 产物按需要构建；DMG 内应用签名身份、Bundle ID 和签名完整性通过 `docs/MAC_SIGNING.md` 的检查。
- 覆盖安装后权限与 Safe Storage 登录态按签名规范验证。

### Windows 真机

- `tasklist` 能识别 `Weixin.exe`，并兼容旧 `WeChat.exe`。
- 当前会话脚本只选择微信主窗口，不读取 GrainPrint 停靠面板或 `WeChatAppEx` 辅助窗口。
- PowerShell/UIA 的当前会话、搜索切换、未读巡查和窗口停靠均验证。
- 安装包内独立 Python、Reader product、`scquery.exe` 和图片工具齐全。
- 安装后无需依赖开发机全局 Python。
- 必须在真实 Windows 上做 UIA 验收；Mac 上的静态检查不能代替 Windows 真机结果。

## 9. 双平台发布检查清单

1. 确认本次发布范围，并查看工作区是否混有其他 Agent 的未提交修改。
2. 确认 `package.json` 版本号、运行模式、appId 和产品名正确。
3. 运行受影响的共用测试及平台定向测试，保留 Reader 返回契约回归。
4. 在 Mac 真机验证 Mac 自动化；在 Windows 真机验证 PowerShell/UIA 和安装包资源。
5. 从同一个已确认的正式提交构建两个平台；不要一个平台用源码、另一个用某台机器上的热修文件。
6. 按本文第 6 节分别构建。Mac 额外执行签名验证。
7. 记录两个产物的版本、架构、文件名和校验值，避免把旧安装包误当新版本测试。
8. 覆盖安装后重新验证登录态、当前会话、群聊、好友、图片订单和窗口停靠。
9. 构建不等于推送、发布或部署；每一步都按用户授权单独执行。

## 10. 给后续 Agent 的最短提醒

开始桌面端任务前先回答四个问题：

1. 这次改的是共用业务层，还是 Mac/Windows 平台适配层？
2. 当前运行的是源码开发版、测试安装包，还是正式安装包？
3. Electron 主进程/preload 是否已真正重启并加载新代码？
4. 另一平台是否有同名但实现完全不同的脚本需要同步检查？

如果无法明确回答，不要直接打包。先核对本文的文件矩阵和运行环境，再做最小修改与对应真机验证。
