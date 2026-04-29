#!/bin/bash
# =============================================================================
# 自签 TLS 证书生成脚本 (TICKET-P0-004)
# =============================================================================
# 用途：为 Docker Compose 本地/演示环境生成自签 HTTPS 证书
# 警告：自签证书仅用于开发和演示，生产环境请使用 Let's Encrypt
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"

# 创建 SSL 目录
mkdir -p "$SSL_DIR"

# 域名配置（可根据需要修改）
DOMAINS=(
  "localhost"
  "agenthive.local"
  "*.agenthive.local"
)

# 生成 SAN 扩展字符串
SAN=""
for domain in "${DOMAINS[@]}"; do
  if [ -z "$SAN" ]; then
    SAN="DNS:$domain"
  else
    SAN="$SAN,DNS:$domain"
  fi
done

# 添加 IP 地址
SAN="$SAN,IP:127.0.0.1,IP:::1"

echo "🔐 生成自签 TLS 证书..."
echo "   目标目录: $SSL_DIR"
echo "   域名: ${DOMAINS[*]}"
echo ""

# 生成私钥
openssl genrsa -out "$SSL_DIR/privkey.pem" 2048

# 生成 CSR
openssl req -new \
  -key "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/server.csr" \
  -subj "/C=CN/O=AgentHive/OU=Platform/CN=agenthive.local"

# 生成自签证书（含 SAN 扩展，有效期 365 天）
openssl x509 -req \
  -in "$SSL_DIR/server.csr" \
  -signkey "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -days 365 \
  -sha256 \
  -extfile <(printf "subjectAltName=%s\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth" "$SAN")

# 清理 CSR
rm "$SSL_DIR/server.csr"

# 设置权限
chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

echo "✅ 自签证书生成完成"
echo ""
echo "文件清单:"
ls -la "$SSL_DIR/"
echo ""
echo "证书信息:"
openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -text | grep -A2 "Subject Alternative Name"
echo ""
echo "⚠️  重要提醒："
echo "  1. 自签证书会被浏览器标记为不安全，开发环境可忽略"
echo "  2. nginx/ssl/ 目录已加入 .gitignore，确保证书不提交 Git"
echo "  3. 生产环境请删除自签证书，使用 cert-manager 自动签发 Let's Encrypt"
echo ""
