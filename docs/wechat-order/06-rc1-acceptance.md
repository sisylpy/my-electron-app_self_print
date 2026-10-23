# 微信订单 V2 RC1 验收候选记录

记录日期：2026-10-23（Asia/Shanghai）。本记录标记的是可供用户验收的 RC，
不是所有设备均已通过真机测试的正式稳定版。

## 版本基线

- 桌面端微信订单 V2 完整业务源码 Commit：`33db79aa7abe078cd0ce57403b323c174af361fd`。
- Java 服务端对应 Commit：`1c4a24264f8e75cd7d60c3c00d79b3c0b5b4a56d`。
- RC Tag：`grainprint-wechat-v2-rc1-20261023`。Tag 指向包含本记录的最终提交；
  使用 `git rev-list -n 1 grainprint-wechat-v2-rc1-20261023` 获取最终可恢复 SHA。

桌面端网关与上述 Java 版本的 V2 接口已核对匹配，包括可靠扫描
`commit/begin/batch/finalize`、pending messages/tasks、task claim/draft/discard/ignore、
attachment report 和 mixed-image acknowledgement。Java 仓库本轮只读核对，未提交、
未 Push、未部署。

## 已验证

- 微信订单相关 Node 测试：25/25 个文件通过。
- 消息完整性专项：16/16 通过。
- 图片待补与扫描游标专项：4/4 通过。
- Reader Keyset 分页、450 条边界、图片 locator/资源恢复定向测试：25/25 通过。
- Reader Electron 接口兼容：12/12 通过。
- 可靠扫描网关 200+200+50 与增量领取：2/2 通过。
- Vue production 构建通过；仅有既有 chunk size 提示。
- 客户选择、订单编辑、AI 协助解析、确认与正式保存的交互流程未改变。

## 当前功能范围

- Reader 稳定分页和独立 V2 扫描游标。
- 消息台账、任务领取、草稿/待确认任务恢复与订单保存幂等。
- 图片 deferred、签名 locator、附件状态上报和重启后的服务端台账恢复。
- 单会话、未读与全部绑定客户扫描；自动扫描继续复用同一全面检查流程。
- 混合群图片只提示，不自动生成订单。

## 尚未完成与已知限制

- 尚未完成 Mac 真机完整场景：原图最初不可下载 → 保留待补 → 退出 GrainPrint →
  重启 → 图片可用后恢复 → 正常处理订单。自动化覆盖不能替代该真机验收。
- Windows 完整真机链路尚未验收。
- Java 历史定向测试中的绑定转移两项语义差异仍需单独核实；本轮未修改服务端。
- 当前没有可作为所有设备和数据规模 SLA 的 V2 性能基线。
- `release-1.0.26/` 是本地既有构建产物，不属于本 RC 的 Git 源码内容。

## 下一位 Agent 阅读入口

依次阅读本目录 `README.md`、`01-business-rules.md`、`03-reliability.md`、
`04-testing-and-operations.md` 和 `05-agent-handoff.md`；涉及 Reader 协议时再阅读
`src/wechat/reader-runtime/product/bridge/protocol.md`。
