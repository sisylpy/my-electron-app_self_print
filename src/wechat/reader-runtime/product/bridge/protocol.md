# Reader NDJSON 协议（stdio）

Electron main 启动本进程，通过 **stdin/stdout 每行一个 JSON** 通信。

## 帧

请求（main → child）：

```jsonc
{"id":"<string>","method":"<name>","params":{...}}
```

响应（child → main）：

```jsonc
{"id":"<string>","ok":true,"result":{...}}
{"id":"<string>","ok":false,"error":{"code":"CONVERSATION_NOT_FOUND","message":"…","retryable":false,"needsReinit":false,"needsUserAction":false,"userAction":null,"diagnosticId":null}}
```

事件（child → main，无 id）：

```jsonc
{"event":"ready","version":"1","platform":"darwin"}
{"event":"log","level":"info","message":"…"}
```

- `stdout` **只允许**出现以上三种行；任何调试输出一律走 `stderr`。
- `id` 由 main 生成并配对；child 原样回传。

## 方法

| method | params | result |
|---|---|---|
| `diagnose` | — | `DiagnoseResult` |
| `listAccounts` | `warmMessages?` | `WechatAccount[]` |
| `findConversation` | `accountId`, `name` | `FindResult{matches,ambiguous}` |
| `getMessages` | `conversationId`, `timeRange?`, `page?` | `PageResult<Message>` |
| `searchMessages` | `conversationId`, `query`, `timeRange?`, `page?` | `PageResult<Message>` |
| `getParticipants` | `conversationId`, `selfOnly?` | `Participant[]` |
| `resolveSender` | `messageId` | `Participant` |
| `ping` | — | `{"ok":true}` |
| `shutdown` | — | `{"ok":true}`（随后进程退出） |

- `timeRange`: `{"start"?: ISO8601, "end"?: ISO8601}`（本地时区）
- `page`: `{"offset"?: int, "limit"?: int}`，默认 `{offset:0, limit:50}`
- `warmMessages`: 仅预热消息分片元数据，不读取消息正文
- `selfOnly`: 只返回当前微信账号身份，供订单过滤快速路径使用

## 错误码

**原样穿透** `product/errors/codes.py` 的 13 个产品级错误码，Electric 侧不再发明一套：

```
READY NO_ACCOUNT WECHAT_NOT_INSTALLED ACCESS_NOT_READY ACCESS_MATERIAL_EXPIRED
UNSUPPORTED_WECHAT_VERSION SCHEMA_UNSUPPORTED CONVERSATION_NOT_FOUND
CONVERSATION_AMBIGUOUS NO_DATA PERMISSION_REQUIRED INTEGRITY_CHECK_FAILED INTERNAL_ERROR
```

未预期异常统一映射为 `INTERNAL_ERROR`，`message` 为通用文案（不含内部细节），
细节只写 child 的 `stderr`，**不回传**给上层。

## 脱敏约束

跨进程返回的对象**不得**包含：passphrase、DB 路径、`wxid_*`、`*@chatroom`、`Msg_<hash>`、
消息表/分片名、附件本地路径（`AttachmentRef.localPath` 已剔除）。
ID 一律为 `fp:<hash>` 指纹；账号 `displayHint` 优先返回只读库中的微信昵称，
昵称不可用时回退为 `wxid_<fp>` 展示形态，始终不返回原始 wxid。
