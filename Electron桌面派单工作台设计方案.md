# Electron 桌面派单工作台设计方案

> 项目：农心乐配送商系统  
> Electron 项目：`ai-priter-electic`  
> 项目路径：`/Users/lpy/Documents/javaWeb/imJava/nongxinle/app/nxl-distributer/ai-priter-electic`  
> 业务后端：`nongxinle-server`  
> 参考前端：`boss-mini`、`driver-mini`  
> 方案日期：2026-07-30  
> 当前阶段：Phase 2 设计  
> 本文只做设计，不修改派单、打印、OCR、Excel 或 MCP 业务代码

## 1. 结论

桌面派单工作台可以在不重写业务规则的前提下建设，当前 `nongxinle-server` 已具备以下主链能力：

- 分派中沙盘；
- 司机列表、司机当班及可派状态；
- 人工选择司机；
- 司机路线编辑、服务端试算和确认；
- 确认后进入装车；
- 装车路线调整；
- 司机发车；
- 配送进度查询；
- 确认送达；
- 站点退回沙盘。

桌面端的定位应当是“调度操作台”，而不是第二套调度引擎：

```text
nongxinle-server
  ├─ 决定哪些订单可派
  ├─ 决定司机是否可派
  ├─ 生成沙盘建议
  ├─ 计算路线、时间窗、距离和风险
  ├─ 校验并确认派单
  └─ 推进装车、发车和配送状态
            │
            ▼
Electron
  ├─ 展示
  ├─ 筛选与选择
  ├─ 提交路线候选顺序
  ├─ 展示服务端试算结果
  ├─ 执行服务端允许的动作
  └─ 刷新和同步页面
```

首版不应宣称已经具备两个能力：

1. **真正实时推送**：当前主链是 HTTP 请求/响应，未发现可直接复用的 WebSocket 或 SSE 派单事件通道。首版应称为“准实时刷新”，采用活动页轮询、动作后立即刷新和窗口恢复刷新。
2. **完整异常中心**：当前可复用“退回沙盘”，但 Boss 配送页的通用 `MARK_DELIVERY_EXCEPTION` 仍显示“功能未接入”。破损、少货、拒收、联系不上、图片凭证等异常登记需要服务端补充正式契约后再开放。

## 2. 设计原则

### 2.1 五条硬边界

1. Electron 不判断订单是否可派。
2. Electron 不判断司机是否可派、是否可下班、是否可发车。
3. Electron 不计算路线、预计到达时间、距离和时间窗冲突。
4. Electron 不根据本地状态直接推进派单阶段。
5. Electron 不直接读写派单数据库，也不通过 IPC 执行派单业务。

### 2.2 服务端驱动

桌面端优先消费服务端正式 `pageViewModel`：

- `pageHeader`：页面标题、阶段、操作提示、进度；
- `topMetrics`：司机数、客户站点数、距离、时长；
- `sections`：司机路线、未分配客户和时间线；
- `availableDrivers`：当前可人工选择且未被路线占用的司机；
- `mapOverview`：仓库、客户标记、路线折线、图例、缺坐标站点；
- `primaryAction`、`routeEditAction`：动作类型、是否允许、禁用原因和动作参数。

客户端可以对字段做显示格式适配，但不能把“无字段”解释成“允许操作”，也不能在服务端禁用动作时自行放开按钮。

### 2.3 打印模块隔离

派单模块不得：

- import `components/Applys` 内的打印模板；
- 修改纸型、分页、边距、DPI、打印机 Profile；
- 复用 `mcpPrintQueue` 保存派单状态；
- 通过打印 IPC 发送派单请求；
- 改变 MCP 任务的去重、确认和打印链路。

如果以后需要从派单页打印配送单，只能调用 `print` 模块公开门面，传入现有打印业务能够识别的订单/客户标识；派单模块不能直接操作模板。

### 2.4 当前契约优先级

接口和行为判断按以下顺序：

1. 当前 `TodayDispatchController`；
2. 当前 Boss/司机端实际调用；
3. 当前 DTO、`pageViewModel` 裁剪契约；
4. 历史交接文档仅作背景。

旧文档中已经删除、改名或后来补齐的接口，不作为桌面实现依据。

## 3. 产品入口与信息架构

### 3.1 应用级导航

登录后进入统一的配送商工作空间，一级功能保持独立：

```text
AI 录单 | 今日订单 | 打印 | 派单工作台
```

建议新增路由：

```text
/dispatch
```

现有路由保持：

```text
/          轮播/入口
/home      登录/扫码
/bills     订单与打印
```

实现前先收敛当前两套路由定义：目前活动路由在 `vue/src/main.js` 内，`vue/src/router/index.js` 还存在另一份不同配置。派单路由只登记在唯一 Router 实例中，使用懒加载，不复制登录恢复逻辑。

### 3.2 派单阶段导航

派单工作台顶部固定三个业务阶段：

```text
分派中 | 装车中 | 配送中
```

对应服务端页面：

| 桌面阶段 | 服务端页面 | 服务端 section |
|---|---|---|
| 分派中 | `dispatch/sandbox/today` | `SUGGESTED_DRIVER_ROUTES`、`UNASSIGNED` |
| 装车中 | `dispatch/loading/today` | `LOADING_DRIVER_ROUTES` |
| 配送中 | `delivery/today` | `EXECUTION_DRIVER_ROUTES` |

顶部同时显示：

- 今日日期；
- 当前批次，首版固定/默认 `MORNING`；
- 页面更新时间；
- 正在刷新、离线、数据可能过期状态；
- 三阶段数量；
- 手动刷新入口。

首版只允许操作“今天”。服务端虽然接受 `routeDate`，但历史日期的可写权限和状态约束应在后端明确后再开放日期切换。

## 4. 页面结构

### 4.1 总体布局

目标分辨率以 1440 × 900 及以上为主，三栏始终保持可用：

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ 模块导航 | 分派中 / 装车中 / 配送中 | 日期·批次 | 更新时间 | 刷新       │
├─────────────────┬────────────────────────────────┬─────────────────────────┤
│ 左侧 300–340 px │ 中间 自适应，最小 620 px       │ 右侧 380–460 px         │
│                 │                                │                         │
│ 今日订单        │ 路线工作区                     │ 地图                    │
│ 未分配订单      │ 客户站点                       │ 客户详情                │
│ 司机列表        │ 派单方案/路线试算              │ 路线时间线              │
│ 司机状态        │                                │                         │
└─────────────────┴────────────────────────────────┴─────────────────────────┘
```

建议最小工作宽度为 1280 px。低于最小宽度时右栏可切为抽屉，但不能把路线工作区压缩成手机式单列。

### 4.2 左侧：订单与司机

左栏采用“订单 / 司机”两个页签，避免信息堆叠。

#### 订单页签

包含：

- 今日客户站点总数；
- 已形成建议路线；
- 未分配；
- 装车中；
- 配送中；
- 已送达；
- 搜索客户名称；
- 按状态、司机、时间窗风险筛选；
- 未分配客户置顶；
- 缺坐标客户单独提示。

这里的“订单”在派单层应以**客户站点/派送任务**为主，不直接把每一条商品行铺在左栏。订单商品行放到右侧详情中。

重要口径：

- 左栏派单数量来源于 `pageViewModel.sections` 和 `mapOverview.summary`；
- 不使用现有打印客户列表反推“未分配”；
- 不通过采购状态猜测配送状态；
- 客户已包含多条订单时，显示服务端 `goodsSummary` 和站点状态。

#### 司机页签

司机卡显示：

- 司机姓名；
- 当班状态；
- 当前阶段；
- 当前客户数；
- 当前路线摘要；
- 是否可派；
- 是否可切换当班；
- 禁用原因；
- 首站时间窗或预计出发；
- 当前异常数量，待后端正式提供。

运行时状态按服务端现有口径显示：

| 状态 | 含义 | 是否可接新站点 |
|---|---|---|
| `OFF_DUTY` | 未上岗/关闭可派 | 否 |
| `IDLE` | 当班且无活动装车/配送路线 | 是 |
| `LOADING` | 装车中 | 否 |
| `EXECUTION`/`IN_DELIVERY` | 配送中 | 否 |

客户端不得自行显示 `COMPLETED`、`SANDBOX`、`CONFIRMED` 为司机当前运行时状态。

`pageViewModel.availableDrivers` 只代表“当前还可人工选择、且未被本次路线占用的司机”，不是全部司机。左栏完整司机状态应调用 `drivers/available` 返回的服务端司机卡，不应只遍历 `availableDrivers`。

### 4.3 中间：路线工作区

中间区域是调度操作的主舞台。

#### 分派中

显示：

- 服务端生成的建议司机路线；
- 每条路线的司机、客户数、总里程、预计时长、出发/返回时间；
- 客户站点顺序；
- 时间窗、预计到达、停留时长；
- 服务端风险提示；
- 未分配客户池；
- “编辑路线”“选择司机”“服务端试算”“确认派单”。

建议路线卡可展开为时间线。选择某条路线后，地图只突出该路线，其他路线降低透明度。

#### 路线编辑

首版采用“单司机路线编辑”，与现有后端契约一致：

1. 打开服务端路线编辑页；
2. 客户端只维护候选 `stopKeys` 顺序；
3. 用户上移、下移、拖动排序或加入服务端允许的站点；
4. 点击“重新试算”；
5. 服务端返回新的时间、距离、风险、地图和 `confirmEnabled`；
6. 只有服务端允许时才能确认；
7. 确认后以服务端返回结果刷新页面。

拖动本身不是路线计算，只是提交候选顺序。未经服务端 preview 的本地排列必须显示“尚未试算”，不能显示为正式预计时间。

首版不提供“把 A 司机站点直接拖到 B 司机并一次性提交”的跨路线原子操作。当前服务端确认契约以单司机路线为单位；跨司机调整应走：

```text
退回沙盘 → 重新选择司机 → 服务端试算 → 确认
```

如未来需要多路线同时拖拽，后端应先提供带版本号的批量原子确认接口。

#### 装车中

显示：

- 装车司机路线；
- 客户站点和订单摘要；
- 时间窗；
- 账单/打印完成情况，只有后端返回正式字段时展示；
- 服务端允许的路线调整；
- 站点退回沙盘；
- 发车动作。

装车中移除站点不是本地删除，必须调用退回沙盘接口。服务端返回 `exitedLoading` 时，桌面应明确提示该路线已经离开装车阶段。

#### 配送中

显示：

- 正在执行的司机路线；
- 已完成/待完成站点；
- 当前选中司机；
- 预计到达；
- 服务端返回的站点动作；
- 确认送达；
- 退回沙盘；
- 异常入口占位。

首版异常入口只有在后端提供可执行动作时才显示。不能把“退回沙盘”包装成所有异常的通用处理。

### 4.4 右侧：地图、客户详情、时间线

右栏上半区为地图，下半区为“客户详情 / 路线时间线”页签。

#### 地图

直接消费 `mapOverview`：

- `depot`：配送商/市场仓库；
- `markers`：客户和未分配客户；
- `polylines`：司机路线；
- `legend`：司机颜色和未分配状态；
- `missingCoordinateStops`：缺坐标站点；
- `centerLat`、`centerLng`、`suggestedScale`：初始视口。

地图只负责：

- 绘制服务端路线；
- 缩放和视口；
- 选中标记；
- 与左、中栏同步；
- 显示缺坐标告警。

地图不得：

- 调用前端路径规划替换服务端路线；
- 根据直线距离重新排序；
- 计算预计到达时间；
- 因地图 SDK 绘制失败而修改服务端派单结果。

当前 `mapOverview.subkey` 和 `layerStyle` 带有小程序地图语义。桌面地图必须建立 `MapAdapter`，把统一业务模型适配到选定的 Web 地图 SDK。地图供应商、Web SDK 授权、Electron 来源限制和 Key 使用方式需要在开发前单独确认，不能直接复制小程序 Key。

#### 客户详情

显示：

- 客户名称、地址、电话；
- 所属司机；
- 站点状态；
- 商品摘要；
- 商品行/数量/单位；
- 时间窗；
- 预计到达和停留时长；
- 缺坐标或地址异常；
- 服务端提供的可执行动作。

现有派单 `pageViewModel` 足够支持站点级摘要，但未形成稳定的“完整订单明细”派单契约。详细商品行可以复用现有订单查询能力，但必须由 `order` 模块适配，且不能用订单接口返回值覆盖派单站点状态。

#### 路线时间线

显示：

- 当前司机路线；
- 站点序号；
- 预计到达/离开；
- 行驶距离/时长；
- 时间窗状态；
- 配送状态；
- 回仓；
- 服务端提供的站点动作。

### 4.5 三栏联动

全页面只保留一个选中上下文：

```text
selectedDriverId
selectedStopKey / deliveryStopId
selectedRouteKey
```

联动规则：

- 点击左侧司机：中间滚动到该路线，地图突出该路线，右侧显示时间线；
- 点击左侧客户：中间定位站点，地图定位标记，右侧显示客户详情；
- 点击地图标记：左侧选中客户，中间定位站点；
- 点击中间站点：地图定位，右侧切到客户详情；
- 切换阶段：清理无效选择，不复用上一阶段的服务端对象。

这些是界面选择规则，不是业务状态规则。

## 5. 核心操作流程

### 5.1 打开工作台

```text
验证当前登录用户
  → 解析 disId / operatorUserId
  → 加载当前阶段 pageViewModel
  → 加载完整司机状态
  → 渲染三栏
  → 启动活动页准实时刷新
```

桌面会话字段使用：

- `disId = disUser.nxDiuDistributerId`
- `operatorUserId = disUser.nxDistributerUserId`

不得复制 Boss 当前 `_session.js` 中固定 `driverUserId: 1` 的临时值。

### 5.2 未分配客户人工派单

```text
选中未分配客户
  → 执行服务端 START_MANUAL_DISPATCH 动作
  → 获取 driver-panorama
  → 展示所有司机及服务端可模拟/禁用原因
  → 选择服务端允许的司机
  → 打开该司机 route-edit/page
  → 调整候选 stopKeys
  → route-edit/preview
  → 展示服务端试算结果
  → route-edit/confirm
  → 根据 enteredLoading / blocked reason 提示
  → 刷新分派、装车和司机状态
```

客户端不能只凭司机是 `IDLE` 就跳过 panorama 或 preview。

### 5.3 确认建议路线

```text
选中建议路线
  → 使用 routeEditAction.payload
  → 服务端编辑页
  → 服务端试算
  → 服务端 confirmEnabled
  → 确认
  → 服务端决定是否 enteredLoading
```

`sandbox/stops/confirm` 可以保留为服务端动作映射的单站确认能力，但桌面主流程优先采用路线编辑/预览/确认，避免客户端逐站拼装整车状态。

### 5.4 装车调整

```text
加载 loading pageViewModel
  → 打开 routeEditAction，sourcePage=LOADING
  → 站点排序仍先 preview
  → 移除站点调用 return-to-sandbox
  → 确认后读取 exitedLoading
  → 刷新 loading / dispatch / drivers
```

### 5.5 发车

当前司机端正式流程为：

```text
driver-terminal/loading/today
  → 读取 showDepartAction / departActionEnabled / planId / driverRouteId
  → drivers/{driverUserId}/depart-now
  → 刷新 loading / delivery / drivers
```

桌面老板代司机发车属于高影响动作。技术接口可复用，但正式开放前必须由服务端确认：

- 当前登录角色有“代发车”权限；
- `disId` 与登录会话一致；
- `operatorUserId` 记录为操作者；
- `driverUserId` 确实属于该配送商；
- 重复提交不会重复推进状态。

如果后端没有完成上述鉴权，桌面只显示发车状态，不开放按钮。

### 5.6 配送执行

```text
delivery/today 全局监控
  → 选中司机时可加载 driver-terminal/delivery/today
  → 按服务端动作确认送达或退回沙盘
  → 使用接口返回 pageViewModel
  → 刷新 delivery / dispatch / drivers
```

老板代司机“确认送达”同样需要角色权限审计。默认策略应是先只读监控，再按权限逐步开放执行。

## 6. 后端接口复用分析

基础路径：

```text
/api/nxdisroutedispatch
```

### 6.1 接口矩阵

| 能力 | 现有接口 | 复用结论 | 桌面用途与注意事项 |
|---|---|---|---|
| 今日分派沙盘 | `GET /dispatch/sandbox/today` | 直接复用 | 分派中主页面；以 `data.pageViewModel` 为正式页面数据 |
| 今日装车 | `GET /dispatch/loading/today` | 直接复用 | 装车中主页面 |
| 今日配送 | `GET /delivery/today` | 直接复用 | 配送中全局监控，可按 `driverUserId` 过滤 |
| 司机基础列表 | `GET /drivers` | 辅助复用 | 只用于基础资料；不能替代状态/可派判断 |
| 司机状态与当班卡 | `GET /drivers/available` | 直接复用 | 虽名为 available，但当前返回完整批次司机卡和服务端状态 |
| 上岗 | `POST /drivers/{driverUserId}/duty/on` | 直接复用 | 只按服务端 `canToggleDuty`/动作权限开放 |
| 下岗 | `POST /drivers/{driverUserId}/duty/off` | 直接复用 | 服务端返回锁定原因，客户端不自行判断 |
| 人工派单司机全景 | `POST /sandbox/manual-dispatch/driver-panorama` | 直接复用 | 展示可模拟、风险确认和禁用司机 |
| 路线编辑页 | `POST /sandbox/driver-route-edit/page` | 直接复用 | 获取当前路线、可加入站点、动作和地图 |
| 路线试算 | `POST /sandbox/driver-route-edit/preview` | 直接复用 | 所有顺序调整必须经过此接口 |
| 路线确认 | `POST /sandbox/driver-route-edit/confirm` | 直接复用 | 服务端确认、刷新计划并决定是否进入装车 |
| 单站确认 | `POST /sandbox/stops/confirm` | 条件复用 | 仅由服务端动作或兼容流程使用，不作为桌面主确认链 |
| 编辑当日时间窗 | `POST /dispatch/sandbox/stops/time-window` | 直接复用 | 分派/装车均可使用；装车时传 `responsePage=LOADING` |
| 站点退回沙盘 | `POST /sandbox/stops/{deliveryStopId}/return-to-sandbox` | 直接复用 | 装车前/装车路线调整 |
| 司机装车终端页 | `GET /driver-terminal/loading/today` | 条件复用 | 获取发车按钮所需正式状态及 `planId`、`driverRouteId` |
| 司机配送终端页 | `GET /driver-terminal/delivery/today` | 条件复用 | 单司机执行详情；老板角色使用前需验权 |
| 发车 | `POST /drivers/{driverUserId}/depart-now` | 条件复用 | 技术链已存在；桌面代发车权限需服务端确认 |
| 确认送达 | `POST /delivery/stops/{deliveryStopId}/complete-now` | 条件复用 | 技术链已存在；桌面代司机执行需权限和审计 |
| 配送中退回沙盘 | `POST /sandbox/stops/{deliveryStopId}/return-to-sandbox-now` | 条件复用 | 作为重新调度动作；必须填写原因 |
| 通用配送异常登记 | 当前无可用正式接口 | 不可直接实现 | Boss 的 `MARK_DELIVERY_EXCEPTION` 仍未接入，需要后端补充 |

### 6.2 订单查询的复用边界

订单查询分为两个目的：

#### 派单视角

直接使用 `dispatch/sandbox/today` 的：

- 建议路线；
- 未分配客户；
- 客户站点；
- `goodsSummary`；
- 服务端生成的动作参数；
- 配送任务状态。

这是派单资格和派单状态的唯一主口径。

#### 订单/打印视角

现有 Electron 使用：

```text
GET /api/nxdepartmentorders/webNxDisGetTodayOrderCustomer/{disId}
```

它继续服务于订单/配送单打印列表，不应被拿来计算沙盘、未分配客户或司机路线。

客户完整商品行可以由 `order` 模块复用现有订单详情接口，但需先形成稳定 DTO，并明确：

- 输入是 `deliveryStopId`、`taskId`、`depFatherId` 还是订单 ID；
- 返回是否包含平台订单；
- 是否只读；
- 当前登录配送商的租户校验；
- 大订单分页；
- 不与派单状态字段互相覆盖。

### 6.3 路线与地图

路线、距离、时间、预计到达和道路折线全部复用后端：

- 主页面 `mapOverview.polylines`；
- 路线编辑 preview 返回的路线和地图；
- 服务端 route sequencer/optimizer；
- 服务端时间窗校验和风险。

桌面地图 SDK 仅做渲染适配，不再调用另一套路线规划得出新的业务答案。

### 6.4 返回值消费规范

统一响应适配：

```text
HTTP 成功
  → 检查 R.code
  → 读取 R.data
  → 页面接口必须存在 data.pageViewModel
  → 动作接口优先使用返回的新 pageViewModel
  → 再刷新受影响的阶段
```

不得：

- 因 `HTTP 200` 就当作业务成功；
- 在缺少 `pageViewModel` 时拼装假数据；
- 继续展示旧成功提示而忽略服务端 `msg`；
- 将未知 `actionType` 当作默认允许动作。

## 7. 服务端能力归属

| 业务问题 | 唯一决策方 | Electron 行为 |
|---|---|---|
| 哪些订单进入今日派单 | `nongxinle-server` | 展示结果 |
| 客户订单如何聚合成站点 | `nongxinle-server` | 展示站点 |
| 司机是否当班 | `nongxinle-server` | 展示/提交切换请求 |
| 司机是否可派 | `DriverDispatchStateService` 等服务端逻辑 | 读取状态和禁用原因 |
| 历史司机偏好 | `nongxinle-server` | 展示建议，不计算 |
| 路线顺序建议 | `nongxinle-server` | 展示；可提交候选顺序 |
| 时间窗冲突 | `nongxinle-server` | 展示风险 |
| 距离和预计时长 | `nongxinle-server` | 展示 |
| 是否可确认 | `pageViewModel.actions.confirmEnabled` | 控制按钮 |
| 是否进入装车 | `nongxinle-server` | 读取 `enteredLoading` |
| 是否可发车 | `nongxinle-server` | 读取允许状态 |
| 是否送达/退回 | `nongxinle-server` | 提交动作并刷新 |

## 8. Electron 模块设计

### 8.1 路径说明

当前项目根目录的 `src/` 是 Electron 主进程/preload 代码，Vue 渲染端位于 `vue/src/`。

因此用户界面的领域模块应放在：

```text
vue/src/modules/
```

不能把 Vue 页面直接放进根目录 `src/modules/`，否则会混淆主进程和渲染进程边界。

### 8.2 目标目录

```text
vue/src/
├── app/
│   ├── router/
│   ├── store/
│   └── shell/
├── modules/
│   ├── print/
│   │   ├── public/
│   │   │   └── printFacade.ts
│   │   └── README.md
│   ├── dispatch/
│   │   ├── api/
│   │   │   └── dispatchApi.ts
│   │   ├── contracts/
│   │   │   ├── pageViewModel.ts
│   │   │   ├── actions.ts
│   │   │   └── requests.ts
│   │   ├── store/
│   │   │   └── dispatchStore.ts
│   │   ├── services/
│   │   │   ├── actionRegistry.ts
│   │   │   ├── dispatchRefresh.ts
│   │   │   └── selectionSync.ts
│   │   ├── views/
│   │   │   └── DispatchWorkbench.vue
│   │   ├── components/
│   │   │   ├── DispatchHeader.vue
│   │   │   ├── DispatchLeftPanel.vue
│   │   │   ├── RouteWorkspace.vue
│   │   │   ├── DriverRouteCard.vue
│   │   │   ├── RouteEditor.vue
│   │   │   ├── CustomerStopCard.vue
│   │   │   └── DispatchRightPanel.vue
│   │   └── routes.ts
│   ├── order/
│   │   ├── api/
│   │   ├── contracts/
│   │   ├── store/
│   │   └── components/
│   │       └── OrderDetailPanel.vue
│   └── map/
│       ├── adapters/
│       │   └── mapAdapter.ts
│       ├── components/
│       │   └── DispatchMap.vue
│       └── contracts/
│           └── mapOverview.ts
└── legacy/
    └── （只作为逐步迁移概念，不在 Phase 2 首批移动现有文件）
```

### 8.3 `dispatch` 模块

负责：

- 三阶段工作台；
- 派单 HTTP API；
- 服务端 `pageViewModel` 契约；
- 司机状态；
- 路线编辑候选稿；
- 服务端动作注册；
- 刷新与并发请求治理；
- 三栏选择同步。

不负责：

- 订单商品编辑；
- 打印模板；
- OCR；
- 地图路线计算；
- Electron IPC；
- 系统命令。

### 8.4 `order` 模块

负责：

- 客户订单详情；
- 商品行只读展示；
- 订单编号和客户信息适配；
- 为打印和派单提供稳定的只读查询接口。

`dispatch` 只能通过 `order` 模块公开接口读取订单详情，不能直接 import 当前 `Bills.vue` 的方法。

### 8.5 `map` 模块

负责：

- Web 地图 SDK 生命周期；
- `mapOverview` 字段适配；
- marker/polyline 绘制；
- 选中、定位、视口和错误降级；
- 地图 Key 的公开客户端配置和来源限制。

不负责路线规划和司机状态。

### 8.6 `print` 模块

Phase 2 不移动现有 `components/Applys` 打印模板。

`print` 目录首期只定义公开门面和边界：

- 打印配送单；
- 查询打印任务状态；
- 现有打印机 Profile；
- MCP 打印任务协调。

后续如迁移现有打印组件，必须另立打印专项并执行真实打印机回归，不能作为派单开发的附带重构。

### 8.7 主进程和 preload

派单主链是普通受鉴权 HTTPS 请求，原则上由渲染端现有网络层访问后端，不新增派单 IPC。

只有以下情况才允许新增主进程能力：

- Electron 窗口生命周期；
- 系统级通知；
- 经过白名单的安全存储；
- 地图 SDK 确有 Electron 主进程要求。

即使新增，也只能提供基础能力，不能把派单规则搬到主进程。

## 9. 请求层设计

当前渲染端同时存在：

- `vue/src/api/axios.js`；
- `vue/src/utils/request.js`。

两者的 baseURL、返回值解包和全局 loading 行为不同。派单模块不能再新增第三种无规范请求方式。

建议：

1. 以现有登录 Cookie 和统一 baseURL 为基础；
2. 建立一个应用级 HTTP client；
3. 在 `dispatchApi` 内只声明接口；
4. `R.code !== 0` 统一转为业务错误；
5. 401/403 清理会话并回登录；
6. 网络错误、业务错误、契约错误分开；
7. 静默刷新不触发全屏 loading；
8. 操作请求使用按钮级 loading；
9. 记录接口、阶段、耗时和错误码，不记录完整订单和手机号。

### 9.1 Action Registry

服务端动作统一交给白名单注册表：

| Action Type | 桌面行为 |
|---|---|
| `STATUS_ONLY` | 只展示，不提交 |
| `VIEW_ROUTE` | 定位路线 |
| `START_MANUAL_DISPATCH` | 打开司机全景 |
| `SIMULATE_MANUAL_DISPATCH` | 打开路线编辑/试算 |
| `OPEN_DRIVER_ROUTE_EDIT` | 打开路线编辑 |
| `EDIT_TODAY_TIME_WINDOW` | 打开时间窗表单并提交服务端 |
| `GO_LOADING` | 切换到装车阶段 |
| `TOGGLE_DUTY_ON/OFF` | 二次确认后调用当班接口 |
| `RETURN_TO_DISPATCH` | 按服务端 payload 执行或引导回分派 |
| `RETURN_TO_SANDBOX` | 二次确认并填写原因 |
| `MARK_DELIVERY_EXCEPTION` | 后端未接入前禁用 |

未知 action：

- 不执行；
- 显示“当前客户端暂不支持该操作”；
- 记录 actionType 和契约版本；
- 不降级成其他写操作。

## 10. 状态管理设计

### 10.1 状态分层

#### 服务端快照

```text
dispatchPageViewModel
loadingPageViewModel
deliveryPageViewModel
driverListPageData
```

快照只保存在内存，不写入 `localStorage`。

#### 工作台上下文

```text
routeDate
batchCode
activePhase
lastUpdatedAt
connectionState
```

#### 纯界面状态

```text
selectedDriverId
selectedStopKey
selectedRouteKey
leftTab
rightTab
filters
mapViewport
expandedRouteKeys
```

#### 路线编辑草稿

```text
driverUserId
sourcePage
stopKeys
dirty
previewing
previewPageViewModel
serverConfirmEnabled
serverConfirmDisabledReason
```

草稿只是用户输入，不是派单结果。

#### 请求状态

```text
loadingByScope
errorByScope
requestSequence
pendingActionKeys
lastSuccessfulRefreshAt
```

### 10.2 Vuex 策略

现项目使用 Vuex 4。Phase 2 首版采用 namespaced module，避免同时迁移状态库：

```text
store.registerModule('dispatch', dispatchStore)
```

不建议为了派单单独引入 Pinia，除非应用整体已经批准迁移。

### 10.3 不做乐观业务推进

允许的本地即时变化：

- 当前选中项；
- 路线候选顺序；
- 面板展开；
- 地图视口；
- 筛选条件。

不允许的乐观变化：

- 将客户本地标记为已分配；
- 将司机本地标记为装车中；
- 将路线本地标记为已发车；
- 将站点本地标记为已送达；
- 客户端自行减少未分配数量。

所有业务状态以服务端成功响应替换。

### 10.4 刷新策略

首版准实时策略：

- 活动阶段每 10 秒静默刷新；
- 非活动阶段不轮询；
- 窗口重新获得焦点时立即刷新；
- 网络恢复时立即刷新；
- 所有成功写操作后立即刷新受影响阶段；
- 写操作失败不覆盖现有快照；
- 路线编辑存在未保存草稿时，不自动覆盖编辑页，只提示“后台数据有更新，请重新试算”。

如果服务端性能测试不能支撑 10 秒间隔，应按配送商活跃规模调整为 15–30 秒，并优先建设 SSE/WebSocket 事件通道。

### 10.5 请求并发

- GET 使用递增 request sequence 或 AbortController，只接收最后一次结果；
- 同一司机/站点写操作串行；
- 按钮提交后立即禁用；
- 阶段切换时取消无关请求；
- 写成功后先应用服务端返回值，再补一次刷新；
- 超时不能显示“可能成功”，必须提示用户刷新确认状态。

### 10.6 多终端并发缺口

当前 compute 内部已有 `orderVersion`、`sandboxVersion`、`dutyVersion` 概念，但正式页面契约和写请求未形成统一的乐观锁字段。

生产级多终端调度建议后端后续增加：

- 页面 `revision`；
- 写请求 `expectedRevision`；
- `requestId`/幂等键；
- 冲突返回 409 和最新摘要；
- 操作者和操作时间；
- 关键动作审计记录。

在后端补齐前，桌面需要：

- 确认前强制 preview；
- 关键动作前展示当前更新时间；
- 成功/超时后立即刷新；
- 检测到变化时要求用户重新确认；
- 不缓存可跨重启恢复的路线草稿。

## 11. 与现有打印、OCR、Excel、MCP 的共存

### 11.1 功能边界

| 模块 | 派单可调用 | 派单不可修改 |
|---|---|---|
| 订单 | 只读客户/商品详情 | 录单和价格业务规则 |
| 打印 | 公开打印门面 | 模板、DPI、纸型、边距、Profile |
| OCR | 无直接依赖 | OCR 上传、识别、裁剪流程 |
| Excel | 无直接依赖 | 导入、粘贴、任务还原 |
| MCP | 可显示打印任务状态 | 鉴权、队列、去重、打印回执 |

### 11.2 MCP 路由冲突

当前 MCP 打印任务由 `App.vue` 接收后可能导航到 `Bills` 执行。派单工作台上线后，如果仍按当前方式处理，正在调度的用户可能被强制离开 `/dispatch`。

这是 Phase 2 的上线阻断项之一。

推荐目标：

- MCP 任务由应用根级 `PrintRuntimeHost` 协调；
- 继续使用现有 Bills/Apply 打印模板和队列；
- 不切换当前可见业务路由；
- 派单页只显示非阻塞通知；
- 打印失败可跳转到打印模块人工处理；
- 不建立第二套 MCP 打印引擎。

在该隔离没有通过回归前，不能默认在“派单工作台正在操作”时后台触发可能改变路由的 MCP 打印。

## 12. 错误、空态与降级

### 12.1 空态

- 没有今日订单：显示“暂无可派客户”，不显示空白地图；
- 有订单但无当班司机：显示服务端原因和当班入口；
- 有未分配客户：置顶显示数量和原因；
- 全部进入装车：分派页显示已进入装车的说明；
- 没有配送中路线：显示“暂无配送路线”。

### 12.2 地图降级

- 地图 SDK 加载失败：列表和时间线继续可用；
- 客户缺坐标：显示 `missingCoordinateStops`，不静默丢失客户；
- 路线折线为空：不自行计算直线替代正式路线；
- Key 无效：记录配置错误并显示非阻断提示。

### 12.3 网络错误

- 首次加载失败：页面级错误和重试；
- 静默刷新失败：保留旧数据并标红更新时间；
- 写操作失败：保留草稿，允许重新试算；
- 401/403：退出工作台并要求重新登录；
- 业务冲突：展示服务端原始可读信息并强制刷新。

## 13. 权限与审计

服务端必须以登录会话为准校验：

- 当前用户是否属于 `disId`；
- 当前用户是否有调度权限；
- 司机是否属于当前配送商；
- 订单/站点是否属于当前配送商；
- 老板是否可以代司机发车；
- 老板是否可以代司机确认送达；
- 是否允许调整装车中路线；
- 是否允许修改时间窗。

客户端提交的 `disId`、`operatorUserId` 和 `driverUserId` 都不能被后端直接信任。

审计至少记录：

- 操作者；
- 配送商；
- 动作类型；
- 司机；
- 站点；
- 变更前后路线；
- 原因；
- 服务端时间；
- 请求 ID；
- 结果。

## 14. 开发切片

每个切片可以独立验收和回退，不做一次性大开发。

### Slice 0：契约冻结与共存门禁

范围：

- 固化当前 Controller 接口清单；
- 保存分派、装车、配送、司机状态、路线编辑的真实响应样本；
- 定义 TypeScript 契约；
- 明确老板代发车/代送达权限；
- 明确地图供应商和 Web SDK；
- 设计 MCP 不打断派单路由的方案；
- 不开发业务页面。

验收：

- 当前 Boss 主链与桌面接口矩阵逐项对应；
- 所有写接口有负责人和权限结论；
- `pageViewModel` 契约测试样本可重复；
- 异常功能缺口有明确后端任务；
- 打印、OCR、Excel、MCP 基线测试仍通过。

### Slice 1：只读工作台骨架

范围：

- 唯一路由入口；
- 三阶段顶部导航；
- 三栏布局；
- 分派中 `pageViewModel` 只读展示；
- 司机状态只读展示；
- 手动刷新、空态和错误态。

不包含：

- 派单确认；
- 路线编辑；
- 发车；
- 配送写操作。

验收：

- 与 Boss 同一账号、同一时刻的路线、未分配客户和司机状态一致；
- 1440 × 900 下三栏无横向业务内容丢失；
- 不触发任何写接口；
- 进入/退出派单页不影响打印和 MCP 队列。

### Slice 2：地图与三栏联动

范围：

- `MapAdapter`；
- marker/polyline；
- 路线高亮；
- 客户和司机选中联动；
- 缺坐标提示；
- 地图错误降级。

验收：

- 地图路线数量、客户数量和服务端 summary 一致；
- 不发起前端路线规划；
- 地图失败时仍可完成列表查看；
- 小程序 Map 数据与桌面 Map 数据语义一致。

### Slice 3：人工派单与路线试算

范围：

- 未分配客户选择；
- driver panorama；
- 单司机路线编辑；
- 本地候选 `stopKeys`；
- 服务端 preview；
- 服务端风险和禁用原因。

不包含最终确认。

验收：

- 不可派司机无法被选择；
- 未 preview 的草稿不能显示为正式路线；
- preview 的距离、时间、风险和 Boss 一致；
- 未知 actionType 不执行；
- 刷新不会静默覆盖草稿。

### Slice 4：确认派单并进入装车

范围：

- route edit confirm；
- 二次确认；
- `enteredLoading`、`enterLoadingBlockedReason`；
- 分派/装车/司机状态联动刷新；
- 防重复提交。

验收：

- Electron 不直接修改状态；
- 同一操作快速连点只发出一个有效请求；
- 服务端拒绝时不改变本地业务状态；
- 确认结果与 Boss 一致；
- 操作后分派和装车数量一致。

### Slice 5：装车工作台

范围：

- 装车路线；
- 装车时间线；
- 时间窗修改；
- 装车路线编辑；
- 站点退回沙盘；
- 订单详情只读。

验收：

- 装车移除必须走服务端；
- `exitedLoading` 正确处理；
- 退回站点重新出现在分派中；
- 不修改打印模板；
- 订单详情失败不阻塞路线查看。

### Slice 6：发车

范围：

- 加载司机终端装车页；
- 读取服务端发车状态；
- 老板代发车权限；
- 发车确认；
- loading → delivery 刷新。

验收：

- 无权限、无站点、司机不匹配时不可发车；
- 发车动作有审计；
- 重复点击不重复推进；
- 发车后装车页消失、配送页出现；
- 司机端与桌面端看到的状态一致。

### Slice 7：配送监控与有限执行

范围：

- 配送全局监控；
- 单司机时间线；
- 确认送达；
- 配送中退回沙盘；
- 按权限逐步开放。

验收：

- 只读角色没有执行按钮；
- 送达后站点进度和统计刷新；
- 退回后站点进入沙盘；
- 操作者、司机、原因可审计；
- 不把“退回沙盘”当作通用异常登记。

### Slice 8：异常中心

前置条件：

- 后端提供正式异常类型、原因、图片/附件、处理状态、恢复动作和审计接口；
- `MARK_DELIVERY_EXCEPTION` 形成可执行契约。

范围：

- 异常登记；
- 异常列表；
- 责任人/处理状态；
- 重新派单或关闭异常；
- 图片凭证。

验收：

- 异常状态完全由服务端推进；
- 所有动作有权限和审计；
- 异常不会被普通刷新丢失；
- 与司机端异常状态一致。

### Slice 9：准实时、并发与灰度

范围：

- 活动页轮询；
- 焦点/网络恢复刷新；
- 多终端冲突提示；
- 服务端 revision/幂等支持；
- 功能开关；
- 指定配送商灰度；
- 性能和稳定性测试。

验收：

- 500+ 客户站点下交互可用；
- 轮询不会叠加请求；
- 多终端修改不会静默互相覆盖；
- 工作台连续运行 8 小时无明显内存增长；
- MCP 打印不强制切走派单路由；
- 打印、OCR、Excel 和 MCP 回归全部通过。

## 15. 测试策略

### 15.1 契约测试

至少冻结：

- 分派空数据；
- 有建议路线；
- 有未分配客户；
- 无当班司机；
- 装车中；
- 配送中；
- 缺坐标；
- 时间窗风险；
- route edit page；
- route edit preview；
- confirm enabled/disabled；
- enteredLoading/exitedLoading；
- 服务端业务错误。

### 15.2 组件测试

- 左、中、右选择联动；
- 路线草稿与 preview 状态；
- action 白名单；
- 禁用原因；
- 静默刷新；
- 地图降级；
- 订单详情失败；
- 未知契约字段。

### 15.3 端到端测试

```text
未分配客户
  → 选择司机
  → 调整顺序
  → 服务端试算
  → 确认
  → 装车
  → 发车
  → 送达
```

以及：

```text
装车中移除
  → 回到沙盘
  → 重新派单
```

### 15.4 非回归

每个可发布切片都必须执行：

- 登录；
- AI 录单；
- OCR；
- Excel 导入/粘贴；
- 普通配送单打印；
- 三种纸型和现有打印 Profile；
- MCP 查询和 MCP 打印；
- 安全测试；
- 打印契约测试。

## 16. 风险清单

| 优先级 | 风险 | 影响 | 控制措施 |
|---|---|---|---|
| P0 | 客户端误写派单规则 | 与 Boss/服务端结果分叉 | 只消费 pageViewModel 和服务端动作 |
| P0 | MCP 打印切换当前路由 | 调度操作中断、草稿丢失 | 根级 PrintRuntimeHost；上线前专项回归 |
| P0 | 老板代司机动作未鉴权 | 越权发车/送达 | 服务端角色、租户和审计门禁 |
| P0 | 多终端并发无版本控制 | 路线互相覆盖 | preview、刷新、revision、幂等键 |
| P1 | 把打印客户列表当派单订单源 | 订单数量和状态错误 | 派单只认 todaydispatch pageViewModel |
| P1 | 地图 SDK 自行算路 | 桌面与服务端路线不一致 | MapAdapter 只绘制后端数据 |
| P1 | 通用异常接口缺失 | 无法完成异常闭环 | Slice 8 等待后端正式接口 |
| P1 | 轮询压力 | 服务端负载增加 | 活动页单轮询、取消旧请求、压测 |
| P1 | 当前 Vue 大文件和双请求层继续扩散 | 难以维护 | 新模块 TypeScript、统一 client、独立 store |
| P2 | 小程序 Map 字段直接复制 | Web SDK 不兼容 | 建立桌面 MapAdapter |

## 17. 开发前必须确认的四项

1. **角色权限**：老板桌面端是否可以代司机发车、确认送达、退回沙盘。
2. **地图方案**：使用哪一个 Web 地图 SDK，Electron 来源和 Key 如何限制。
3. **异常范围**：首版是否只做退回沙盘，还是等待完整异常接口后统一上线。
4. **并发契约**：是否在桌面写操作开放前增加 revision 和幂等键。

## 18. 推荐实施顺序

```text
契约冻结与权限确认
  → 只读三栏工作台
  → 地图联动
  → 人工派单与服务端试算
  → 确认派单
  → 装车
  → 发车
  → 配送监控
  → 有权限的配送执行
  → 异常中心
  → 实时通道与灰度
```

不建议在第一个版本同时实现分派、装车、发车、配送、异常和打印联动。

## 19. 最终验收口径

桌面派单工作台达到可上线状态，至少满足：

- 与 Boss 对同一服务端数据的阶段、司机、站点、路线和动作一致；
- Electron 没有派单规则、路线算法和司机状态判断；
- 所有业务写操作由服务端校验并有审计；
- 路线调整必须经过服务端 preview 和 confirm；
- 地图只展示服务端路线；
- 多终端冲突不会静默覆盖；
- MCP 打印不会打断正在进行的派单操作；
- 打印、OCR、Excel 和 MCP 无回归；
- 通用异常未接入时明确标识，不制造假闭环；
- 具备配送商级功能开关和可回退方案。

---

## 附录 A：本次设计核对的主要代码

Electron：

- `vue/src/main.js`
- `vue/src/router/index.js`
- `vue/src/store/index.js`
- `vue/src/api/axios.js`
- `vue/src/utils/request.js`
- `vue/src/api/orderCustomer.js`
- `vue/src/App.vue`
- `vue/src/views/Bills.vue`

Boss：

- `boss-mini/lib/apiRouteDispatch.js`
- `boss-mini/subPackage-routeDispatch/pages/bossTab/sandbox/sandbox.js`
- `boss-mini/subPackage-routeDispatch/pages/bossTab/myLoading/myLoading.js`
- `boss-mini/subPackage-routeDispatch/pages/bossTab/myDelivery/myDelivery.js`
- `boss-mini/subPackage-routeDispatch/pages/routeDispatch/manualDispatchDrivers/manualDispatchDrivers.js`
- `boss-mini/subPackage-routeDispatch/pages/routeDispatch/driverRouteEdit/driverRouteEdit.js`
- `boss-mini/subPackage-routeDispatch/pages/routeDispatch/duty/duty.js`

司机端：

- `driver-mini/lib/apiRouteDispatch.js`
- `driver-mini/lib/driverDeliveryActions.js`
- `driver-mini/pages/loading/index/index.js`
- `driver-mini/pages/delivery/index/index.js`

服务端：

- `dispatch/controller/TodayDispatchController.java`
- `todaydispatch/TodayDispatchFacade.java`
- `todaydispatch/DispatchPageAssembler.java`
- `route/DisRouteSandboxTodayViewModelMaps.java`
- `todaydispatch/DriverDispatchStateService.java`
- `todaydispatch/TodayDispatchRouteEditService.java`
- `todaydispatch/TodayDispatchRouteConfirmService.java`
- `todaydispatch/DriverTerminalPageAssembler.java`
- `dto/route/*Request.java`
