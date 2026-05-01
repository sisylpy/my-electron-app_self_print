# GrainPrint MCP 服务器

本模块为 GrainPrint 应用提供 MCP（Model Context Protocol）接口，支持通过 WorkBuddy 等 MCP Client 调用配送单打印功能。

## 功能概述

- **获取客户列表**：`get_delivery_customers` - 获取今日有待打印配送单的客户列表
- **预览配送单**：`preview_delivery_order` - 预览指定客户的配送单 HTML 内容
- **确认打印**：`confirm_print_delivery_order` - 确认并打印指定客户的配送单

## 快速开始

### 1. 启动应用

应用启动后会自动启动 MCP HTTP 服务器，默认监听 `http://localhost:3001`。

### 2. 配置 WorkBuddy

在 WorkBuddy 中导入配置文件 `mcp-config-workbuddy.json`：

```json
{
  "mcpServers": {
    "grain-print": {
      "transport": "http",
      "url": "http://localhost:3001"
    }
  }
}
```

### 3. 使用示例

在 WorkBuddy 中使用以下命令：

```javascript
// 1. 获取今日配送单客户列表
await mcp.grain-print.get_delivery_customers();
// 返回：{ customers: [{ id, name, printName, subDepartments: [...] }] }

// 2. 预览指定客户的配送单
await mcp.grain-print.preview_delivery_order({
  department_id: 123  // 部门ID
});
// 返回：{ success, departmentName, orderCount, html }

// 3. 确认打印配送单
await mcp.grain-print.confirm_print_delivery_order({
  department_id: 123
});
// 返回：{ success, message, departmentName, orderCount }
```

## 配置说明

### 修改端口

编辑 `src/mcp-config.json`：

```json
{
  "host": "localhost",
  "port": 3002,  // 修改为其他端口
  "backendUrl": "http://192.168.0.105:8080/nongxinle_war_exploded/api"
}
```

### 后端 API 地址

如果后端 API 地址不同，请修改 `backendUrl`。

## MCP 协议

本服务使用 JSON-RPC 2.0 协议，支持以下方法：

### initialize

初始化连接。

### tools/list

列出所有可用工具。

### tools/call

调用指定工具。

## 注意事项

1. **用户登录**：MCP 调用使用应用内已登录的用户身份
2. **自动登录**：如果应用开启了"记住用户"功能，MCP 可直接使用保存的登录状态
3. **仅 NX 类型**：当前仅支持 NX 类型配送单（不支持 GB 供应商订货单）

## 故障排除

### 连接失败

1. 确认应用已启动
2. 检查端口是否被占用：`lsof -i :3001`
3. 确认防火墙允许访问

### 用户未登录

1. 打开应用并完成登录
2. 开启"记住用户"功能以便下次自动登录

### 打印无响应

1. 确认打印机已连接
2. 检查打印机设置为默认
3. 查看应用日志获取详细错误信息
