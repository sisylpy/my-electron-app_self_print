# dispatch 模块边界

Slice 1 提供 `/dispatch` 只读调度工作台：

- 读取分派中、装车中、配送中三个正式 `pageViewModel`；
- 读取司机当班状态及当前任务；
- 以三栏布局展示订单、路线、站点、地图与客户详情；
- 60 秒可见窗口自动刷新，并支持手动只读刷新；
- 所有远程快照只保存在 namespaced Vuex 内存状态。

明确禁止：

- 派单写操作；
- 路线编辑、路线顺序调整；
- 司机分配或当班状态切换；
- 调用 POST、PUT、PATCH、DELETE 接口；
- Electron IPC；
- 本地持久化调度业务快照；
- 在客户端判断可派、推进业务状态或计算路线。

本模块只消费 `nongxinle-server` 的正式 `pageViewModel`、`driverCards` 和
`mapOverview`。服务端返回的 `primaryAction`、`routeEditAction` 等动作字段不会渲染。
