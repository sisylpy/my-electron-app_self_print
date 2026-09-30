"""Electron → Reader 的进程间桥接层（stdio NDJSON）。

职责边界：
- 只做**协议适配**：stdin 读请求行，stdout 写响应行，交给 WechatLocalDataService。
- 不新增/不改业务语义，不重新发明错误码 —— 原样穿透 product/errors/codes.py 的 13 个产品级错误码。
- 不向上游泄漏：passphrase / DB 路径 / wxid / @chatroom / Msg_<hash> / 表与分片信息。
  领域对象本身已是脱敏形态（ID 为 fp:<hash>），本层再剔除 AttachmentRef.localPath 等可能含路径的字段。

入口：  python -m product.bridge.ndjson_main
"""
