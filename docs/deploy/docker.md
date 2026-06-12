# Docker 部署

## docker compose

创建 `.env`：

```ini
ADMIN_TOKEN=your-secure-admin-token
ENCRYPTION_KEY=your-64-character-hex-key
LOG_LEVEL=info
```

启动：

```bash
docker compose up -d
```

检查：

```bash
curl http://localhost:3000/health
```

## docker run

```bash
docker build -t amail .
docker run -d \
  --name amail \
  -p 3000:3000 \
  -v amail-data:/data \
  -e ADMIN_TOKEN=your-secure-admin-token \
  -e ENCRYPTION_KEY=your-64-character-hex-key \
  amail
```

SQLite 数据在容器内 `/data/amail.db`。
