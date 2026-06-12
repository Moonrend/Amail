# 项目结构

```txt
packages/
  amail/   SDK
  cli/     CLI
  server/  服务端
docs/      文档站
scripts/   构建和发布脚本
```

## 发信流程

1. 客户端请求 `/emails`
2. 校验 API Key
3. 选择 SMTP 配置
4. 通过连接池发送
5. 写入日志和统计

## 构建资产

`packages/server` 构建后执行：

```bash
node ../../scripts/copy-server-assets.js
```

当前复制：

- `packages/server/src/web`
- `packages/server/src/db/migrations`

新增运行时资产时，改 `scripts/copy-server-assets.js` 的清单。
