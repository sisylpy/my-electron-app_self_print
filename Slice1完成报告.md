# Slice 1 完成报告

## 1. 结论

Slice 1「只读调度工作台」已完成。

Electron 渲染端现在可通过独立 `/dispatch` 入口读取并展示 `nongxinle-server`
的今日调度数据，覆盖订单、司机、路线、站点、配送进度、地图和客户详情。

本次没有修改 `nongxinle-server`，没有增加派单、路线、司机或配送写接口，也没有
改动打印、Bills、OCR、MCP 打印业务代码。

## 2. 页面能力

### 左侧：订单与司机

- 今日订单：合并展示分派中、装车中、配送中站点；
- 待派订单：展示分派中路线站点和未分配客户；
- 配送中订单：展示服务端配送执行站点；
- 司机列表：展示司机当班状态和当前任务；
- 选择订单或司机后，只改变页面选中状态和查看阶段，不触发后端写操作。

说明：当前服务端的调度合同以“客户站点”为订单展示粒度，桌面端没有自行拆分或
重组商品订单。司机“在线状态”按服务端 `dutyStatus` 当班口径展示，不推断 GPS
在线状态。

### 中间：路线工作区

- 分派中、装车中、配送中三个阶段切换；
- 路线列表、负责司机、路线摘要；
- 客户站点顺序、计划到达、站点状态；
- 服务端返回的路线里程、时长、计划返仓；
- 配送中阶段展示服务端 `deliveryProgressPercent` 和
  `deliveryProgressLine`。

桌面端不计算路线、不调整顺序、不计算距离和进度。

### 右侧：地图与详情

- 复用服务端 `mapOverview` 的仓库、marker、polyline、图例和缺失坐标信息；
- 地图标记可用于只读选择客户；
- 展示客户、地址、商品摘要、配送状态、司机、时间窗和配送时间线；
- 客户地址通过现有客户目录 GET 接口按客户 ID 只读关联。

当前地图是服务端路线坐标概览，不包含新的地图 Key、地图写接口或桌面端路线引擎。
以后如接入现有地图 SDK，只需替换底图渲染层，业务线路仍应来自 `mapOverview`。

## 3. 复用的后端接口

| 用途 | 方法 | 接口 |
|---|---|---|
| 分派中 | GET | `nxdisroutedispatch/dispatch/sandbox/today` |
| 装车中 | GET | `nxdisroutedispatch/dispatch/loading/today` |
| 配送中 | GET | `nxdisroutedispatch/delivery/today` |
| 司机状态 | GET | `nxdisroutedispatch/drivers/available` |
| 客户地址 | GET | `nxdepartment/disGetAllCustomer/{disId}` |

调度 API 模块没有 POST、PUT、PATCH、DELETE 方法，也没有以下写端点：

- 派单确认；
- 司机上下岗；
- 调整路线；
- 发车；
- 完成配送；
- 异常处理写入。

服务端返回的 `primaryAction`、`routeEditAction`、`canConfirm`、
`canToggleDuty` 等动作能力不会被页面渲染。

## 4. 模块与状态实现

### dispatch

- `api/dispatchReadApi.js`：调度 GET 白名单与响应合同校验；
- `services/readModel.js`：将正式 `pageViewModel` 投影为只读展示模型；
- `store/index.js`：保存三个阶段、司机、客户目录的内存快照；
- `components/DispatchLeftPanel.vue`：订单/司机左栏；
- `components/RouteWorkspace.vue`：路线工作区；
- `components/DispatchDetailPanel.vue`：地图/客户详情右栏；
- `views/DispatchWorkbench.vue`：工作台装配、选择联动和刷新生命周期。

### order

- `api/orderReadApi.js`：仅提供客户目录 GET，用于补充地址；
- 不接管 Bills 订单状态，不判断订单是否可派。

### map

- `components/ReadOnlyDispatchMap.vue`：只读绘制服务端 `mapOverview`；
- 不访问地图接口，不计算路线、距离或预计到达。

### 刷新与容错

- 首次进入自动读取；
- 页面可见时每 60 秒刷新；
- 支持手动只读刷新；
- 五类数据独立成功、独立失败；
- 某接口失败时保留最后一次成功快照并标记过期；
- 全部失败时明确显示“读取失败”，不会清空已有工作台；
- 调度远程快照不写入 `localStorage`。

## 5. 隔离性确认

- `/bills` 和 `/print` 仍由原 Bills 页面承载；
- MCP 打印任务仍只导航 Bills；
- dispatch 不读取或清空 `mcpPrintQueue`；
- dispatch 不调用 `window.electronAPI`；
- Bills 不导入 dispatch 模块；
- 打印现场参数、DPI、边距、逐页等待、最后一页保存语义未改变；
- OCR 和录单模块未接入 dispatch 状态。

## 6. 验收结果

执行：

```text
npm run test:phase2-slice1
```

结果：

- Slice 0 架构隔离检查：通过；
- Slice 1 GET 白名单和禁止写操作检查：通过；
- Phase 1 安全检查：通过；
- 打印现场契约回归：通过；
- Vue 生产构建：通过，592 个模块完成转换；
- dispatch 独立懒加载产物约 29.89 kB，gzip 约 9.90 kB。

浏览器级验收：

- 正式接口合同样本可完整渲染三栏工作台；
- 今日、待派、配送中订单筛选正常；
- 司机列表可联动到对应调度阶段和路线；
- 配送进度、站点、地图、地址和商品详情联动正常；
- 断开接口后刷新，失败提示正常且旧数据保留；
- dispatch 页面没有运行错误。

浏览器验收使用的是与当前 Java 服务合同一致的本地只读样本，不是生产数据。
部署前仍应在测试环境使用真实配送商账号完成一次接口联调验收。

## 7. 当前保留边界

Slice 1 仍然不包含：

- 派单写入；
- 选择或修改司机；
- 路线拖拽和保存；
- 装车、发车、送达或异常写入；
- GPS 实时在线判断；
- 地图导航或路线重新计算。

这些能力只有进入后续写操作 Slice，并完成接口权限、幂等、审计和回滚设计后才能开放。
