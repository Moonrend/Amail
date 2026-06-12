# 配置

<script setup>
import EncryptionKeyGenerator from '../.vitepress/theme/components/EncryptionKeyGenerator.vue'
</script>

## ENCRYPTION_KEY

每次刷新页面都会生成新值：

<EncryptionKeyGenerator />

环境变量：

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `PORT` | 否 | `3000` | HTTP 端口 |
| `HOST` | 否 | `0.0.0.0` | 监听地址 |
| `ADMIN_TOKEN` | 是 | 空 | 管理后台 Token |
| `ENCRYPTION_KEY` | 是 | 空 | 64 位 hex 加密密钥 |
| `DB_PATH` | 否 | `./data/amail.db` | SQLite 路径 |
| `LOG_LEVEL` | 否 | `info` | 日志级别 |
| `SMTP_POOL_MAX_CONNECTIONS` | 否 | `5` | 每个 SMTP 的最大连接数 |
| `SMTP_POOL_MAX_MESSAGES` | 否 | `100` | 每个连接最多发送数 |
| `SMTP_CONNECTION_TIMEOUT_MS` | 否 | `10000` | 连接超时 |
| `SMTP_GREETING_TIMEOUT_MS` | 否 | `10000` | greeting 超时 |
| `SMTP_SOCKET_TIMEOUT_MS` | 否 | `60000` | socket 超时 |

## SMTP 认证

| 类型 | 说明 |
| --- | --- |
| `password` | 用户名密码 |
| `login` | LOGIN |
| `plain` | PLAIN |
| `cram-md5` | CRAM-MD5 |
| `oauth2` | OAuth2 |
| `none` | 无认证 |
