# External Secrets Operator (ESO) 配置指南

> **关联 Ticket**: TICKET-P0-003  
> **适用场景**: 生产 / 预发 / Demo 环境  
> **目标**: 将 K8s 明文 Secret 替换为阿里云 KMS 动态注入

---

## 架构概览

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Alibaba Cloud  │────▶│  ExternalSecret  │────▶│  K8s Secret     │
│  KMS            │     │  (ESO CRD)       │     │  (app-secrets)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  ClusterSecret   │
                       │  Store (ESO CRD) │
                       │  - RRSA 认证     │
                       └──────────────────┘
```

---

## 前置条件

1. **ACK 集群已开启 OIDC Provider**
   ```bash
   # 查看集群 OIDC Provider ARN
   aliyun cs GET /clusters/<cluster-id>
   # 确认 oidc_issuer 字段存在
   ```

2. **已创建 RAM Role 并绑定 RRSA 信任策略**
   ```json
   {
     "Statement": [
       {
         "Action": "sts:AssumeRole",
         "Effect": "Allow",
         "Principal": {
           "Federated": [
             "acs:ram::<account-id>:oidc-provider/ack-oidc"
           ]
         },
         "Condition": {
           "StringEquals": {
             "oidc:aud": "sts.aliyuncs.com",
             "oidc:iss": "https://oidc-<region>.ack.aliyuncs.com/<cluster-id>"
           },
           "StringLike": {
             "oidc:sub": "system:serviceaccount:*:external-secrets-*"
           }
         }
       }
     ],
     "Version": "1"
   }
   ```

3. **RAM Role 已授权 KMS 只读权限**
   - 策略：`AliyunKMSReadOnlyAccess`（或自定义最小权限）

4. **已在 KMS 创建以下 Secret**
   | KMS Secret 名称 | 说明 |
   |----------------|------|
   | `agenthive-production-db-user` | 数据库用户名 |
   | `agenthive-production-db-password` | 数据库密码 |
   | `agenthive-production-jwt-secret` | JWT 签名密钥 |
   | `agenthive-production-llm-api-key` | LLM API Key |

   > 预发环境请将 `production` 替换为 `staging`，Demo 环境替换为 `demo-ask`

---

## 部署 ESO

### 1. 安装 External Secrets Operator (Helm)

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set serviceAccount.annotations."eks\.aliyuncs\.com/role-arn"="acs:ram::<account-id>:role/agenthive-external-secrets-role"
```

> 如果使用 AccessKey 认证（不推荐生产环境），跳过 `--set serviceAccount.annotations` 并在 `01-secretstore.yaml` 中配置 `secretRef`。

### 2. 应用 SecretStore + ExternalSecret

```bash
# 基础配置（包含 ClusterSecretStore + ExternalSecret 模板）
kubectl apply -k k8s/base/

# 或单独应用
kubectl apply -f k8s/base/01-secretstore.yaml
kubectl apply -f k8s/base/01-externalsecrets.yaml
```

### 3. 验证 Secret 同步

```bash
# 查看 ExternalSecret 状态
kubectl get externalsecret app-secrets -n agenthive
# 应为 SYNCED/True

# 查看生成的 Secret（值应为 base64 加密）
kubectl get secret app-secrets -n agenthive -o yaml

# 验证 Pod 可正常读取
kubectl rollout restart deployment/api -n agenthive
kubectl rollout restart deployment/landing -n agenthive
kubectl get pods -n agenthive
```

---

## 多环境配置

| 环境 | Overlay 路径 | 建议操作 |
|------|-------------|---------|
| **Production** | `k8s/overlays/production/` | 通过 patches 修改 `refreshInterval` 为 `15m`，启用审计 |
| **Staging** | `k8s/overlays/staging/` | 使用独立的 KMS Secret 名称（`agenthive-staging-*`） |
| **Demo** | `k8s/overlays/demo-ask/` | 可直接复用 base 的 ESO 配置，或禁用自动同步手动注入 |
| **Local** | `k8s/overlays/local/` | 建议保持 Kustomize 引用 base，本地测试前手动创建 `app-secrets` Secret |

### Local 环境本地 Secret 创建（开发调试）

```bash
kubectl create secret generic app-secrets \
  --from-literal=DB_USER=agenthive \
  --from-literal=DB_PASSWORD=dev \
  --from-literal=JWT_SECRET=dev-jwt-secret \
  --from-literal=LLM_API_KEY=sk-your-llm-api-key \
  -n agenthive --dry-run=client -o yaml | kubectl apply -f -
```

> ⚠️ **Local 环境的 Secret 仅在本地 Kind/Docker Desktop 使用，绝不提交 Git。**

---

## 故障排查

| 现象 | 排查命令 | 解决方案 |
|------|---------|---------|
| ExternalSecret 状态为 `SecretSyncedError` | `kubectl describe externalsecret app-secrets -n agenthive` | 检查 RAM Role 权限、OIDC Provider ARN、KMS Secret 名称是否存在 |
| Pod 启动失败 `CreateContainerConfigError` | `kubectl describe pod <pod-name> -n agenthive` | 确认 `app-secrets` 已生成，且 key 名称与 Deployment 中 `secretKeyRef.key` 一致 |
| ESO Pod 崩溃 | `kubectl logs -n external-secrets deployment/external-secrets` | 检查 ServiceAccount 是否绑定了正确的 RAM Role ARN |

---

## 安全基线

- [x] 无明文 Secret 提交 Git
- [x] 使用 RRSA (OIDC) 认证，无长期 AccessKey
- [x] RAM Role 最小权限（仅 KMS 只读）
- [x] `refreshInterval` 可配置，生产环境建议 15m-1h
- [x] 生成的 K8s Secret 带有 `managed-by: external-secrets` 标签
- [x] Git 历史已通过 `git-filter-repo` 清理（见 `scripts/clean-git-secrets.sh`）

---

## 回滚策略

若 ESO 故障导致 Secret 无法同步：

```bash
# 紧急回滚：手动创建 Secret（仅限应急）
kubectl create secret generic app-secrets \
  --from-literal=DB_USER=<value> \
  --from-literal=DB_PASSWORD=<value> \
  --from-literal=JWT_SECRET=<value> \
  --from-literal=LLM_API_KEY=<value> \
  -n agenthive --dry-run=client -o yaml | kubectl apply -f -

# 长期修复：排查 ESO 后删除手动 Secret，恢复 ExternalSecret 同步
```

---

## 参考

- [External Secrets Operator 官方文档](https://external-secrets.io/)
- [阿里云 KMS Provider](https://external-secrets.io/latest/provider/alibaba-kms/)
- [ACK RRSA 配置指南](https://www.alibabacloud.com/help/en/ack/ack-managed-and-ack-dedicated/user-guide/use-rrsa-to-authorize-pods-to-access-different-cloud-services)
