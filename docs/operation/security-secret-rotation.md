# Secret 安全管理与轮换 SOP

> **Ticket**: PLATFORM-009-A  
> **Scope**: AgentHive Cloud 的 Secret 全生命周期管理  
> **Owner**: Platform Team

---

## 1. 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Secret 管理架构                           │
├─────────────────────────────────────────────────────────────┤
│  方案 A (Phase 1): 原生 K8s Secret                          │
│    .env.prod ──► kubectl create secret generic ──► K8s     │
│                                                              │
│  方案 B (推荐): External Secrets Operator + 阿里云 KMS      │
│    阿里云 KMS ──► ExternalSecret CR ──► K8s Secret          │
│    (secret.yaml 模板已支持，enabled: true 即可启用)          │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 已部署的 Secret 模板

- `chart/agenthive/templates/secret.yaml` — 支持两种模式：
  - `externalSecret.enabled: true` → 创建 ExternalSecret CR，从 KMS 拉取
  - `externalSecret.enabled: false` → 创建占位符 Secret（`REPLACE_ME`）

---

## 2. 密钥轮换流程

### 2.1 自动轮换脚本

```bash
# 查看当前 Secret
kubectl get secret app-secrets -n agenthive -o yaml

# 执行轮换（会自动滚动重启 Pod）
bash scripts/rotate-secrets.sh

# 仅验证不执行
bash scripts/rotate-secrets.sh --dry-run
```

### 2.2 手动轮换（单个密钥）

```bash
# 1. 生成新值
NEW_JWT=$(openssl rand -hex 32)

# 2. 更新 Secret
kubectl patch secret app-secrets -n agenthive \
  --type=merge -p "{\"stringData\":{\"JWT_SECRET\":\"$NEW_JWT\"}}"

# 3. 滚动重启（让 Pod 读取新 Secret）
kubectl rollout restart deployment -n agenthive
```

### 2.3 阿里云 KMS 轮换（推荐生产）

1. 登录 [阿里云 KMS 控制台](https://kms.console.aliyun.com/)
2. 找到对应的凭据（如 `agenthive-prod-jwt-secret`）
3. 点击「轮换」→ 自动生成新值
4. External Secrets Operator 会在 `refreshInterval`（默认 1h）内自动同步
5. 如需立即同步，删除旧 Secret 让 ESO 重新创建：
   ```bash
   kubectl delete secret app-secrets -n agenthive
   ```

---

## 3. Git 历史清理

### 3.1 验证是否泄漏

```bash
bash scripts/clean-git-secrets.sh --verify-only
```

### 3.2 清理历史（⚠️ 会重写历史）

```bash
# 1. 先完整备份
git clone --mirror <repo-url> agenthive-backup.git

# 2. 执行清理
bash scripts/clean-git-secrets.sh

# 3. 强制推送
git push --force --all

# 4. 通知所有协作者重新 clone
```

---

## 4. Secret 清单

| Secret Key | 用途 | 最小长度 | 存储位置 |
|-----------|------|---------|---------|
| `DB_PASSWORD` | PostgreSQL | 16 | KMS / K8s Secret |
| `REDIS_PASSWORD` | Redis AUTH | 16 | KMS / K8s Secret |
| `JWT_SECRET` | Token 签名 | 32 | KMS / K8s Secret |
| `LLM_API_KEY` | Kimi API | 20+ | KMS / K8s Secret |
| `NACOS_AUTH_TOKEN` | Nacos 认证 | 32 | KMS / K8s Secret |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 管理 | 12 | KMS / K8s Secret |

---

## 5. RBAC 最小权限

```yaml
# chart/agenthive/templates/serviceaccount.yaml 已实现
# automountServiceAccountToken: false（默认）
# 只有需要访问 K8s API 的 Pod 才启用
```

---

## 6. 检查清单

- [ ] `.env.prod` 已从仓库移除，仅保留 `.env.prod.example`
- [ ] `.gitignore` 包含 `.env*`
- [ ] Git 历史已清理（`scripts/clean-git-secrets.sh --verify-only` 返回 0）
- [ ] 生产环境使用 External Secrets Operator + KMS
- [ ] 密钥轮换脚本已测试
- [ ] Grafana/Loki 中无敏感数据泄露
