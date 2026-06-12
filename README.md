# Amail

自托管邮件代理网关。应用调用 Amail，Amail 再通过你的 SMTP 服务发信。

## 功能

- Resend 风格 API
- 多 SMTP 配置
- API Key 管理
- 邮件日志和统计
- SMTP 连接池
- Docker 部署
- Node SDK：`@wydev/amail`

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 至少设置：

```ini
ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=64位hex字符串
```

生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

打开 `http://localhost:3000`，添加 SMTP，创建 API Key。

## 发信示例

```bash
curl -X POST http://localhost:3000/emails \
  -H "Authorization: Bearer am_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "smtp_config_id",
    "from": "示例 <onboarding@yourdomain.com>",
    "to": ["user@example.com"],
    "subject": "你好",
    "html": "<p>测试邮件</p>"
  }'
```

## 文档

文档站在 `docs/`：

```bash
npm run docs:dev
npm run docs:build
```

## 许可证

MIT
