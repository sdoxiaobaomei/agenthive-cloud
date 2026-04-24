# 混合架构部署指南

> 🚧 **纯理论方案，未经验证** (最后检查: 2026-04-22)
>
> 本文档描述的 Cloudflare Tunnel 方案完全未经实战验证，
> 成本估算过于乐观，未考虑国内网络环境和实际运维成本。
>
> ---
>
> **原标注**:
> **目标**: 本地运行 AgentHive，云端只做流量入口，极致低成本 (~¥5/月)

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                           互联网                                 │
│                                                                  │
│  用户 ──► https://agenthive.demo ──► Cloudflare                 │
│                                          │                      │
│                              ┌───────────┴───────────┐          │
│                              │    免费 HTTPS         │          │
│                              │   Cloudflare Tunnel   │          │
│                              └───────────┬───────────┘          │
│                                          │                      │
│                                          ▼                      │
│                              ┌─────────────────────┐            │
│                              │   加密隧道 (免费)    │            │
│                              │   无流量限制        │            │
│                              └──────────┬──────────┘            │
│                                         │                       │
└─────────────────────────────────────────┼───────────────────────┘
                                          │
                    ┌─────────────────────┼───────────────────────┐
                    │                     │                       │
                    │            你的本地电脑 / 服务器              │
                    │                     │                       │
                    │    ┌────────────────┴────────────────┐      │
                    │    │        本地 K8s 集群             │      │
                    │    │    (Kind / K3s / Minikube)       │      │
                    │    │                                   │      │
                    │    │  ┌─────────┐  ┌────────────────┐  │      │
                    │    │  │ Landing │  │      API       │  │      │
                    │    │  │ (Pod)   │  │     (Pod)      │  │      │
                    │    │  └────┬────┘  └───────┬────────┘  │      │
                    │    │       │                │           │      │
                    │    │  ┌────┴────────────────┴────┐      │      │
                    │    │  │      Ingress-Nginx        │      │      │
                    │    │  │   (暴露到本地端口 30080)   │      │      │
                    │    │  └───────────┬──────────────┘      │      │
                    │    └──────────────┼─────────────────────┘      │
                    │                   │                            │
                    │    ┌──────────────┴──────────────┐             │
                    │    │    Cloudflare Tunnel       │             │
                    │    │    本地客户端 (cloudflared) │             │
                    │    └─────────────────────────────┘             │
                    │                                              │
                    └──────────────────────────────────────────────┘

成本分布:
┌──────────────────┬──────────────┬─────────────────────────────┐
│     组件         │    成本      │           说明              │
├──────────────────┼──────────────┼─────────────────────────────┤
│ 本地 K8s         │   ¥0         │  你的电脑                   │
│ 本地 Ollama      │   ¥0         │  4070 TiS，已拥有            │
│ 域名 (.com)      │   ~¥60/年    │  阿里云/腾讯云               │
│ Cloudflare       │   ¥0         │  免费套餐够用                │
│ Cloudflare Tunnel│   ¥0         │  免费无限流量                │
├──────────────────┼──────────────┼─────────────────────────────┤
│ 总计             │   ~¥5/月     │  仅域名费用                  │
└──────────────────┴──────────────┴─────────────────────────────┘
```

---

## 方案对比

### 方案 1: Cloudflare Tunnel（推荐 ⭐⭐⭐）

```
用户 ──► Cloudflare Edge ──► Cloudflare Tunnel ──► 本地 K8s
                │                    │
                ▼                    ▼
           免费 HTTPS            加密隧道
           全球 CDN              自动重连
```

**成本**: 仅域名费 ~¥5/月

**优点**:
- ✅ 免费 HTTPS 证书（自动续期）
- ✅ 全球 CDN 加速
- ✅ DDoS 防护
- ✅ 无需公网 IP
- ✅ 安装简单

**缺点**:
- ⚠️ 国内访问可能慢（可用 Cloudflare 优选 IP）

### 方案 2: 阿里云 SLB + 自托管 frp

**成本**: ~¥55/月（含 ECS 1c1g 跑 frps）

**优点**:
- ✅ 国内访问速度快
- ✅ 完全可控

**缺点**:
- ❌ 成本较高
- ❌ 需要维护 frp

---

## 实施步骤

### 1. 本地部署 K8s (Kind)

```bash
# 安装 Kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 创建集群（暴露端口到宿主机）
cat > kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
EOF

kind create cluster --config kind-config.yaml

# 部署 AgentHive
kubectl apply -f k8s/
```

### 2. 配置 Cloudflare Tunnel

```bash
# 在 Cloudflare Zero Trust 控制台创建 Tunnel
# 获取 Tunnel Token

# 本地运行 cloudflared
docker run -d \
  --name cloudflared \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate \
  run \
  --token YOUR_TUNNEL_TOKEN
```

### 3. Cloudflare 控制台配置

```yaml
# 在 Cloudflare Zero Trust 控制台配置 ingress
tunnel: YOUR_TUNNEL_ID
credentials-file: /root/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: agenthive.yourdomain.com
    service: http://host.docker.internal:8080
  
  - hostname: api.agenthive.yourdomain.com
    service: http://host.docker.internal:8081
  
  - service: http_status:404
```

---

## 演示环境脚本

### start-interview.sh

```bash
#!/bin/bash
# 演示前运行

echo "🚀 启动演示环境..."

# 1. 启动 Kind 集群（如果已存在则跳过）
if ! kind get clusters | grep -q "agenthive"; then
    kind create cluster --name agenthive --config kind-config.yaml
fi
kubectl config use-context kind-agenthive

# 2. 部署 AgentHive
kubectl apply -f k8s/
kubectl wait --for=condition=ready pod --all --timeout=120s

# 3. 启动 Cloudflare Tunnel
docker start cloudflared 2>/dev/null || \
  docker run -d --name cloudflared \
    cloudflare/cloudflared:latest tunnel run --token $CF_TOKEN

# 4. 检查状态
echo "✅ 服务状态:"
kubectl get pods
echo ""
echo "🌐 访问地址: https://agenthive.yourdomain.com"
echo "⏱️  请在演示结束后运行 ./stop-demo.sh"
```

### stop-interview.sh

```bash
#!/bin/bash
# 演示后运行

echo "🛑 关闭演示环境..."

# 停止 Tunnel
docker stop cloudflared

# 可选：停止 Pod（保留集群，只停 Pod）
kubectl scale deployment landing --replicas=0
kubectl scale deployment api --replicas=0

echo "✅ 已关闭，成本为 ¥0"
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 电脑关机 | 服务中断 | 保持电脑开机 |
| IP 变化 | Tunnel 断开 | 自动重连 |
| 带宽限制 | 上行 20-50Mbps | 足够演示使用 |
| 安全风险 | 本地电脑暴露 | 使用 Cloudflare Access 身份验证 |

---

## 成本总结

| 架构 | 月成本 | 演示 2h 成本 | 稳定性 | 复杂度 |
|------|--------|-------------|--------|--------|
| **纯云端 EKS** | ~¥580 | ~¥1.6 | ⭐⭐⭐⭐⭐ | 低 |
| **混合 (Cloudflare)** | **~¥15** | **¥0** | ⭐⭐⭐⭐ | 中 |
| **纯本地** | ¥0 | ¥0 | ⭐⭐ | 低 |

**推荐**: 混合方案 (Cloudflare Tunnel)
- 成本最低（仅域名费用）
- 国内访问可用（配合 Cloudflare 优选 IP）
- 专业形象（自定义域名 + HTTPS）

---

*参考: [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)*
