# 混合架构：本地 K8s + 云端域名/穿透

> **目标**: 本地运行 AgentHive，云端只做流量入口，极致低成本

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                           互联网                                 │
│                                                                  │
│  用户 ──► https://agenthive.demo ──► Cloudflare / 阿里云        │
│                                          │                      │
│                              ┌───────────┴───────────┐          │
│                              │    域名 + HTTPS       │          │
│                              │   (Cloudflare Tunnel) │          │
│                              │      或阿里云 SLB     │          │
│                              └───────────┬───────────┘          │
│                                          │                      │
│                                          ▼                      │
│                              ┌─────────────────────┐            │
│                              │   内网穿透隧道       │            │
│                              │  (frp / Cloudflare  │            │
│                              │   Tunnel / ngrok)   │            │
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
                    │    │    内网穿透客户端 (frpc)     │             │
                    │    │    端口: 30080 ──► 云端     │             │
                    │    └─────────────────────────────┘             │
                    │                                              │
                    │    ┌─────────────────────────────┐             │
                    │    │    本地 Ollama (4070 TiS)    │             │
                    │    │    端口: 11434               │             │
                    │    └─────────────────────────────┘             │
                    │                                              │
                    └──────────────────────────────────────────────┘


成本分布:
┌──────────────────┬──────────────┬─────────────────────────────┐
│     组件         │    成本      │           说明              │
├──────────────────┼──────────────┼─────────────────────────────┤
│ 本地 K8s         │   ¥0         │  你的电脑，电费忽略          │
│ 本地 Ollama      │   ¥0         │  4070 TiS，已拥有            │
│ 域名 (.com)      │   ~¥60/年    │  阿里云/腾讯云               │
│ Cloudflare       │   ¥0         │  免费套餐够用                │
│ 内网穿透         │   ¥0-30/月   │  自托管 frp 免费，商用收费    │
│ 阿里云 SLB       │   ¥0         │  可选，可用 Cloudflare 替代   │
├──────────────────┼──────────────┼─────────────────────────────┤
│ 总计             │   ¥5-30/月   │  取决于是否用付费穿透服务    │
└──────────────────┴──────────────┴─────────────────────────────┘
```

---

## 🔧 方案对比

### 方案 1: Cloudflare Tunnel（推荐 ⭐⭐⭐）

**架构:**
```
用户 ──► Cloudflare Edge ──► Cloudflare Tunnel ──► 本地 K8s
                │                    │
                ▼                    ▼
           免费 HTTPS            加密隧道
           全球 CDN              自动重连
```

**成本:**
| 项目 | 费用 | 说明 |
|------|------|------|
| Cloudflare 账号 | ¥0 | 免费套餐 |
| Cloudflare Tunnel | ¥0 | 无限流量 |
| 域名 | ~¥60/年 | 任意域名 |
| **总计** | **~¥5/月** | 仅域名费用 |

**优点:**
- ✅ 免费 HTTPS 证书（自动续期）
- ✅ 全球 CDN 加速
- ✅ DDoS 防护
- ✅ 无需公网 IP
- ✅ 安装简单（一个 docker 容器）

**缺点:**
- ⚠️ 国内访问可能慢（可用 Cloudflare 优选 IP）
- ⚠️ 需要域名备案（国内域名）

---

### 方案 2: 阿里云 SLB + 自托管 frp

**架构:**
```
用户 ──► 阿里云 SLB ──► 阿里云 ECS (frps) ──► 本地 frpc ──► K8s
              │              │
              ▼              ▼
         ¥0.02/GB       最便宜的 ECS
         流量计费        (1c1g ~¥50/月)
```

**成本:**
| 项目 | 费用 | 说明 |
|------|------|------|
| 阿里云 ECS (1c1g) | ~¥50/月 | 跑 frps |
| 阿里云 SLB | ¥0 | 可用/nginx 替代 |
| 域名 | ~¥60/年 | 阿里云域名 |
| 流量 | ~¥0.02/GB | 按实际使用 |
| **总计** | **~¥55/月** | 含域名分摊 |

**优点:**
- ✅ 国内访问速度快
- ✅ 完全可控
- ✅ 可扩展其他服务

**缺点:**
- ❌ 成本较高
- ❌ 需要维护 frp

---

### 方案 3: 免费 frp 服务（测试用）

**公共 frp 服务:**
- https://www.natfrp.org/ ( SakuraFRP )
- https://www.natapp.cc/ ( NatApp )

**成本:**
| 项目 | 费用 |
|------|------|
| 免费隧道 | ¥0 |
| 带宽限制 | 通常 1-5Mbps |
| 稳定性 | 一般 |

**适合场景:**
- 临时测试
- 不重要的演示

---

## 🚀 推荐方案：Cloudflare Tunnel

### 实施步骤

#### 1. 本地部署 K8s (Kind)

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

#### 2. 部署 Cloudflare Tunnel

```bash
# 在本地运行 cloudflared
docker run -d \
  --name cloudflared \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate \
  run \
  --token YOUR_TUNNEL_TOKEN
```

#### 3. Cloudflare 控制台配置

```yaml
# config.yml (在 Cloudflare Zero Trust 控制台配置)
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

## 💰 详细成本计算

### 场景：演示展示用

**假设：**
- 每月演示 4 次，每次 2 小时
- 平时关闭，演示前开启

| 成本项 | 方案 A (Cloudflare) | 方案 B (阿里云) |
|--------|---------------------|-----------------|
| **域名** (.com) | ¥60/年 = ¥5/月 | ¥60/年 = ¥5/月 |
| **云端服务** | ¥0 (Cloudflare 免费) | ¥50/月 (ECS 1c1g) |
| **内网穿透** | ¥0 (Tunnel 免费) | ¥0 (自托管 frp) |
| **流量** | ¥0 (不限) | ~¥2/月 (4次×2h) |
| **本地电费** | ~¥10/月 | ~¥10/月 |
| **总计** | **~¥15/月** ⭐ | **~¥67/月** |

**演示期间成本:**
- Cloudflare 方案: **¥0** (已包含在域名费中)
- 阿里云方案: **¥0.5/次** (ECS 按小时计费 ¥0.25/h)

---

## ⚠️ 技术限制与风险

### 1. 本地 K8s 限制

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| **电脑关机** | 服务中断 | 保持电脑开机，或使用备用机 |
| **IP 变化** | Tunnel 断开 | 使用动态 DNS 或固定重连 |
| **带宽限制** | 上行通常 20-50Mbps | 足够演示演示 |
| **电力中断** | 服务中断 | UPS 备用电源 |

### 2. 内网穿透限制

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| **延迟增加** | +20-50ms | 选择就近的 Cloudflare 节点 |
| **带宽限制** | 取决于穿透服务 | Cloudflare 无限制 |
| **连接稳定性** | 可能断开 | 配置自动重连 |

### 3. 安全风险

```
风险:
- 本地电脑暴露在公网
- 可能遭受攻击

缓解措施:
1. 使用 Cloudflare Access (身份验证)
2. 限制 IP 白名单
3. 防火墙只开放必要端口
4. 演示结束后关闭 Tunnel
```

---

## 🎯 演示专用配置

### 最小化启动脚本

```bash
#!/bin/bash
# start-interview.sh

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
echo "⏱️  请在演示结束后运行 ./stop-interview.sh"
```

```bash
#!/bin/bash
# stop-interview.sh

echo "🛑 关闭演示环境..."

# 停止 Tunnel
docker stop cloudflared

# 可选：停止 Kind（保留集群，只停 Pod）
kubectl scale deployment landing --replicas=0
kubectl scale deployment api --replicas=0

echo "✅ 已关闭，成本为 ¥0"
```

---

## 📊 成本总结

| 架构 | 月成本 | 演示 2h 成本 | 稳定性 | 复杂度 |
|------|--------|-------------|--------|--------|
| **纯云端 EKS** | ~¥580 | ~¥1.6 | ⭐⭐⭐⭐⭐ | 低 |
| **混合 (Cloudflare)** | **~¥15** | **¥0** | ⭐⭐⭐⭐ | 中 |
| **混合 (阿里云)** | ~¥67 | ~¥1 | ⭐⭐⭐⭐ | 高 |
| **纯本地** | ¥0 | ¥0 | ⭐⭐ | 低 |

**推荐: 混合方案 (Cloudflare Tunnel)**
- 成本最低（仅域名费用）
- 国内访问可用（配合 Cloudflare 优选 IP）
- 专业形象（自定义域名 + HTTPS）

---

## 🔗 相关资源

- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Kind 快速开始](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [K3s 轻量级 K8s](https://k3s.io/)
- [frp 内网穿透](https://github.com/fatedier/frp)
