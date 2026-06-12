# HTTP API

认证：

```http
Authorization: Bearer am_xxxxxxxxxxxx
```

## 发送

```http
POST /emails
```

```json
{
  "provider_id": "smtp_provider_id",
  "from": "示例 <hello@example.com>",
  "to": ["user@example.com"],
  "subject": "你好",
  "html": "<p>测试邮件</p>"
}
```

`provider_id` 为 SMTP 配置 ID。服务端也兼容旧字段 `provider`。

## 批量发送

```http
POST /emails/batch
```

```json
[
  {
    "provider_id": "smtp_provider_id",
    "from": "hello@example.com",
    "to": "user1@example.com",
    "subject": "你好 1",
    "text": "测试邮件 1"
  },
  {
    "provider_id": "smtp_provider_id",
    "from": "hello@example.com",
    "to": "user2@example.com",
    "subject": "你好 2",
    "text": "测试邮件 2"
  }
]
```

## SMTP 列表

```http
GET /emails/providers
```

## 查询

```http
GET /emails/:id
```

## 邮件列表

```http
GET /emails?limit=10&after=email_id
```

## 取消

```http
POST /emails/:id/cancel
DELETE /emails/:id
```

## 错误

```json
{
  "statusCode": 422,
  "name": "validation_error",
  "message": "provider_id is required"
}
```
