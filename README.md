# 精彩接单（GrainPrint）桌面端

Electron 桌面配送打印工作台。产品名 **GrainPrint**，appId `club.grainservice.www`。

- 源码结构：Vue 3 + Vite 页面在 `vue/`，Electron 主进程在 `src/`（`main: src/main.js`）。
- 本地开发：`npm install` → `npm run build:vue` → `npm start`（同时起 Vite 与 Electron）。
- 打包：
  - `npm run dist:mac`（macOS dmg，x64 + arm64）
  - `npm run dist:win`（Windows nsis）
  - 产物输出到 `release/`，打包配置见根 `package.json` 的 `build` 段。

## 文档

- [WorkBuddy 打印连接器开发交接](docs/workbuddy-print-connector.md) — 三仓库职责、调用链、整合进度与操作边界（持续更新入口）。
