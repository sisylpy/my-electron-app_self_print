# Mac 打包签名规范（GrainPrint 桌面端）

> 本文档记录 2026-10-17 在本机（Intel，x86_64）**实际验证通过**的 Mac 打包签名方案。
> 处理 Mac 打包问题前必须先读本文档，按既有身份执行，不要重新摸索或擅自更换签名方案。

## 1. 为什么必须用稳定签名，不能用 ad-hoc

- macOS 的辅助功能、屏幕录制、自动化（AppleEvents）、钥匙串访问等 TCC 授权，是按**代码签名身份 + Bundle ID** 记在系统授权数据库里的。
- ad-hoc 签名（`codesign --sign -`）每次构建产生的 cdhash 都不同，macOS 会把它当成一个全新的应用，之前授予的辅助功能、屏幕录制、自动化授权以及 Electron Safe Storage（记住用户令牌所在的加密存储）**都可能丢失**，用户每次升级都要重新授权、重新扫码登录。
- 本项目的 `scripts/after-pack.js` 因此**默认拒绝隐式 ad-hoc**：未指定签名身份且未显式允许时直接构建失败。
- 使用固定自签名证书后，cdhash 虽随内容变化，但 Designated Requirement 与证书链一致，覆盖安装时系统会认定为同一应用，授权得以保留。

## 2. 本机签名身份（已验证存在，不要重建）

| 项目 | 值 |
|---|---|
| 证书/身份名称 | `GrainPrint Local Code Signing` |
| SHA-1 | `7F2EBD2B5467D85FF9060048A86C311C758C9317` |
| 钥匙串 | `/Users/lpy/Library/Keychains/login.keychain-db`（含私钥） |
| TeamIdentifier | `not set`（本地自签，非 Apple 开发者证书） |
| 正式 Bundle ID | `club.grainservice.www` |

已安装版本 `/Applications/GrainPrint.app` 就是用该身份签名的（`Authority=GrainPrint Local Code Signing`，签名时间 2026-10-17 07:39:31）。

### 查验命令

```bash
# 列出本机可用代码签名身份（正常应返回 1 valid identity）
security find-identity -v -p codesigning

# 查看证书指纹
security find-certificate -a -c "GrainPrint Local Code Signing" -Z -p

# 查看私钥所在钥匙串
security find-key -c "GrainPrint Local Code Signing"

# 查看已安装 App 的签名身份（注意必须带 --verbose 才会输出 Authority）
codesign -dv --verbose=2 /Applications/GrainPrint.app 2>&1 | grep -E "Authority|Identifier|TeamIdentifier"
```

## 3. `GRAIN_MAC_SIGNING_IDENTITY` 配置方法

`scripts/after-pack.js` 的规则（`resolveSigningIdentity`）：

1. 读取环境变量 `GRAIN_MAC_SIGNING_IDENTITY`；
2. 若已设置，则要求 `security find-identity -v -p codesigning` 的输出**包含该字符串**，否则报错；
3. 未设置且 `GRAIN_MAC_ALLOW_ADHOC` 不为 `1` 时，直接抛错终止构建；
4. 校验通过后执行 `codesign --force --deep --sign <identity> --timestamp=none <app>`，随后做 `--verify --deep --strict --verbose=2` 与 `-d -r-` 复核。

正确用法（正式构建必须这样执行）：

```bash
cd /Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic
GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac
```

`GRAIN_MAC_ALLOW_ADHOC=1` 是**临时诊断开关**，产物不得作为交付安装包使用（项目构建时会打印警告：TCC 权限可能无法跨升级保留）。

补充：`package.json` 中 `build.mac.identity` 为 `null`，electron-builder 自身不签名（日志出现 `skipped macOS code signing reason=identity explicitly is set to null` 属**正常**），签名统一由 `after-pack.js` 完成，不要因此误判为签名失败。

## 4. Bundle ID 与打包命令

| 版本 | appId | productName | 输出目录 | 命令 |
|---|---|---|---|---|
| 正式版 | `club.grainservice.www` | `GrainPrint` | `release/` | `GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac` |
| 测试版 | `club.grainservice.www.dev` | `GrainPrint-Test` | `release-test/` | `GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac:test` |
| Windows | `club.grainservice.www` | `GrainPrint` | `release/` | `npm run dist:win`（nsis，x64；签名校验只针对 darwin，Windows 不受影响） |

**Bundle ID 固定不变**，测试版只通过 `dist:mac:test` 自带的 `--config.appId` 覆盖为 `.dev` 后缀，不要手改 `package.json` 里的 `appId`。

## 5. Intel / Apple Silicon 安装包生成与验证

`package.json` 中 `build.mac.target` 为 `dmg`，架构含 `x64` 与 `arm64`，默认一条命令同时产出两个 DMG。也可单独指定：

```bash
GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac -- --x64
GRAIN_MAC_SIGNING_IDENTITY="GrainPrint Local Code Signing" npm run dist:mac -- --arm64
```

2026-10-17 实际构建结果：

| 文件 | 大小 | 架构 | 适用 |
|---|---|---|---|
| `release/GrainPrint-1.0.26.dmg` | 142 MB | x86_64 | Intel Mac（本次构建机） |
| `release/GrainPrint-1.0.26-arm64.dmg` | 138 MB | arm64 | Apple Silicon |

构建后验证（对 DMG 内 `/Volumes/.../GrainPrint.app` 或 `release/mac/GrainPrint.app`、`release/mac-arm64/GrainPrint.app` 执行）：

```bash
# 1) 签名身份与 Bundle ID
codesign -dv --verbose=2 release/mac/GrainPrint.app 2>&1 | grep -E "Authority|Identifier|TeamIdentifier|Signed Time"
# 期望：Authority=GrainPrint Local Code Signing；Identifier=club.grainservice.www

# 2) 签名完整性
codesign -vvv --deep --strict release/mac/GrainPrint.app
# 期望：valid on disk / satisfies its Designated Requirement

# 3) 确认不是 ad-hoc：Authority 必须是具体身份，不能缺失
```

本次两个架构产物均通过第 1、2 项验证，且包内 `src/order/order-session-gateway.js` 含当次修复代码（确认打包来源为最新源码）。

## 6. 覆盖安装后的验证步骤

> 说明：以下为覆盖安装后的检查路径。签名与打包已按第 5 节验证；**权限保留情况需在安装本机实际确认**。

1. **签名**：`codesign -dv --verbose=2 /Applications/GrainPrint.app 2>&1 | grep Authority` → 应仍为 `GrainPrint Local Code Signing`。
2. **辅助功能 / 屏幕录制 / 自动化**：系统设置 → 隐私与安全性 → 对应分类，确认 `GrainPrint` 仍勾选、**没有重复出现同名条目**（重复条目意味着系统把它当成新应用，说明签名身份变了）。
3. **钥匙串与 Safe Storage**：启动后不应要求重新扫码登录；桌面端记住用户令牌存放在应用 userData 目录（文件名 `desktop-remember-token.json`，正式版应用名为 `GrainPrint`）。若登录态仍在，说明 Safe Storage 未被重置。
4. **功能自检**：订单读取、图片订单识别、微信读取窗口排列（依赖辅助功能与屏幕录制）各走一遍。

若授权确实丢失，先在「系统设置」中删除旧条目再重新勾选；**不要**用 `tccutil reset` 全量重置，也不要因为授权丢失就改用 ad-hoc 签名或更换证书。

## 7. 常见故障与排查

### 7.1 `security find-identity` 看起来返回 0（本次实际踩坑）

**现象**：执行 `security find-identity -v -p codesigning | grep -E "Developer ID|Apple Development|Mac Developer"` 无输出，误判"本机没有代码签名证书、必须购买 Apple Developer 证书"。

**真实原因**：本机身份名是 `GrainPrint Local Code Signing`，**不含上述 Apple 关键字，被 grep 过滤掉了**。实际 `security find-identity -v -p codesigning` 返回 `1 valid identities found`。

**结论**：不要对 `security find-identity` 的输出加任何关键字过滤，也不要仅凭"没有 Apple 官方证书"就断定无法签名。正确做法是完整查看输出，再按第 2 节命令核对。

### 7.2 构建报 `缺少稳定的 macOS 代码签名身份…`

即 `after-pack.js` 抛错。原因与处理：

- 未设置 `GRAIN_MAC_SIGNING_IDENTITY` → 按第 3 节显式指定身份后重试；
- 身份名写错（多空格、大小写、引号）→ 用 `security find-identity -v -p codesigning` 复制准确名称；
- 私钥缺失/钥匙串锁定 → 用第 2 节命令确认证书与私钥仍在 `login.keychain-db`，必要时在「钥匙串访问」中解锁登录钥匙串后重试。

### 7.3 误以为"没有签名"

`package.json` 的 `mac.identity` 为 `null`，构建日志会出现 `skipped macOS code signing reason=identity explicitly is set to null`。这是**预期行为**，签名由 `after-pack.js` 完成，按第 5 节验证 `Authority` 即可。

### 7.4 证书或私钥确实丢失

先按第 2 节命令确认。**确认丢失时停止操作并上报**，由用户决定是否重建；重建意味着本机已授予的辅助功能、屏幕录制、自动化授权与 Safe Storage 登录态都会失效，需要重新授权。

## 8. 禁止事项

- 禁止重新生成、替换或导入新的代码签名证书来"绕过"当前签名身份问题。
- 禁止修改正式 `appId`（`club.grainservice.www`）与测试 `appId`（`club.grainservice.www.dev`）。
- 禁止把 `GRAIN_MAC_ALLOW_ADHOC=1` 产出的包当作正式或测试交付安装包。
- 禁止修改、跳过或删除 `scripts/after-pack.js` 的签名校验与 `codesign` 步骤。
- 禁止在文档、日志、提交或 Issue 中记录私钥、钥匙串密码及其他凭据。
- 禁止把 `release/`、`release-test/`、`release-1.0.26/` 等构建产物提交进仓库（`.gitignore` 已忽略 `/release/`，其余产物目录需手动排除，提交前用 `git status` 确认）。
