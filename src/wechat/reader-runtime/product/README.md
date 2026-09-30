# product/ · 正式产品模块（Electric 唯一允许依赖的边界）

> 建立：2026-09-28（P5）
> **本目录下当前无任何实现代码** —— P5 阶段只定义边界与合同。

## 边界铁律

| 允许 | 禁止 |
|---|---|
| Electric / LLM 依赖 `product/` | Electric 依赖 `research/`、`engineering/`、`p4-*` 下任何实验脚本 |
| 领域对象 + 产品级错误出模块 | 内部标识（wxid / @chatroom / `Msg_<hash>` / 库文件名）出模块 |
| 平台差异写在 `providers/mac|windows` | 上层出现 `if platform ==` 分支 |
| 底层异常在 Driver 内翻译 | 把 `file is not a database` / `sqlite3 error` / `PBKDF2 failed` 抛给上层 |

## 目标结构（待实现）

```
product/
├── WechatLocalDataService          # 唯一入口（8 个方法）
├── domain/
│   ├── WechatAccount.py
│   ├── Conversation.py
│   ├── Participant.py
│   ├── Message.py
│   └── AttachmentRef.py
├── errors/
│   └── codes.py                    # READY / NO_ACCOUNT / … / INTERNAL_ERROR
├── providers/
│   ├── DatabaseAccessProvider.py   # acquireReadOnlyAccess(account) -> 不透明句柄
│   ├── mac/MacWechatDriver.py
│   └── windows/WindowsWechatDriver.py
└── platform/
    ├── EnvironmentDetector.py
    ├── AccountDetector.py
    └── DatabaseLocator.py
```

## 合同出处（实现前必读，不要凭记忆写）

| 内容 | 文件 |
|---|---|
| 服务合同（8 方法 + 通用约束） | `../docs/15-p5-product-contract.md` §2 |
| 领域模型 | 同上 §3 |
| 错误合同（13 码 + 处置决策树） | 同上 §4 |
| Driver 边界与差异矩阵 | 同上 §5 |
| 确定已知事实（参数/路径/表名规则） | `../docs/WECHAT-LOCAL-ACCESS-SSOT.md` |
| **绝对不要重做的实验** | `../docs/DO-NOT-REPEAT.md` |

## 实现前必须知道的三件事

1. **材料作用域 = `(machine, account)`**（A8 结论）→ 缓存键必须是二元组，换账号必须重新获取
2. **不要重新实现底层算法** —— 开库 / KDF / schema 映射已验证成功，直接复用既有实现
3. **未验证组合一律返回 `UNSUPPORTED_WECHAT_VERSION`** —— 禁止按 4.1.15 猜参数
