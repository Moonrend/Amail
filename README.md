# Amail — 邮件代理网关

自托管的邮件代理网关服务，提供 **Resend 兼容 API**，内部通过 SMTP 发送邮件。

## 特性

- **Resend 完全兼容 API** — 替换 `https://api.resend.com` 为你的 Amail 地址即可迁移
- **多 SMTP 配置** — 支持多个 SMTP 服务器，按优先级负载均衡
- **多种认证方式** — 密码、LOGIN、PLAIN、CRAM-MD5、**OAuth2** (Microsoft/Google/自定义)
- **API Key 管理** — 创建、禁用、删除 API Key，独立速率限制
- **邮件日志** — 完整的发送记录，支持状态过滤和分页
- **数据统计** — 发送量趋势、成功率、SMTP 使用率
- **幂等发送** — 支持 `Idempotency-Key` Header 防止重复发送
- **敏感数据加密** — SMTP 密码和 OAuth2 Token 使用 AES-256-GCM 加密存储
- **极简前端** — 内嵌管理界面，零构建依赖
- **自托管友好** — SQLite 存储，单进程运行，Docker 支持

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PORT=3000
ADMIN_TOKEN=your-secure-admin-token
ENCRYPTION_KEY=<64位hex字符串，用以下命令生成>
```

生成加密密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 启动

```bash
# 开发模式 (热重载)
npm run dev

# 生产模式
npm run build
npm start
```

### 4. 使用

1. 打开 `http://localhost:3000` 进入管理界面
2. 输入 Admin Token 连接
3. 添加 SMTP 配置并测试连接
4. 创建 API Key
5. 使用 API 发送邮件

## API 文档

### 认证

所有 API 请求需要 Bearer Token：

```
Authorization: Bearer am_xxxxxxxxxxxx
```

### 发送邮件

```bash
curl -X POST http://localhost:3000/emails \
  -H "Authorization: Bearer am_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <onboarding@yourdomain.com>",
    "to": ["user@example.com"],
    "subject": "Hello World",
    "html": "<p>It works!</p>"
  }'
```

响应：
```json
{ "id": "dReS1gNSsHB9xVqDfNHfP" }
```

### 批量发送

```bash
curl -X POST http://localhost:3000/emails/batch \
  -H "Authorization: Bearer am_your_api_key" \
  -H "Content-Type: application/json" \
  -d '[
    {"from": "a@domain.com", "to": ["user1@example.com"], "subject": "Hi", "html": "<p>1</p>"},
    {"from": "a@domain.com", "to": ["user2@example.com"], "subject": "Hi", "html": "<p>2</p>"} 
  ]'
```

### 查询邮件状态

```bash
curl http://localhost:3000/emails/dReS1gNSsHB9xVqDfNHfP \
  -H "Authorization: Bearer am_your_api_key"
```

### 取消定时邮件

```bash
curl -X DELETE http://localhost:3000/emails/dReS1gNSsHB9xVqDfNHfP \
  -H "Authorization: Bearer am_your_api_key"
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| from | string | ✅ | 发件人，支持 `"Name <email>"` 格式 |
| to | string \| string[] | ✅ | 收件人，数组最多 50 个 |
| subject | string | ✅ | 主题 |
| html | string | | HTML 正文 |
| text | string | | 纯文本正文 |
| cc | string \| string[] | | 抄送 |
| bcc | string \| string[] | | 密送 |
| reply_to | string \| string[] | | 回复地址 |
| headers | object | | 自定义邮件头 |
| tags | array | | 标签 `[{name, value}]` |
| attachments | array | | 附件 `[{content, filename, content_type}]` |
| scheduled_at | string | | 定时发送 (ISO 8601) |

### 错误响应

```json
{
  "statusCode": 422,
  "name": "validation_error",
  "message": "Invalid `from` field"
}
```

兼容 Resend 的错误格式，状态码：400/401/403/404/422/429/500。

## SMTP 认证方式

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| password | 用户名+密码 | 大多数 SMTP 服务器 |
| login | LOGIN 认证 | 部分旧服务器 |
| plain | PLAIN 认证 | 基础 SMTP |
| cram-md5 | CRAM-MD5 挑战-响应 | 安全认证 |
| oauth2 | OAuth2 授权码流 | **Gmail, Outlook, Azure AD** |

### OAuth2 配置

**Gmail:**
1. 在 Google Cloud Console 创建 OAuth2 凭据
2. 获取 Client ID, Client Secret, Refresh Token
3. 在 Amail 中选择认证方式为 `oauth2`，填入凭据

**Outlook / Office 365:**
1. 在 Azure Portal 注册应用
2. 配置 `Mail.Send` 权限
3. 获取 Client ID, Client Secret, Refresh Token
4. 可选填入 Tenant ID

## Docker 部署

### 使用 docker-compose（推荐）

1. 配置环境变量：

```bash
# 生成加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 创建 .env 文件
cat > .env << EOF
ADMIN_TOKEN=your-secure-admin-token
ENCRYPTION_KEY=<上一步生成的64位hex>
EOF
```

2. 启动服务：

```bash
docker compose up -d
```

3. 验证运行：

```bash
curl http://localhost:3000/health
# => {"status":"ok","version":"1.0.0"}
```

4. 打开 `http://localhost:3000` 进入管理界面。

### 使用 docker run

```bash
docker build -t amail .
docker run -d \
  --name amail \
  -p 3000:3000 \
  -v amail-data:/data \
  -e ADMIN_TOKEN=your-secure-admin-token \
  -e ENCRYPTION_KEY=your-64-hex-key \
  amail
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `ADMIN_TOKEN` | 管理界面 Token | 必填 |
| `ENCRYPTION_KEY` | SMTP 密码加密密钥 (64位hex) | 必填 |
| `DB_PATH` | SQLite 数据库路径 | `/data/amail.db` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 从 Resend 迁移

只需将 API 地址从：
```
https://api.resend.com
```
改为你的 Amail 地址：
```
http://your-server:3000
```

Token 格式保持 `Bearer` 前缀，Amail 使用 `am_` 前缀。

## 目录结构

```
src/
├── index.ts              # 入口
├── config.ts             # 环境变量配置
├── crypto.ts             # 加密/解密工具
├── db/
│   ├── index.ts          # SQLite 连接
│   └── migrations.ts     # 建表迁移
├── auth/
│   └── middleware.ts     # API Key / Admin Token 验证
├── smtp/
│   ├── manager.ts        # SMTP 连接池管理
│   └── oauth.ts          # OAuth2 Token 刷新
├── api/
│   ├── emails.ts         # POST /emails 等 Resend 兼容端点
│   ├── smtp-configs.ts   # SMTP 配置 CRUD
│   ├── api-keys.ts       # API Key CRUD
│   └── analytics.ts      # 数据分析 API
├── services/
│   ├── email-sender.ts   # 核心发件逻辑
│   └── analytics.ts      # 统计服务
└── web/
    └── index.html        # 管理界面 (单文件)
```

## License

MIT
