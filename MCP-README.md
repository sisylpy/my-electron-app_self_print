# GrainPrint 连接器

GrainPrint 桌面端只使用 `grain-print-connector` 提供的本地安全桥，统一监听 `127.0.0.1:3011`。

## 本地开发

- 桌面端：在本目录执行 `npm run start`。
- WorkBuddy 连接器：使用 `grain-print-local-test`。

`npm run start` 只启动 Vite 页面（`3000`）和 Electron，不会另外启动连接器。`grain-print-local-test` 负责连接测试服务器并开启 `3011` 桥。

## 唯一运行链路

1. WorkBuddy 通过 `grain-print-connector` 创建任务。
2. 连接器在 `127.0.0.1:3011` 提供带本机密钥的桥接口。
3. Electron 主进程轮询 3011，获取任务并把执行结果回传。

旧的桌面端内嵌 `3001` HTTP 服务、`3002` 打印队列和 `3010` 默认端口已退役，不再作为可用入口。
