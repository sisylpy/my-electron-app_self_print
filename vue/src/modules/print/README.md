# print 模块边界

Slice 0 只建立打印模块的路由和公开边界，不迁移现有打印实现。

现状保持：

- 打印页面仍为 `vue/src/views/Bills.vue`；
- 打印模板仍在 `vue/src/components/Applys/`；
- 正式打印、打印机 Profile、纸型、DPI 和边距策略不变；
- MCP 任务仍进入根 Vuex 的 `mcpPrintQueue`，并由 `Bills` 消费；
- 路由名继续使用 `Bills`，路径继续使用 `/bills`。

`/print` 是 `/bills` 的别名，不是第二套打印流程。

其他模块如需打印，只能在后续通过公开门面调用，不能直接引用 `Applys` 模板或打印队列。
