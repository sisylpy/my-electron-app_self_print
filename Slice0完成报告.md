# Electron 桌面派单工作台 Slice 0 完成报告

> 项目：农心乐配送商系统  
> Electron 项目：`ai-priter-electic`  
> 项目路径：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic`  
> 完成日期：2026-07-30  
> 实施范围：Electron/Vue 基础结构  
> `nongxinle-server`：本次未修改

## 1. 完成结论

Slice 0 已完成。

本次建立了：

- `print`、`dispatch`、`order`、`map` 四个模块目录；
- 唯一 Vue Router 入口；
- 独立 `/dispatch` 调度路由；
- 保持兼容的 `/bills` 打印路由和 `/print` 别名；
- `dispatch` namespaced Vuex 内存状态边界；
- 三栏工作台占位页面；
- 模块隔离、打印契约和生产构建自动验证。

本次没有实现：

- 派单写操作；
- 路线修改；
- 司机分配；
- 派单接口调用；
- 地图 SDK；
- 订单接口迁移；
- 打印模板迁移；
- `nongxinle-server` 修改。

## 2. 模块目录

新增：

```text
vue/src/modules/
├── STATE_BOUNDARIES.md
├── print/
│   ├── README.md
│   ├── constants.js
│   ├── index.js
│   └── routes.js
├── dispatch/
│   ├── README.md
│   ├── index.js
│   ├── routes.js
│   ├── store/
│   │   └── index.js
│   └── views/
│       └── DispatchWorkbench.vue
├── order/
│   ├── README.md
│   └── index.js
└── map/
    ├── README.md
    └── index.js
```

### 2.1 print

只建立路由和边界说明。

现有实现保持原位：

- 页面：`vue/src/views/Bills.vue`
- 模板：`vue/src/components/Applys/`
- 打印队列：根 Vuex `mcpPrintQueue`
- Electron 打印 IPC：保持不变

没有搬动或改写任何打印模板。

### 2.2 dispatch

已建立：

- `/dispatch` 路由；
- 独立懒加载页面；
- 三栏预留布局；
- Vuex 命名空间；
- 页面快照、选择状态和路线候选草稿的内存槽位。

当前页面明确显示“未开放派单操作”，不调用后端。

### 2.3 order

只建立公开边界。

当前没有：

- 新订单 API；
- 全局订单副本；
- 派单状态推导；
- 对 Bills 的依赖。

### 2.4 map

只建立公开边界。

当前没有：

- 地图 SDK；
- 地图 Key；
- 路线计算；
- 距离/时间推导。

## 3. 路由结构

当前正式路由：

| 路径 | 路由名 | 模块 | 结果 |
|---|---|---|---|
| `/` | `Screen` | core | 保持现有入口 |
| `/home` | `Home` | core | 保持现有登录/扫码 |
| `/bills` | `Bills` | print | 保持现有打印正式入口 |
| `/print` | `Bills` 的 alias | print | 新增可读别名，不创建第二套打印页 |
| `/dispatch` | `DispatchWorkbench` | dispatch | 新增调度基础入口 |

### 3.1 唯一路由实例

整改前：

- `vue/src/main.js` 创建一套实际 Router；
- `vue/src/router/index.js` 还保留另一套不同 Router。

整改后：

- Router 只在 `vue/src/router/index.js` 创建；
- `vue/src/main.js` 只 import 并安装该 Router；
- core、print、dispatch 路由在统一入口组合；
- 现有记住用户自动进入 `Bills` 的规则原样迁移；
- `/dispatch` 不参与记住用户自动重定向。

### 3.2 打印兼容

以下契约保持：

- 路由名仍为 `Bills`；
- 正式路径仍为 `/bills`；
- Home 登录成功仍按名字进入 `Bills`；
- MCP 仍按名字进入 `Bills`；
- Bills 内部清理 MCP query 仍按名字使用 `Bills`。

## 4. Bills 与打印流程检查

### 4.1 普通打印

普通打印仍经过：

```text
Home
  → Bills
  → 现有 Applys 模板
  → preload 白名单打印 API
  → 主进程打印窗口
```

本次未修改：

- `Bills.vue`；
- `components/Applys/*`；
- 纸张规格；
- 分页行数；
- DPI；
- 边距；
- 逐页等待；
- 打印机 Profile。

### 4.2 MCP 打印

MCP 流程仍为：

```text
主进程 IPC
  → App.vue
  → 根 Vuex mcpPrintQueue
  → Bills
  → 现有打印模板
```

已确认：

- MCP 不会进入 `/dispatch`；
- App 中没有 `DispatchWorkbench` 强制跳转；
- Bills 不 import `dispatch`；
- dispatch 不读取或清空 `mcpPrintQueue`；
- dispatch 不调用 `electronAPI`。

### 4.3 当前保留的兼容行为

为了保持现有 MCP 打印能力不变，MCP 任务到达且当前不在 Bills 时，仍会进入 Bills 执行打印。

这意味着：

- 调度不会阻止打印；
- 打印不会被错误送到调度页面；
- 但未来真实调度页面打开后，MCP 任务仍可能暂时切离调度页面。

本 Slice 没有贸然改造为后台打印 Host。正式开放派单操作前，仍需按设计方案完成 `PrintRuntimeHost` 或等效隔离，并做真实打印机回归。

## 5. 状态管理边界

### 5.1 根 Vuex 保持

以下兼容状态继续保留在根：

- `disUser`
- `loading`
- `mcpPrintQueue`
- 现有录单、订单和打印字段

没有移动和改名。

### 5.2 dispatch Vuex

新增：

```text
store.state.dispatch
```

使用：

```text
namespaced: true
```

包含：

- `context`：活动阶段、日期和批次；
- `snapshots`：分派、装车、配送和司机数据的快照槽位；
- `selection`：司机、站点和路线选择；
- `routeDraft`：未来的本地候选草稿。

当前不包含：

- Vuex action；
- HTTP 请求；
- 派单 mutation；
- 司机状态推导；
- localStorage 持久化；
- 页面自动轮询。

### 5.3 允许的 mutation

只有：

- 切换纯界面阶段；
- 更新当前选择；
- 清理选择；
- 重置运行时内存状态。

没有任何 mutation 会把客户改为已分配、把司机改为装车中或推进配送阶段。

## 6. 调度占位页面

`DispatchWorkbench.vue` 只用于证明模块和路由已经独立。

包含三栏预留：

- 左：订单与司机；
- 中：路线工作区；
- 右：地图与详情。

页面没有：

- `fetch`；
- Axios；
- Electron API；
- 派单按钮；
- 路线编辑；
- 司机分配。

“返回打印”是用户主动导航到现有 `Bills`，不是自动跳转。

## 7. 自动验证

新增命令：

```text
npm run test:slice0
npm run test:phase2-slice0
```

完整验证命令：

```text
npm run test:phase2-slice0
```

执行结果：通过。

### 7.1 Slice 0 架构检查

通过项目：

- 四个模块公开入口和边界说明存在；
- main 只使用统一 Router；
- `/bills`、`/print`、`/dispatch` 路由契约正确；
- dispatch 页面独立懒加载；
- 根状态保留 MCP 队列；
- dispatch 使用命名空间；
- dispatch 不持久化；
- dispatch 不包含业务 action；
- MCP 仍只进入 Bills；
- Bills 不依赖 dispatch；
- dispatch 不调用 Electron 打印 API；
- dispatch 不发后端请求。

### 7.2 Phase 1 安全检查

通过。

包括：

- preload 白名单；
- MCP 鉴权和来源限制；
- 无动态脚本执行；
- 系统命令参数化；
- 客户端无长期密钥。

### 7.3 打印契约检查

通过。

确认六套现场模板继续保持：

- 分页行数；
- 1/3、1/2、全张纸尺寸；
- 逐页走纸等待；
- 241 mm 历史兼容宽度；
- 驱动 DPI 策略；
- 系统默认边距；
- 隐藏窗口缩放；
- 多页最后一页保存语义；
- preload 打印 API 名称。

### 7.4 Vue 生产构建

通过：

```text
581 modules transformed
DispatchWorkbench 独立生成 JS/CSS
build completed
```

构建仍有原项目主 bundle 大于 600 kB 的提示，不影响本次构建成功；该问题不属于 Slice 0 的打印隔离范围。

### 7.5 本地界面验证

已验证：

- `http://localhost:3000/#/dispatch` 正常打开；
- 标题和三栏占位结构正常；
- 页面明确显示当前没有派单写操作；
- “返回打印”唯一链接解析为 `#/bills`；
- 页面控制台无错误；
- 没有触发派单或打印操作。

## 8. 文件变更

修改：

- `package.json`
- `vue/src/main.js`
- `vue/src/router/index.js`
- `vue/src/store/index.js`

新增：

- `scripts/slice0-architecture-smoke.js`
- `vue/src/modules/STATE_BOUNDARIES.md`
- `vue/src/modules/print/*`
- `vue/src/modules/dispatch/*`
- `vue/src/modules/order/*`
- `vue/src/modules/map/*`
- `Slice0完成报告.md`

未修改：

- `vue/src/views/Bills.vue`
- `vue/src/components/Applys/*`
- `src/main.js`
- `src/preload.js`
- MCP 服务实现
- OCR/Excel 业务
- `nongxinle-server`

说明：Electron 仓库和 `nongxinle-server` 工作区原本已有其他未提交改动；本次只编辑以上 Slice 0 文件，没有清理或覆盖用户已有改动。

## 9. Slice 0 验收结果

| 验收项 | 结果 |
|---|---|
| 四个模块目录 | 通过 |
| 调度独立路由 | 通过 |
| 打印独立路由 | 通过 |
| Bills 路由兼容 | 通过 |
| MCP 不进入调度页面 | 通过 |
| dispatch 不依赖打印实现 | 通过 |
| dispatch 无业务写操作 | 通过 |
| dispatch 无后端请求 | 通过 |
| Vuex 状态边界 | 通过 |
| 打印契约自动检查 | 通过 |
| Phase 1 安全检查 | 通过 |
| Vue 生产构建 | 通过 |
| 本地调度入口渲染 | 通过 |
| `nongxinle-server` 不修改 | 通过 |

## 10. 下一步建议

下一步进入 Slice 1 前，建议先确认：

1. 激活 `/dispatch` 的正式登录和配送商权限守卫；
2. 冻结 `pageViewModel` 只读样本；
3. 建立 dispatch 只读 API adapter；
4. 实现分派中只读三栏数据；
5. 保持所有写操作继续关闭；
6. 在真实派单功能上线前解决 MCP 切离调度页面的问题。
