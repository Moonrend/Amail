---
layout: home

hero:
  name: Amail
  text: 自托管邮件代理网关
  tagline: 用自己的 SMTP 服务提供 Resend 风格 API。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: HTTP API
      link: /api/http

features:
  - title: HTTP API
    details: 发送、批量发送、查询、取消。
  - title: 多 SMTP
    details: 密码、LOGIN、PLAIN、CRAM-MD5、OAuth2。
  - title: 日志统计
    details: SQLite 保存发送记录和每日统计。
  - title: Docker
    details: 单服务运行，挂载 /data 持久化。
---

## 示例

```bash
curl -X POST http://localhost:3000/emails \
  -H "Authorization: Bearer am_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "smtp_provider_id",
    "from": "示例 <hello@example.com>",
    "to": "user@example.com",
    "subject": "你好",
    "text": "测试邮件"
  }'
```

## SDK

```ts
import { Amail } from '@wydev/amail'

const amail = new Amail('am_xxx', {
  baseUrl: 'http://localhost:3000',
  providerId: 'smtp_provider_id',
})

await amail.emails.send({
  from: 'hello@example.com',
  to: 'user@example.com',
  subject: '你好',
  text: '测试邮件',
})
```
