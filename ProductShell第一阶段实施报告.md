# ProductShell 第一阶段实施报告

## 1. 实施结论

ProductShell 第一阶段已完成。

AI 录单、订单任务、打印中心、配送调度、客户中心和设备设置已接入同一个桌面产品壳层。现有业务能力继续由原组件和原接口提供，本阶段只完成产品结构、导航和基础视觉统一，没有重写订单、打印或调度业务。

## 2. 已完成内容

### 2.1 统一产品壳层

新增：

- `vue/src/app/layout/ProductShell.vue`
- `vue/src/app/layout/ProductSidebar.vue`
- `vue/src/app/layout/ProductHeader.vue`
- `vue/src/app/layout/ProductWorkspace.vue`
- `vue/src/app/navigation/productNavigation.js`
- `vue/src/app/styles/product-tokens.css`

壳层结构：

```text
ProductShell
├── ProductSidebar
├── ProductHeader
└── ProductWorkspace
    └── 当前业务路由
```

统一壳层负责：

- 产品品牌与主导航；
- 当前模块标题和说明；
- 网络、默认打印机和 MCP 的只读状态摘要；
- 配送商身份摘要；
- 业务页面的统一工作区边界。

登录、配送商选择等启动页通过 `route.meta.shell = false` 保持原界面，不强制套入后台产品壳层。

### 2.2 模块入口接入

统一路由已接入：

| 产品入口 | 路由 | 当前实现 |
| --- | --- | --- |
| AI 录单 | `/orders/intake` | 复用 `Bills.vue` 的客户与录单视图 |
| 订单任务 | `/orders/tasks` | 复用 `Bills.vue` 的任务视图 |
| 打印中心 | `/bills`，兼容 `/print` | 继续使用原 `Bills.vue` 打印流程 |
| 配送调度 | `/dispatch` | 使用现有 `DispatchWorkbench.vue` |
| 客户中心 | `/customers` | 复用 `Bills.vue` 的客户与历史订单视图 |
| 设备与设置 | `/settings` | 新增只读运行状态页面 |

新增模块公开边界：

- `vue/src/modules/customer/`
- `vue/src/modules/setting/`
- `vue/src/modules/order/routes.js`

`print`、`order`、`dispatch`、`customer`、`setting` 均通过统一 Router 组合，不在页面中自行创建路由。

### 2.3 Bills 兼容适配

`Bills.vue` 新增轻量路由适配层，只根据路由 `meta.billsView` 选择已有视图：

- `order`：配送单与打印；
- `task`：订单任务；
- `all`：客户、AI 录单和历史订单。

适配层不复制业务逻辑，继续调用原有：

- `switchToOrderCustomers`
- `switchToTaskList`
- `switchToAllCustomers`
- `fetchCustomerList`
- `initAllCustomers`

MCP 打印任务和 `mcpPrint=true` 查询参数保持最高优先级，ProductShell 路由适配不会抢占 MCP 打印消费流程。

原 Bills 内临时增加的“派单工作台”按钮已移除，模块切换统一由 ProductSidebar 完成。

### 2.4 UI 基础统一

以 DispatchWorkbench 的视觉语言建立共享基础：

- 浅灰蓝工作区背景；
- 深绿产品侧栏；
- 白色卡片与细边框；
- 绿色主状态、蓝色设备状态、黄色告警状态；
- 统一圆角、阴影、间距和空状态承载区。

`Bills.vue` 和 `DispatchWorkbench.vue` 的根容器高度由独占窗口的 `100vh` 调整为工作区内的 `100%`，避免嵌入 ProductShell 后产生双层高度和内容裁切。

### 2.5 设备与设置

新增 `/settings` 只读页面，展示：

- 当前默认打印机；
- 系统 DPI 和纸张信息；
- MCP 运行与鉴权状态；
- Electron/浏览器运行环境；
- 应用日志目录入口。

该页面只使用 preload 已有白名单查询能力，不保存打印配置，不修改 MCP 服务。

## 3. 受保护业务边界

本阶段未修改：

- `vue/src/components/Applys/` 打印模板；
- OCR、图片识别、Excel 录入逻辑；
- MCP 服务、MCP 协议和打印投递流程；
- nongxinle-server 业务接口；
- 调度状态机、派单规则和路线规则；
- `PlaceOrder.vue`、`TaskOrder.vue`、`OrderList.vue` 的业务实现。

打印入口继续使用路由名 `Bills`，因此 Home、历史链接和 MCP 打印导航合同保持兼容。

## 4. 验证结果

已通过：

- Vue 生产构建；
- ProductShell 结构检查；
- Slice 0 模块隔离检查；
- Slice 3 调度写合同检查；
- Electron 安全检查；
- 打印合同检查。

打印合同回归确认：

- 六套现场打印模板的分页行数不变；
- 1/3、1/2、全张纸现场尺寸不变；
- 逐页走纸等待参数不变；
- 241 mm 历史兼容宽度不变；
- 正式打印仍由驱动决定 DPI；
- 默认边距策略、缩放 1.0 和末页保存语义不变；
- preload 打印白名单方法保持完整。

实际页面验证：

- `/settings`、`/dispatch`、`/bills`、`/orders/intake` 可在同一壳层内切换；
- 侧栏选中状态和顶部模块信息随路由同步；
- 1280 × 720 视口下页面无横向溢出；
- 打印中心仍加载原 Bills 页面；
- AI 录单仍加载原客户与录单区域；
- 浏览器控制台未发现 ProductShell 运行错误。

本次页面检查只验证产品壳层与导航。调度接口在浏览器预览环境返回的服务端错误不属于本阶段验收，也未据此修改任何业务接口。

## 5. 第一阶段文件清单

主要新增：

- `vue/src/app/**`
- `vue/src/modules/order/routes.js`
- `vue/src/modules/customer/**`
- `vue/src/modules/setting/**`
- `scripts/product-shell-smoke.js`

主要调整：

- `vue/src/App.vue`
- `vue/src/main.js`
- `vue/src/router/index.js`
- `vue/src/modules/print/routes.js`
- `vue/src/modules/dispatch/routes.js`
- `vue/src/modules/dispatch/views/DispatchWorkbench.vue`
- `vue/src/views/Bills.vue`
- `package.json`

## 6. 后续边界

本次不进入第二、第三阶段。

后续再按独立切片拆分：

- `PlaceOrder.vue`
- `TaskOrder.vue`
- `OrderList.vue`

打印专项检查也保留为后续独立阶段，继续遵循“先建立设备合同与回归基线，再调整实现”的原则。
