# K3s 单节点 ECS 部署 Runbook

> **Ticket**: PLATFORM-005  
> **Scope**: 在阿里云 ECS 上部署单节点 K3s 集群，作为 AgentHive 生产环境的 Kubernetes 运行时基座  
> **Rollback**: `sudo /usr/local/bin/k3s-uninstall.sh`

---

## 1. 前置条件

### 1.1 ECS 规格建议

| 场景 | 规格 | 说明 |
|------|------|------|
| 最小验证 | 2C4G | 可运行 K3s + ingress-nginx + cert-manager |
| 推荐生产 | 4C8G 或 8C16G | 可叠加运行 AgentHive 应用 Pod |

### 1.2 操作系统

支持以下发行版：

- **Alibaba Cloud Linux 3**（推荐）
- CentOS 7 / 8 Stream
- Rocky Linux 8 / 9
- AlmaLinux 8 / 9
- Anolis OS 7 / 8

### 1.3 安全组规则（必须）

| 方向 | 协议 | 端口 | 源 | 用途 |
|------|------|------|----|------|
| 入 | TCP | 80 | 0.0.0.0/0 | HTTP Ingress |
| 入 | TCP | 443 | 0.0.0.0/0 | HTTPS Ingress |
| 入 | TCP | 6443 | 跳板机/Bastion IP | Kubernetes API Server |
| 入 | TCP | 10250 | 节点自身 CIDR | Kubelet |
| 入 | UDP | 8472 | 节点自身 CIDR | Flannel VXLAN |
| 入 | TCP | 22 | 运维 IP | SSH |

> ⚠️ **安全基线**：6443 端口**严禁**暴露到 `0.0.0.0/0`，必须通过跳板机或内网 VPN 访问。

---

## 2. 一键安装

### 2.1 下载代码并执行

```bash
# 以 root 身份登录 ECS
ssh root@<ECS_EIP>

# 进入项目目录（或克隆仓库）
cd /opt/agenthive-cloud

# 执行一键安装脚本
sudo bash scripts/bootstrap-k3s-ecs.sh
```

安装过程约 **5-8 分钟**，脚本会自动完成：

1. 前置检查（OS、内存、磁盘、端口）
2. K3s Server 安装（禁用 Traefik）
3. kubeconfig 配置（权限 `600`）
4. 等待节点 Ready
5. ingress-nginx 安装（hostNetwork 模式，直接绑定 80/443）
6. cert-manager + ClusterIssuer 安装
7. 自动运行健康检查

### 2.2 安装参数

```bash
# 跳过前置检查（不推荐用于新机器）
sudo bash scripts/bootstrap-k3s-ecs.sh --skip-prechecks

# 查看帮助
sudo bash scripts/bootstrap-k3s-ecs.sh --help
```

### 2.3 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `INSTALL_K3S_VERSION` | `v1.29.1+k3s1` | K3s 版本 |
| `K3S_FLANNEL_IFACE` | 自动探测 | Flannel 使用的网卡 |
| `K3S_TOKEN` | 自动生成 | 集群 join token（单节点可忽略） |

---

## 3. 验证集群

### 3.1 快速验证

```bash
bash scripts/verify-k3s.sh
```

期望输出：

```
✅ All critical checks passed! K3s cluster is healthy.
```

### 3.2 手动检查

```bash
# 查看节点
kubectl get nodes -o wide

# 查看核心 Pod
kubectl get pods -n kube-system

# 查看 ingress-nginx
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx

# 查看 cert-manager
kubectl get pods -n cert-manager
kubectl get clusterissuers
```

### 3.3 kubeconfig 获取

```bash
# 本地复制 kubeconfig（在 ECS 上执行后下载到本地）
cat /root/.kube/config
# 或
cat /opt/agenthive-cloud/k3s.kubeconfig.yaml
```

本地使用：

```bash
export KUBECONFIG=/path/to/k3s.kubeconfig.yaml
kubectl get nodes
```

> 🔒 **安全提示**：`k3s.kubeconfig.yaml` 中的 `server` 地址已自动替换为 ECS 公网 IP，请妥善保管，不要提交到 Git。

---

## 4. 网络暴露（SLB / EIP）

### 4.1 方案 A：EIP 直接绑定（简单）

如果 ECS 已绑定 **弹性公网 IP (EIP)**：

1. 确保 ECS 安全组已放行 80/443（见 1.3）
2. ingress-nginx 已通过 hostNetwork 绑定节点 80/443
3. 直接通过 `http://<EIP>` 访问

### 4.2 方案 B：SLB 负载均衡（推荐生产）

1. 在阿里云控制台创建 **传统型负载均衡 (CLB)** 或 **应用型负载均衡 (ALB)**
2. 监听配置：
   - HTTP 80 → 后端 ECS 80
   - HTTPS 443 → 后端 ECS 443
3. 健康检查：TCP 80
4. DNS A 记录指向 SLB 的公网 IP

> 注意：如果使用 ALB，需要额外配置 Ingress 的 `alb.ingress.kubernetes.io` 注解。本阶段使用 CLB + hostNetwork 是最简方案。

---

## 5. 证书管理

### 5.1 已配置的 ClusterIssuer

| Issuer | 用途 | 环境 |
|--------|------|------|
| `letsencrypt-staging` | 测试证书签发 | Staging |
| `letsencrypt-prod` | 生产证书签发 | Production |

### 5.2 为 Ingress 添加 TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agenthive-ingress
  namespace: agenthive
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.xiaochaitian.asia
        - www.xiaochaitian.asia
      secretName: agenthive-tls
  rules:
    - host: api.xiaochaitian.asia
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 3001
```

### 5.3 验证证书签发

```bash
# 查看 Certificate 状态
kubectl get certificates -n agenthive
kubectl describe certificate agenthive-tls -n agenthive

# 查看 Order 和 Challenge
kubectl get orders -n agenthive
kubectl get challenges -n agenthive
```

---

## 6. 回滚

### 6.1 完全卸载 K3s

```bash
sudo /usr/local/bin/k3s-uninstall.sh
```

这会：

- 停止并删除 K3s 服务
- 删除所有 Kubernetes 数据（`/var/lib/rancher/k3s`）
- 删除 kubeconfig 和 kubectl symlink
- **不影响**现有的 Docker Compose 环境

### 6.2 保留 Docker Compose 环境

当前生产环境（`docker-compose.prod.yml`）**不会被修改**。在 K3s 验证完成、应用迁移就绪之前：

- DNS 不切换
- 现有流量不受影响
- 可并行运行 K3s 和 Docker Compose（注意端口冲突）

### 6.3 部分回滚

如果只回滚某个组件：

```bash
# 回滚 ingress-nginx
kubectl delete -n ingress-nginx all --all
kubectl delete namespace ingress-nginx

# 回滚 cert-manager
kubectl delete -n cert-manager all --all
kubectl delete namespace cert-manager
kubectl delete clusterissuer letsencrypt-staging letsencrypt-prod
```

---

## 7. 故障排查

### 7.1 K3s 无法启动

```bash
# 查看日志
sudo journalctl -u k3s -f

# 检查端口占用
sudo ss -tlnp | grep -E ':(80|443|6443|10250|2379|2380|8472)'

# 检查资源
free -h
df -h
```

### 7.2 节点 NotReady

```bash
kubectl describe node k3s-ecs-server
kubectl get events --sort-by='.lastTimestamp'
```

### 7.3 ingress-nginx 无法访问

```bash
# 检查 Pod 状态
kubectl get pods -n ingress-nginx -o wide
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# 检查 hostNetwork 是否生效
sudo ss -tlnp | grep ':80\|:443'
```

### 7.4 cert-manager 签发失败

```bash
# 检查 Challenge
kubectl get challenges --all-namespaces
kubectl describe challenge <name> -n <namespace>

# 常见原因
# 1. 公网 80 端口无法访问 Let's Encrypt 验证服务器
# 2. DNS 记录未指向 ECS/EIP
# 3. 安全组未放行 80
```

### 7.5 kubeconfig 权限问题

```bash
# 修复权限
chmod 600 /root/.kube/config
chmod 600 /opt/agenthive-cloud/k3s.kubeconfig.yaml
```

---

## 8. 安全基线检查清单

在将集群标记为 **生产就绪** 之前，确认以下事项：

- [ ] ECS 安全组 6443 端口仅限跳板机 IP
- [ ] kubeconfig 文件权限为 `600`
- [ ] 脚本中无硬编码密码或 API Key
- [ ] K3s 未安装 Traefik（`--disable=traefik`）
- [ ] 使用 Let's Encrypt **prod** issuer 前，先在 staging 验证通过
- [ ] 定期运行 `bash scripts/verify-k3s.sh` 进行健康检查

---

## 9. 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/bootstrap-k3s-ecs.sh` | 一键安装脚本 |
| `scripts/verify-k3s.sh` | 健康检查脚本 |
| `k8s/components/cert-manager/cluster-issuers.yaml` | ClusterIssuer 定义 |
| `k8s/base/00-namespace.yaml` | AgentHive 命名空间 |
| `scripts/deploy-k8s.sh` | 应用部署脚本（后续 ticket） |
