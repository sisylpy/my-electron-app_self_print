# GrainPrint MCP 使用说明

GrainPrint 提供配送单客户查询、预览、确认打印和按子部门打印能力。MCP 只下发打印意图，最终仍复用桌面端现有 Vue 模板、打印机配置、分页、走纸等待和打印记录流程。

## 推荐方式：Stdio MCP

WorkBuddy、Cursor 等客户端优先直接启动 `src/mcp-server-cli.js`：

```json
{
  "mcpServers": {
    "grain-print": {
      "command": "node",
      "args": [
        "/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic/src/mcp-server-cli.js"
      ],
      "env": {
        "GRAIN_DIS_ID": "配送商ID"
      }
    }
  }
}
```

Stdio 进程与 Electron 之间的本地打印队列：

- 只监听 `127.0.0.1:3002`；
- 不开放 CORS，拒绝浏览器 Origin；
- 使用 Bearer Token；
- Token 自动生成在 `~/.grain-print/mcp-bridge-token`，权限为当前用户可读写；
- Electron 和 Stdio 进程自动读取同一个 Token，无需手工复制；
- 打印任务通过 Electron IPC 投递，并按 `taskId` 回执和有限重试。

## 可选方式：内嵌 HTTP MCP

Electron 启动后会在 `127.0.0.1:3001` 启动内嵌服务。此入口适合明确支持自定义 HTTP Header 的 MCP 客户端。

安全要求：

- 每个请求必须带 `Authorization: Bearer <token>`；
- Token 自动生成在 Electron `userData/mcp-auth-token`；
- 桌面端 MCP 状态接口会返回 Token 文件路径，但不会把 Token 内容暴露给页面；
- 只接受本机连接；
- 拒绝带 `Origin` 或 `Sec-Fetch-Site` 的浏览器请求；
- 请求体上限为 1 MB；
- 后端只允许已登记的两个配送单接口；
- `backendUrl` 只允许农心乐生产接口，或 `localhost`/`127.0.0.1`/`::1` 本机开发地址。

内嵌 HTTP 配置示例：

```json
{
  "host": "127.0.0.1",
  "port": 3001,
  "backendUrl": "https://grainservice.club:8443/nongxinle/api/"
}
```

`host` 会被强制固定为 `127.0.0.1`。修改端口或后端地址后需要重启 Electron。

## 工具

- `get_delivery_customers`：今日待打印配送单客户；
- `preview_delivery_order`：预览指定客户；
- `confirm_print_delivery_order`：确认并下发打印；
- `dispatch_delivery_print_to_app`：只下发已有打印意图；
- `print_each_subdepartment_delivery_order`：按子部门顺序下发。

多子部门客户必须先确认打印范围：全店、单个子部门或每个子部门各打一张。无子部门客户可以直接确认打印。

## 安全边界

- MCP 只能使用 Electron 当前内存中的最小配送商会话摘要；
- 配送商 ID 仍属于客户端输入，`nongxinle-server` 必须按当前会话校验租户归属；
- 不读取渲染进程 `localStorage`，不在页面执行动态脚本；
- 不向 preload 暴露任意 API 代理；
- 不允许 MCP 自定义任意后端路径；
- Token 不写日志，不进入源码和安装包；
- 退出 Electron 后，内存会话摘要会被清理。

## 故障排查

连接失败时检查：

1. GrainPrint 是否已启动；
2. Stdio 客户端配置中的脚本路径是否是当前项目路径；
3. `GRAIN_DIS_ID` 是否已设置；
4. 3001/3002 端口是否被占用；
5. Token 文件是否存在且当前用户可读；
6. Electron 应用日志中是否出现鉴权失败或打印投递未回执。

出现打印无响应时，还需确认打印机在线、默认打印机配置存在，并检查现有六模板打印流程。不要通过删除 DPI、边距或逐页等待来绕过问题。
