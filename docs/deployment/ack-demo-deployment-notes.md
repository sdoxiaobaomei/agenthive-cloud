# ACK Demo 集群部署踩坑记录

> 日期：2026-04-22
> 目标：将本地 Docker 镜像（API / Landing / Redis / RabbitMQ）部署到阿里云杭州 ACK 集群
> 集群：`agenthive-demo-ask` (cn-hangzhou, v1.35.2-aliyun.1)
> SLB 公网 IP：`121.199.169.229`
> 域名：`xiaochaitian.asia` / `api.xiaochaitian.asia` / `agenthive.xiaochaitian.asia`

---

## 一、部署架构

```
Internet
    ↓
[阿里云 SLB: 121.199.169.229]  ← DNS A 记录指向
    ↓
[Nginx Ingress Controller]  (社区版， LoadBalancer Service)
    ↓
    ├─ xiaochaitian.asia      → Landing Service (port 80)
    ├─ api.xiaochaitian.asia  → API Service (port 3001)
    └─ agenthive.xiaochaitian.asia → Landing Service (port 80)

[ACK Node - Hangzhou]
    ├─ API Pod       → 北京 ECS 外部 Postgres (39.96.219.254:5432)
    ├─ Landing Pod
    ├─ Redis Pod
    └─ RabbitMQ Pod
```

---

## 二、今日完成事项

| # | 事项 | 状态 |
|---|------|------|
| 1 | 修复 API Redis `NaN` 端口错误 | ✅ |
| 2 | 修复 Landing 探针端口不匹配 (3000→80) | ✅ |
| 3 | 修复 API `/data` 目录不可写 | ✅ |
| 4 | 修复 API init container 镜像拉取失败 | ✅ |
| 5 | 修复 RabbitMQ probe 超时导致 CrashLoopBackOff | ✅ |
| 6 | 构建并推送 API / Landing 镜像到 ACR | ✅ |
| 7 | 安装 Nginx Ingress Controller（社区版） | ✅ |
| 8 | 安装 cert-manager | ✅ |
| 9 | 配置 Let's Encrypt 自动证书 | ✅ |
| 10 | 修复 Landing 前端 API 调用地址 (`localhost:3001` → 生产域名) | ✅ |
| 11 | 修复 API CORS 跨域配置 | ✅ |
| 12 | 修复 Ingress 域名 (`agenthive.chai.com` → `agenthive.xiaochaitian.asia`) | ✅ |

---

## 三、踩坑记录

### 坑 1：API 镜像缓存 — `latest` + `IfNotPresent` 导致节点使用旧镜像

**现象**：重建 API 镜像并 push 到 ACR 后，Pod 日志仍然显示旧的 `NaN` 端口错误。

**根因**：K8s 节点本地已缓存了 `api:latest` 镜像，`imagePullPolicy: IfNotPresent` 不会重新拉取。

**解决**：在 `api-patch.yaml` 和 `landing-patch.yaml` 中显式设置 `imagePullPolicy: Always`。

```yaml
containers:
- name: api
  imagePullPolicy: Always
```

**教训**：生产环境不要使用 `latest` 标签；Demo 环境如果用了 `latest`，必须配合 `Always`。

---

### 坑 2：TypeScript 修改未生效 — 改了 `src` 但忘了重新编译 `dist`

**现象**：修改了 `apps/api/src/config/redis.ts` 支持 `REDIS_URL` 解析，但 Docker 构建时 `COPY apps/api/dist` 复制的是旧的 `dist`。

**根因**：项目的 Dockerfile 采用"预构建 dist + Docker 复制"模式，而非在容器内编译。

**解决**：
1. 本地先执行 `cd apps/api && npm run build` 重新编译 dist
2. 再执行 `docker build`（不要使用缓存）

**教训**：这类 Dockerfile 需要牢记：**改源码 → 先本地 build → 再 docker build**。

---

### 坑 3：Kustomize Strategic Merge Patch 数组合并导致 `Duplicate value`

**现象**：`landing-patch.yaml` 中重新定义了 `ports: [{containerPort: 80, name: http}]`，与 base 中 `containerPort: 3000, name: http` 冲突，报 `Duplicate value: "http"`。

**根因**：Kustomize 的 Strategic Merge Patch 对同名数组元素会合并，不会替换。base 和 patch 都有 `name: http`，导致重复。

**解决**：直接修改 `base/05-landing.yaml` 中的 `containerPort` 和 Service `targetPort`，`landing-patch.yaml` 只保留 `replicas`。

**教训**：Patch 文件尽量少改动数组类型的字段，必要时直接修改 base 或改用 JSON Patch。

---

### 坑 4：ConfigMap 新增 key 但未在 Deployment 中引用

**现象**：在 `configmap-patch.yaml` 中添加了 `CORS_ORIGIN`，但 API Pod 内 `env | grep CORS` 无输出，导致跨域失败。

**根因**：`base/04-api.yaml` 的 Deployment 是逐个 key 显式 `valueFrom.configMapKeyRef` 引用的，新增 key 不会自动映射。

**解决**：在 `base/04-api.yaml` 的 `env` 列表中追加 `CORS_ORIGIN` 的引用。

```yaml
- name: CORS_ORIGIN
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: CORS_ORIGIN
```

**教训**：使用 `envFrom.configMapRef` 可以一次性引入所有 ConfigMap key，避免遗漏。但项目当前采用显式引用，新增配置时需同步修改 Deployment。

---

### 坑 5：Ingress TLS hosts 与 rules hosts 不一致

**现象**：修改 `ingress.yaml` 将 `agenthive.chai.com` 改为 `agenthive.xiaochaitian.asia`，但 `kubectl get ingress` 仍显示旧域名。

**根因 1**：只改了 `rules[].host`，忘了改 `tls[].hosts`。  
**根因 2**：`kustomization.yaml` 的 `resources` 列表中没有包含 `ingress.yaml`，导致 `kubectl apply -k` 从未应用过该文件（最初是用 `kubectl apply -f` 直接创建的）。

**解决**：
1. 同时修改 `rules` 和 `tls.hosts`
2. 将 `ingress.yaml` 加入 `kustomization.yaml` 的 `resources`

---

### 坑 6：RabbitMQ 启动慢导致 Probe 超时

**现象**：RabbitMQ Pod 反复重启，日志显示启动成功后又因 probe 失败被 kill。

**根因**：RabbitMQ 冷启动需要约 36 秒，而 readiness probe 的 `initialDelaySeconds` 只有 5 秒，`timeoutSeconds` 只有 3 秒。

**解决**：
```yaml
readinessProbe:
  initialDelaySeconds: 60
  timeoutSeconds: 10
livenessProbe:
  initialDelaySeconds: 60
  timeoutSeconds: 10
```

---

### 坑 7：浏览器缓存 CORS 预检失败结果

**现象**：服务端 CORS 配置已修复，但浏览器控制台仍报 `No 'Access-Control-Allow-Origin' header`。

**根因**：浏览器缓存了之前（CORS 未配置时）的 OPTIONS 预检失败响应。

**解决**：`Ctrl + Shift + R` 强制刷新，或 DevTools → Network → Disable cache → 刷新。

---

## 四、关键配置速查

### DNS A 记录配置

| 主机记录 | 类型 | 记录值 |
|---------|------|--------|
| `@` | A | `121.199.169.229` |
| `api` | A | `121.199.169.229` |
| `agenthive` | A | `121.199.169.229` |

### 镜像地址

```
crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/api:latest
crpi-89ktoa4wv8sjcdow.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/landing:latest
```

### 证书状态检查

```bash
kubectl get certificate -n agenthive
kubectl describe certificate agenthive-tls -n agenthive
```

### 查看 Ingress 路由

```bash
kubectl get ingress -n agenthive
```

---

## 五、文件变更清单

**新增文件**：
- `k8s/overlays/demo-ask/base/00-namespace.yaml`
- `k8s/overlays/demo-ask/base/01-secrets.yaml`
- `k8s/overlays/demo-ask/base/03-redis.yaml`
- `k8s/overlays/demo-ask/base/04-api.yaml`
- `k8s/overlays/demo-ask/base/05-landing.yaml`
- `k8s/overlays/demo-ask/base/08-configmap.yaml`
- `k8s/overlays/demo-ask/api-patch.yaml`
- `k8s/overlays/demo-ask/configmap-patch.yaml`
- `k8s/overlays/demo-ask/landing-patch.yaml`
- `k8s/overlays/demo-ask/rabbitmq.yaml`
- `k8s/overlays/demo-ask/ingress.yaml`
- `k8s/overlays/demo-ask/cert-manager-issuer.yaml`

**修改文件**：
- `apps/api/src/config/redis.ts` — 支持 REDIS_URL 解析
- `apps/landing/composables/useApi.ts` — 客户端 baseUrl 改为生产域名
- `apps/landing/components/CTASection.vue` — 跳转目标改为生产域名
- `apps/landing/nuxt.config.ts` — runtimeConfig 支持 NUXT_PUBLIC_API_BASE
- `k8s/overlays/demo-ask/kustomization.yaml` — 添加 ingress.yaml

---

## 六、后续待办

- [ ] 等 DNS 生效后，验证 `https://xiaochaitian.asia` 和 `https://api.xiaochaitian.asia` 全站 HTTPS
- [ ] 配置阿里云 OSS/ACR 镜像自动同步（避免 Docker Hub 超时）
- [ ] 为 Landing / API 添加 Pod HPA（当前固定单副本）
- [ ] 配置监控告警（Prometheus + Grafana）
