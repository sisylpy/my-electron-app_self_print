# dispatch 模块边界

`/dispatch` 与 Boss 小程序共用服务端 `pageViewModel`、动作合同和业务规则。
桌面端只负责展示、采集确认和转发命令，不在客户端计算路线或推进业务状态。

当前覆盖：

- 分派中、装车中、配送中三个正式页面及地图；
- 司机可派状态、专职/兼职类型；
- 人工调度司机全景、单司机路线编辑、客户锁定和 AI 沙箱重平衡；
- AI 增补统一支持最大工作时长、最晚完成时间、全程道路距离和最多新增客户四项硬约束；
- 沙箱路线使用服务端签发资源和 `SANDBOX_REBALANCE`策略，采用后继续走原 preview/confirm 主链；
- 页面站点列表只表达排序，人工删除只通过 `removedStopKeys + removalCommandId` 表达；
- 分派路线删除最后一家时明确传送空 `stopKeys`和删除命令；
- 装车路线按 REMOTE 合同移除客户，由服务端决定是否物理删除空路线；
- 装车中整条路线更换司机的 preview/confirm 合同；
- 当日时间窗、发车、确认送达和退回待分配；
- 服务端 `primaryAction`、`routeEditAction`、`exceptionAction` 的显式动作分发；
- 60 秒可见窗口自动刷新，远程快照只保存在 namespaced Vuex 内存状态。

安全边界：

- 调度 access token 仅保存在 Electron 主进程安全存储中；
- preload 只暴露冻结的逐项命令，不提供任意 IPC 或网络代理；
- 渲染层不得提交 `disId`、`operatorUserId`、角色或权限；
- 写请求使用服务端桌面权限门禁，涉及版本的路线命令保留并发校验；
- 路线是否可编辑/增补、候选策略、兼职/专职终点都只读取服务端权威字段；
- 距离、时间、Matrix、路线可行性、司机资格和状态迁移全部由服务端决定。

已知边界：Boss 小程序的 `MARK_DELIVERY_EXCEPTION` 仍没有正式异常登记合同，
桌面端只显示明确提示，不把“退回待分配”伪装成通用异常处理。
