# 快速开始

<script setup>
import EncryptionKeyGenerator from '../.vitepress/theme/components/EncryptionKeyGenerator.vue'
</script>

## 1. 创建 `docker-compose.yml`

```yaml
services:
  amail:
    image: sunwuyuan/amail:main
    container_name: amail
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - amail-data:/data
    environment:
      - PORT=3000
      - HOST=0.0.0.0
      - ADMIN_TOKEN=${ADMIN_TOKEN}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - DB_PATH=/data/amail.db
      - LOG_LEVEL=${LOG_LEVEL:-info}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s

volumes:
  amail-data:
```

## 2. 创建 `.env`

```ini
ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=64位hex字符串
LOG_LEVEL=info
```

`ENCRYPTION_KEY`生成：

<EncryptionKeyGenerator />

## 3. 启动

```bash
docker compose up -d
```

## 4. 配置后台

打开 `http://localhost:3000`：

1. 输入 `ADMIN_TOKEN`
2. 添加 SMTP 配置
3. 创建 API Key
4. 复制 API Key 和 SMTP Provider ID

## 5. 使用 Node.js SDK 发信

```bash
npm install @wydev/amail
```

```ts
import { Amail } from '@wydev/amail'

const amail = new Amail('am_your_api_key', {
  baseUrl: 'http://localhost:3000',
  providerId: 'smtp_provider_id',
})

await amail.emails.send({
  from: '示例 <hello@example.com>',
  to: 'user@example.com',
  subject: '你好',
  text: '测试邮件',
})
```
