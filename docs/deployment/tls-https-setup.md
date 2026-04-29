# TLS / HTTPS 配置指南

> **关联 Ticket**: TICKET-P0-004  
> **适用场景**: 所有环境（本地开发使用自签证书，生产使用 Let's Encrypt）  
> **目标**: 强制 HTTPS + HSTS + 自动证书管理

---

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Client    │────▶│   Nginx /   │────▶│   Backend       │
│             │     │   Ingress   │     │   (API/Landing) │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                   │
       │              TLS 1.2/1.3
       │              cert-manager (K8s)
       │              Let's Encrypt / 自签
       │                   │
       └───────── HSTS ────┘
```

---

## 安全基线

| 检查项 | 状态 | 说明 |
|--------|------|------|
| HTTP→HTTPS 301 跳转 | ✅ | Nginx 80 端口强制跳转；K8s Ingress `ssl-redirect: true` |
| TLS 版本 | ✅ | TLS 1.2 + TLS 1.3（禁用 TLS 1.0/1.1） |
| HSTS | ✅ | `max-age=31536000; includeSubDomains` |
| 安全响应头 | ✅ | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 证书自动续期 | ✅ | cert-manager 自动管理 Let's Encrypt（K8s） |

---

## Docker Compose 环境（本地 / Demo）

### 1. 生成自签证书

```bash
./scripts/generate-selfsigned-cert.sh
```

此脚本会在 `nginx/ssl/` 目录生成：
- `fullchain.pem` — 证书（含 SAN 扩展）
- `privkey.pem` — 私钥

> ⚠️ `nginx/ssl/` 已加入 `.gitignore`，确保证书不提交 Git。

### 2. 启动服务

```bash
# 生产环境
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Demo 环境
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d
```

Nginx 已配置：
- `listen 80` → `return 301 https://$server_name$request_uri`
- `listen 443 ssl http2` → 挂载 `./nginx/ssl/`
- HSTS 头：`Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 3. 验证

```bash
curl -I http://localhost
# HTTP/1.1 301 Moved Permanently
# Location: https://localhost/

curl -I -k https://localhost
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains
# x-frame-options: SAMEORIGIN
# x-content-type-options: nosniff
```

---

## Kubernetes 环境（Staging / Production）

### 1. 安装 cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

### 2. 部署 ClusterIssuer

```bash
kubectl apply -k k8s/components/cert-manager/
```

此组件包含两个 ClusterIssuer：
- `letsencrypt-staging` — 预发环境测试用（不受速率限制）
- `letsencrypt-prod` — 生产环境正式证书

### 3. Ingress TLS 配置

Base Ingress (`k8s/base/09-ingress.yaml`) 已包含：
- `ssl-redirect: "true"`
- `force-ssl-redirect: "true"`
- HSTS 注解：`hsts: "true"`, `hsts-max-age: "31536000"`, `hsts-include-subdomains: "true"`
- 安全头：`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`

各环境 Overlay 通过 patch 覆盖域名和 cert-manager issuer：

| 环境 | ClusterIssuer | TLS Secret 名称 |
|------|--------------|----------------|
| **Production** | `letsencrypt-prod` | `production-tls-secret` |
| **Staging** | `letsencrypt-staging` | `staging-tls-secret` |
| **Demo** | `letsencrypt-prod` | 由 demo-ask Ingress 定义 |

### 4. 验证

```bash
# 检查证书签发状态
kubectl get certificate -n agenthive-production
kubectl describe certificate production-tls-secret -n agenthive-production

# 检查 Ingress 状态
kubectl get ingress -n agenthive-production

# HTTP 跳转测试
curl -I http://agenthive.cloud
# HTTP/1.1 308 Permanent Redirect
# Location: https://agenthive.cloud/

# HTTPS + HSTS 测试
curl -I https://agenthive.cloud
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains
```

---

## 回滚策略

### 紧急禁用 HTTPS 强制跳转（Docker Compose）

```bash
# 临时注释 nginx/nginx.conf 中的 return 301 行，重启 Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### 紧急回滚 Ingress TLS（K8s）

```bash
# 删除 Ingress 的 TLS 段（仅应急）
kubectl patch ingress agenthive-ingress -n agenthive-production \
  --type json -p='[{"op": "remove", "path": "/spec/tls"}]'

# 或回滚到上一个版本
kubectl rollout undo deployment/nginx-ingress-controller -n ingress-nginx
```

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `ERR_CERT_AUTHORITY_INVALID` | 自签证书不被浏览器信任 | 开发环境忽略；生产检查 Let's Encrypt 签发状态 |
| `308 Permanent Redirect` 循环 | Ingress 和 Nginx 双重跳转 | 检查 `force-ssl-redirect` 与后端服务是否同时启用 HTTPS |
| cert-manager 不签发证书 | Challenge 失败 | `kubectl describe challenge -n <namespace>`；确认 80 端口可达 |
| HSTS 头未出现 | Nginx Ingress 注解未生效 | 检查 Ingress annotations 是否被 overlay patch 覆盖丢失 |

---

## 参考

- [cert-manager 官方文档](https://cert-manager.io/docs/)
- [Let's Encrypt HTTP-01 Challenge](https://letsencrypt.org/docs/challenge-types/#http-01-challenge)
- [Nginx Ingress HSTS 注解](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#hsts)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
