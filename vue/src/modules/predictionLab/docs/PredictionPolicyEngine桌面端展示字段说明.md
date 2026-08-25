# Prediction Policy Engine 桌面端展示字段说明

## 1. 数据来源

桌面端不计算策略等级。字段来自冻结的 `prediction-lab-policy-engine-decision-replay/v1` 回放结果，源文件 SHA-256：

`4174879902a3e888fd2d2ab4437d691e79a126fede4c0ff624315abd27eb8ac3`

本次界面体验样本固定为：

- 配送商：56，沛宜配送；
- 客户：120，王永；
- 预测日期：2025-08-23；
- 算法：`V8_REPLENISHMENT_STATE`；
- 推荐事件：28 条，A=5、B=14、C=9。

该日期被选择是因为同一真实饭馆、同一回放日同时包含三个等级，适合验证分组、数量复核和 C 级折叠。它不代表总体模型指标。

## 2. 页面字段

| 页面字段 | 数据字段 | 说明 |
|---|---|---|
| 客户 | `customerLabel` | 展示配送商与饭馆名称 |
| 商品 | `goodsName`、`goodsId`、`unit` | 商品名称、业务 ID 与单位 |
| 推荐等级 | `level` | `LEVEL_A`、`LEVEL_B`、`LEVEL_C`，桌面端只映射中文文案 |
| 可信度 | `trustScorePercent` | Policy Engine 已输出的商品存在性可信分，前端不重算 |
| 推荐原因 | `supportingReasons` | 取策略事件中最多三条正向贡献说明 |
| 人工判断原因 | `riskReasons` | B/C 展示最多两条负向条件贡献，A 暂不展开以降低信息密度 |
| 历史购买次数 | `evidence.fitOccurrences` | 商品画像拟合期出现次数 |
| 上次购买 | `evidence.daysSinceLast` | 预测日距上次购买天数 |
| 典型周期 | `evidence.medianCycleDays` | 商品历史典型采购间隔 |
| 补货状态 | `evidence.state` | 已补货、消耗中、接近补货、超期未补或观察中 |
| 客户近期活跃 | `evidence.recentCustomerActiveDays` | 预测日前 30 天客户有订单天数 |
| 预测数量 | `predictedQuantity`、`unit` | 原 V8 数量，只展示、不修改 |
| 实际订单 | `actualQuantity`、`outcome` | 仅回放模式显示命中、实际数量或当日未购买 |
| 数量确认 | 固定安全文案 | 所有等级均显示“数量仍需人工确认” |

## 3. 等级展示合同

| 等级 | 标题 | 默认行为 | 当前含义 |
|---|---|---|---|
| A | 高可信采购建议 | 展开 | 强推荐，采购员快速人工确认 |
| B | 需要人工确认 | 展开 | 辅助建议，必须人工判断商品与数量 |
| C | 低可信商品 | 折叠 | 默认不主动干扰，但保留摘要与展开审计 |

桌面端不会把 A 级转化为自动下单、自动采购或免确认。C 级也不会从实验数据中删除。

## 4. 精确匹配规则

只有以下字段全部匹配时，冻结等级才能附加到一次在线 V8 回放：

```text
distributerId
+ departmentId
+ predictionDate
+ algorithmVersion = V8_REPLENISHMENT_STATE
+ goodsId
```

非冻结日期、其他算法、漏预测商品和未匹配商品保持原 Prediction Lab 展示，前端不推断 Policy Engine 结果。

