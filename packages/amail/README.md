# @wydev/amail

Amail Node SDK。

## 安装

```bash
npm install @wydev/amail
```

## 使用

```typescript
import { Amail } from '@wydev/amail';

const amail = new Amail('am_your_api_key', {
  baseUrl: 'https://amail.your-domain.com',
  providerId: 'smtp_config_id',
});

const { data, error } = await amail.emails.send({
  from: 'you@your-domain.com',
  to: 'user@example.com',
  subject: '你好',
  html: '<h1>测试邮件</h1>',
});

if (error) {
  console.error(error);
} else {
  console.log('已发送:', data.id);
}
```

## API

### `new Amail(key?, options?)`

创建客户端。

- `key`：API Key，可从 `AMAIL_API_KEY` 读取。
- `options.baseUrl`：服务地址，默认 `http://localhost:3000`。
- `options.userAgent`：自定义 User-Agent。
- `options.providerId`：默认 SMTP Provider ID，可从 `AMAIL_PROVIDER_ID` 读取。

### `amail.emails`

#### `emails.send(payload, options?)`

发送单封邮件。等同 `emails.create()`。

`providerId` 可在初始化时设置，也可单次发送传入。

```typescript
const { data, error } = await amail.emails.send({
  providerId: 'smtp_config_id',
  from: '示例 <sender@domain.com>',
  to: ['user1@example.com', 'user2@example.com'],
  subject: '你好',
  html: '<p>测试邮件</p>',
  text: '测试邮件',
  cc: 'cc@example.com',
  bcc: 'bcc@example.com',
  replyTo: 'reply@example.com',
  headers: { 'X-Trace': 'demo' },
  tags: [{ name: 'type', value: 'test' }],
  scheduledAt: '2024-12-01T12:00:00Z',
}, {
  idempotencyKey: 'unique-key-123',
});
```

#### `emails.get(id)`

查询邮件。

```typescript
const { data, error } = await amail.emails.get('email_id');
```

#### `emails.list(options?)`

分页列表。

```typescript
const { data, error } = await amail.emails.list({ limit: 10 });
const next = await amail.emails.list({ limit: 10, after: data.data[data.data.length - 1].id });
```

#### `emails.cancel(id)`

取消排队或定时邮件。

```typescript
const { data, error } = await amail.emails.cancel('email_id');
```

### `amail.batch`

#### `batch.send(payload, options?)`

批量发送。等同 `batch.create()`。

```typescript
const { data, error } = await amail.batch.send([
  { providerId: 'smtp_config_id', from: 'you@domain.com', to: 'user1@example.com', subject: '你好 1', html: '<p>测试邮件 1</p>' },
  { providerId: 'smtp_config_id', from: 'you@domain.com', to: 'user2@example.com', subject: '你好 2', html: '<p>测试邮件 2</p>' },
]);
```

## 错误

API 错误返回 `{ data, error }`。

```typescript
const { data, error } = await amail.emails.send({ ... });

if (error) {
  console.log(error.statusCode);
  console.log(error.name);
  console.log(error.message);
}
```

## 从 Resend 迁移

```typescript
import { Resend } from 'resend';
const resend = new Resend('re_xxx');

import { Amail } from '@wydev/amail';
const amail = new Amail('am_xxx', { baseUrl: 'https://amail.your-domain.com' });
```

Amail 需要指定 `providerId`。

## 许可证

MIT
