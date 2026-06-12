# Docker 部署

## docker compose

复制为 `docker-compose.yml`：

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

复制为 `.env`：

```ini
ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=从配置页复制生成的64位hex字符串
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

发信建议使用 Node.js SDK，见 [Node SDK](/sdk/node)。
