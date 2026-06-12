# Node SDK

推荐应用优先使用 SDK，而不是手写 HTTP 请求。

安装：

```bash
npm install @wydev/amail
```

创建客户端：

```ts
import { Amail } from '@wydev/amail'

const amail = new Amail('am_your_api_key', {
  baseUrl: 'https://mail.example.com',
  providerId: 'smtp_provider_id',
})
```

发送：

```ts
const { data, error } = await amail.emails.send({
  from: '示例 <hello@example.com>',
  to: ['user@example.com'],
  subject: '你好',
  html: '<p>测试邮件</p>',
})

if (error) {
  console.error(error.statusCode, error.name, error.message)
} else {
  console.log(data.id)
}
```

API 错误返回 `{ data, error }`，不会抛异常。缺少 API Key 或 `providerId` 会在请求前抛异常。

## 指定 SMTP

可在初始化时指定，也可单次发送覆盖：

```ts
await amail.emails.send({
  providerId: 'smtp_provider_id',
  from: 'hello@example.com',
  to: 'user@example.com',
  subject: '指定 SMTP',
  text: '测试邮件',
})
```
