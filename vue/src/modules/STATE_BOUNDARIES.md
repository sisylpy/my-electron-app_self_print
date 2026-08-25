# Electron 渲染端状态边界

## 根状态

为兼容现有流程，以下状态继续保留在根 Vuex：

- `disUser`：当前配送商用户会话；
- `loading`：现有页面全局加载状态；
- `mcpPrintQueue`：MCP 配送单打印 FIFO 队列；
- 现有录单、订单和打印兼容字段。

Slice 0 不移动、不改名这些字段。

## print

打印执行状态暂时继续由 `Bills.vue`、现有打印组件和根 `mcpPrintQueue` 管理。

`dispatch` 不得读取、写入或清空 `mcpPrintQueue`。

## dispatch

`dispatch` 使用 namespaced Vuex 模块，只保存内存状态：

- 工作台阶段和日期/批次上下文；
- 服务端三个阶段的 `pageViewModel` 快照；
- 司机列表和客户地址目录快照；
- 当前司机、客户、站点和路线选择；
- 读取状态、错误和最近更新时间。

远程 action 只允许访问 GET 白名单。禁止写入 `localStorage`，禁止在 mutation 中推导业务
状态，禁止在客户端推进分派、装车和配送阶段。

## order

不建立全局订单副本。Slice 1 的客户目录只用于补充地址，派单状态、订单集合和配送进度
仍以 dispatch `pageViewModel` 为准。

## map

地图视口、选中 marker 等属于临时界面状态；服务端 `mapOverview` 是地图业务数据源。
Slice 1 仅做坐标投影展示，不保存、不生成路线算法结果。
