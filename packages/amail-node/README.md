# amail-node

Official Node.js SDK for [Amail](https://github.com/ZeroCat/Amail) — self-hosted email proxy gateway with Resend-compatible API.

## Installation

```bash
npm install amail-node
```

## Quick Start

```typescript
import { Amail } from 'amail-node';

const amail = new Amail('am_your_api_key', {
  baseUrl: 'https://amail.your-domain.com',
});

// Send an email
const { data, error } = await amail.emails.send({
  from: 'you@your-domain.com',
  to: 'user@example.com',
  subject: 'Hello World',
  html: '<h1>Hello!</h1>',
});

if (error) {
  console.error(error);
} else {
  console.log('Email sent:', data.id);
}
```

## API

### `new Amail(key?, options?)`

Create a new Amail client.

- `key` — API key (starts with `am_`). Falls back to `AMAIL_API_KEY` env var.
- `options.baseUrl` — Amail server URL. Falls back to `AMAIL_BASE_URL` env var, then `http://localhost:4000`.
- `options.userAgent` — Custom User-Agent header.

### `amail.emails`

#### `emails.send(payload, options?)`

Send a single email. Alias for `emails.create()`.

```typescript
const { data, error } = await amail.emails.send({
  from: 'Name <sender@domain.com>',
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Hello',
  html: '<p>Hello World</p>',
  text: 'Hello World',
  cc: 'cc@example.com',
  bcc: 'bcc@example.com',
  replyTo: 'reply@example.com',
  headers: { 'X-Custom': 'value' },
  tags: [{ name: 'category', value: 'welcome' }],
  scheduledAt: '2024-12-01T12:00:00Z',
}, {
  idempotencyKey: 'unique-key-123',
});
```

#### `emails.get(id)`

Get an email by ID.

```typescript
const { data, error } = await amail.emails.get('email_id');
```

#### `emails.list(options?)`

List emails with cursor-based pagination.

```typescript
const { data, error } = await amail.emails.list({ limit: 10 });
// Next page:
const next = await amail.emails.list({ limit: 10, after: data.data[data.data.length - 1].id });
```

#### `emails.cancel(id)`

Cancel a queued or scheduled email.

```typescript
const { data, error } = await amail.emails.cancel('email_id');
```

### `amail.batch`

#### `batch.send(payload, options?)`

Send multiple emails in a single request. Alias for `batch.create()`.

```typescript
const { data, error } = await amail.batch.send([
  { from: 'you@domain.com', to: 'user1@example.com', subject: 'Hello 1', html: '<p>Hi 1</p>' },
  { from: 'you@domain.com', to: 'user2@example.com', subject: 'Hello 2', html: '<p>Hi 2</p>' },
]);
```

## Error Handling

All methods return a `{ data, error }` result type. They never throw on API errors.

```typescript
const { data, error } = await amail.emails.send({ ... });

if (error) {
  console.log(error.statusCode); // 422
  console.log(error.name);       // 'validation_error'
  console.log(error.message);    // 'Invalid from address'
}
```

## Compatibility

This SDK is designed to be a drop-in replacement for the [Resend Node.js SDK](https://github.com/resend/resend-node). If you're migrating from Resend, simply change:

```typescript
// Before
import { Resend } from 'resend';
const resend = new Resend('re_xxx');

// After
import { Amail } from 'amail-node';
const amail = new Amail('am_xxx', { baseUrl: 'https://amail.your-domain.com' });
```

The API surface for `emails.send`, `emails.get`, `emails.list`, `emails.cancel`, and `batch.send` is identical.

## License

MIT
