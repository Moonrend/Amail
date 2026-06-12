# Amail

自托管邮件代理网关，将 SMTP 协议代理为 API 以在任何网络环境下发送邮件。
在GFW环境下，直接使用SMTP协议发信经常会遇到连接超时、握手失败等问题。将Amail部署在境外的服务器上，提供HTTP API供应用调用。
接口风格参考 Resend ，可以直接替换（吧），所以也可以用来减少云服务成本。

> 看那焚尽孤城，寂冷了三生。



# 快速开始
# [文档](https://amail.wuyuan.dev/)




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
