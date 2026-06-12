# 快速开始

## 安装

```bash
npm install
```

## 配置

```bash
cp .env.example .env
```

`.env` 至少设置：

```ini
ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=64位hex字符串
```

生成 `ENCRYPTION_KEY`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 启动

```bash
npm run dev
```

打开 `http://localhost:3000`：

1. 输入 `ADMIN_TOKEN`
2. 添加 SMTP 配置
3. 创建 API Key
4. 调用 API 发信

## 发信

```bash
curl -X POST http://localhost:3000/emails \
  -H "Authorization: Bearer am_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "smtp_provider_id",
    "from": "示例 <hello@example.com>",
    "to": ["user@example.com"],
    "subject": "你好",
    "html": "<p>测试邮件</p>"
  }'
```

响应：

```json
{ "id": "dReS1gNSsHB9xVqDfNHfP" }
```
