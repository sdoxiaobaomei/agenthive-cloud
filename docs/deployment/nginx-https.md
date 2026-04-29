# Nginx HTTPS 证书配置指南

> **关联 Ticket**: TICKET-P0-004（简化版）  
> **证书来源**: 阿里云 SSL 证书服务  
> **适用环境**: Docker Compose 生产/演示环境  

---

## 当前配置

Nginx 已启用 HTTPS 强制跳转和 HSTS：

- **HTTP 80**: `return 301 https://$server_name$request_uri`
- **HTTPS 443**: TLS 1.2 + TLS 1.3，现代加密套件
- **HSTS**: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **证书路径**: `/etc/nginx/ssl/agenthive.crt` + `/etc/nginx/ssl/agenthive.key`

---

## 证书部署步骤

### 1. 从阿里云下载证书

1. 登录 [阿里云 SSL 证书控制台](https://www.aliyun.com/product/cas)
2. 找到已签发的域名证书（如 `agenthive.cloud`）
3. 点击「下载」，选择 **Nginx** 格式
4. 解压后得到：
   - `agenthive.crt`（证书链 / fullchain）
   - `agenthive.key`（私钥）

### 2. 放置证书到项目目录

```bash
# 创建 SSL 目录（已加入 .gitignore）
mkdir -p nginx/ssl

# 复制证书（请替换为实际下载路径）
cp ~/Downloads/agenthive/agenthive.crt nginx/ssl/
cp ~/Downloads/agenthive/agenthive.key nginx/ssl/

# 验证权限
chmod 644 nginx/ssl/agenthive.crt
chmod 600 nginx/ssl/agenthive.key
```

> ⚠️ **切勿将证书提交到 Git**：`nginx/ssl/` 已配置在 `.gitignore` 中。

### 3. 启动/重启服务

```bash
# 生产环境
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 如果 Nginx 已在运行，仅重启即可
docker compose -f docker-compose.prod.yml restart nginx
```

### 4. 验证

```bash
# 测试 HTTP 301 跳转
curl -I http://agenthive.cloud
# HTTP/1.1 301 Moved Permanently
# Location: https://agenthive.cloud/

# 测试 HTTPS 证书
curl -I https://agenthive.cloud
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains

# 测试 SSL Labs（可选，目标 B+ 以上）
# https://www.ssllabs.com/ssltest/analyze.html?d=agenthive.cloud
```

---

## 证书续期

阿里云免费证书有效期 **90 天**，到期前 30 天会发送邮件提醒。

### 续期流程

```bash
# 1. 阿里云控制台「重新申请」或「续期」证书
# 2. 下载新的 Nginx 格式证书
# 3. 替换服务器上的证书文件
cp ~/Downloads/agenthive_new/agenthive.crt nginx/ssl/
cp ~/Downloads/agenthive_new/agenthive.key nginx/ssl/

# 4. 重启 Nginx（零停机热重载）
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# 5. 验证新证书有效期
echo | openssl s_client -servername agenthive.cloud -connect agenthive.cloud:443 2>/dev/null | openssl x509 -noout -dates
```

### 日历提醒

建议在团队日历设置以下提醒：
- 证书到期前 **30 天**：开始续期流程
- 证书到期前 **7 天**：确认新证书已部署

---

## 多域名配置（可选）

如需要为多个域名配置证书：

```nginx
server {
    listen 443 ssl http2;
    server_name agenthive.cloud www.agenthive.cloud;

    ssl_certificate /etc/nginx/ssl/agenthive.crt;
    ssl_certificate_key /etc/nginx/ssl/agenthive.key;

    # ... 其余配置不变
}

# 如有其他域名，新增 server 块
server {
    listen 443 ssl http2;
    server_name api.agenthive.cloud;

    ssl_certificate /etc/nginx/ssl/api-agenthive.crt;
    ssl_certificate_key /etc/nginx/ssl/api-agenthive.key;
}
```

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `nginx: [emerg] cannot load certificate` | 证书路径错误或文件缺失 | 检查 `nginx/ssl/` 目录是否存在 `agenthive.crt` 和 `agenthive.key` |
| `curl: (60) SSL certificate problem` | 自签证书或证书链不完整 | 确认下载的是 Nginx 格式（包含完整证书链） |
| 浏览器显示「不安全」| 证书与域名不匹配 | 检查证书 CN/SAN 是否包含访问域名 |
| HSTS 头未出现 | Nginx 配置未加载 | 确认 HTTPS server 块已启用，重启 Nginx |

---

## 回滚

如需临时回退到 HTTP：

```bash
# 注释 nginx/nginx.conf 中的 return 301 行，重启 Nginx
docker compose -f docker-compose.prod.yml restart nginx
```
