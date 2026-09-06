# salesAnalysis 模块边界

销售分析是配送商老板端的只读经营分析模块，目标是让老板按时间范围看清商品分布、客户结构，以及每一种商品的重要客户。

- 已注册 `/sales-analysis`、路由名 `SalesAnalysis` 和“经营分析 → 销售分析”菜单；当前仅管理员角色可进入；
- 老版 `boss-mini` 小程序通过 Owner Token 入口 `/api/owner/sales-analysis/**` 使用同一查询服务；小程序同样只允许管理员进入，且不得提交配送商 ID；
- 桌面渲染层通过 `window.electronAPI.salesAnalysis` 的三个只读白名单方法访问，Bearer Token 只保存在 Electron 主进程；
- 分析事实只来自已配送完成并进入 `nx_department_order_history` 的历史订单商品行；当前未完成订单不进入销售额、销售数量、平均单价或客户贡献；
- 展示层级固定为配送商品大类 → 小类 → 具体商品；点击具体商品后从右侧抽屉查看使用客户和重要客户，不得把客户详情重新放回长表格底部；
- 金额读取历史成交小计 `nx_DO_subtotal`，不读取客户当前订货价、商品建议价或采购金额；
- 销售数量优先使用实际配送/计价数量，缺少实际数量时才兼容订货数量；斤、箱、个、瓶等单位分别汇总，不允许强行相加；
- 平均单价使用同单位下的加权平均，即有效成交金额 ÷ 有效销售数量，不对订单单价做简单平均；
- 商品客户按指定商品在统计期内的销售金额降序，右侧抽屉逐家显示金额贡献占比、数量、加权平均单价、订货日数和最近成交日期；
- 具体商品行和右侧商品客户抽屉必须显示商品图片；图片顺序固定为配送商品大图 → 配送商品普通图 → 平台父类图 → 平台商品大图 → 平台商品普通图，只有全部缺失时才使用通用占位图；
- 服务端代码位于 `com.nongxinle.distribute.analytics.sales` 的 API/Application/Persistence 职责下，不得移入销售助手或历史顶层 Controller/Service/DAO/Entity；
- 服务端正式入口为 `/api/desktop-dispatch/v1/sales-analysis/**`，身份从桌面安全会话读取，权限为 `analytics:sales:read`；不得接受页面提交的配送商 ID；
- 老板小程序服务端内部入口为 `/api/sales-analysis/**`，只允许经过 Owner 网关路由并从 `OwnerAuthContext` 读取配送商身份；两个入口必须共用 `SalesAnalysisQueryService`，不得维护两套统计 SQL；
- 商品分类当前按实时配送目录回填，并返回 `CURRENT_CATALOG_FALLBACK`。在历史分类快照完成前，不得把它改写成“历史原始分类”。

详细设计见 [销售分析 V1 设计](./docs/sales-analysis-design-v1.md)，后续决定和修改记录见 [销售分析变更日志](./docs/sales-analysis-change-log.md)。
