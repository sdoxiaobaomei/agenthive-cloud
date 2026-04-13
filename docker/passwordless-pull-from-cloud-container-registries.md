# 云原生环境免密拉取云厂商容器镜像实战指南

> **适用场景**：VM、Kubernetes Node、Pod 以及 Docker Daemon 免密登录并拉取各大云厂商私有容器镜像仓库（ACR、ECR、ACR-Azure、GAR/GCR、TCR、SWR）。
> **核心理念**：彻底消除长期有效的静态密码/AccessKey，使用 IAM Role、Managed Identity、Workload Identity 或 kubelet Credential Provider 实现自动化、短期的凭证获取。

---

## 目录

1. [业界通用安全模型总览](#1-业界通用安全模型总览)
2. [阿里云 ACR — ACK 免密组件](#2-阿里云-acr--ack-免密组件)
3. [AWS ECR — EKS IAM & IRSA](#3-aws-ecr--eks-iam--irsa)
4. [Azure ACR — AKS Managed Identity](#4-azure-acr--aks-managed-identity)
5. [GCP Artifact Registry — GKE Workload Identity](#5-gcp-artifact-registry--gke-workload-identity)
6. [腾讯云 TCR — TKE TCR Addon](#6-腾讯云-tcr--tke-tcr-addon)
7. [华为云 SWR — CCE 节点委托 & Credential Provider](#7-华为云-swr--cce-节点委托--credential-provider)
8. [Kubernetes 未来趋势：KEP-4412](#8-kubernetes-未来趋势kep-4412)
9. [通用避坑指南](#9-通用避坑指南)
10. [参考文档](#10-参考文档)

---

## 1. 业界通用安全模型总览

在 Kubernetes 和 VM 场景中，让计算节点免密拉取私有镜像，业界主要采用以下四种模型：

| 模型 | 说明 | 安全级别 | 代表厂商 |
|------|------|----------|----------|
| **Node IAM Role / 节点委托** | 给 Node 的 IAM Role 授予镜像仓库只读权限，kubelet 自动用节点身份获取临时 Token | ⭐⭐⭐ | AWS、Azure、华为云 |
| **Managed Identity (系统/用户托管身份)** | 将云托管身份绑定到 Node 或 Pod，无需密码 | ⭐⭐⭐⭐ | Azure、GCP |
| **Workload Identity / IRSA / RRSA** | Pod 级别的细粒度身份，通过 OIDC + STS 换取临时凭证 | ⭐⭐⭐⭐⭐ | AWS IRSA、阿里云 RRSA、GKE Workload Identity |
| **Kubelet Credential Provider** | kubelet 调用云厂商提供的插件，自动获取并刷新临时登录密码 | ⭐⭐⭐⭐ | AWS ECR、阿里云 acr-credential-helper、华为云 CCE |

**不推荐的做法**：
- ❌ 在 VM 中执行 `docker login` 并将密码明文保存在 `~/.docker/config.json`
- ❌ 在 K8s 中创建长期有效的 `imagePullSecrets`（静态 Secret）
- ❌ 将永久 AK/SK 硬编码在 Pod 或 Node 中

---

## 2. 阿里云 ACR — ACK 免密组件

### 2.1 方案概述

阿里云 ACK 提供官方免密组件 `aliyun-acr-credential-helper`，支持在集群内自动为 Pod 注入拉取 ACR 私有镜像所需的临时凭证（Login Token），无需在 YAML 中配置 `imagePullSecrets`。

该组件有两种形态：
- **托管版**：1.22+ 集群支持，无需自行运维，推荐生产使用。
- **自行运维版**：1.20+ 集群支持，可查看日志，支持更多跨账号授权方式。

> **官方文档**：
> - [使用免密组件拉取同账号 ACR 镜像](https://help.aliyun.com/zh/acr/user-guide/non-secret-pulling-container-image)
> - [使用免密组件跨账号拉取镜像](https://help.aliyun.com/zh/acr/user-guide/use-secret-free-components-to-pull-images-across-accounts)
> - [aliyun-acr-credential-helper 组件说明](https://help.aliyun.com/zh/ack/product-overview/aliyun-acr-credential-helper)

### 2.2 同账号免密拉取（托管版）

**前置条件**：
1. 已购买 ACR 企业版实例（或个人版实例，但须为 2024 年 09 月 08 日及更早创建）。
2. TKE/ACK 集群与 ACR 实例网络互通（VPC 关联 + 内网解析）。
3. 集群版本 >= 1.22。

**操作步骤**：
1. 登录 **ACK 控制台** → 进入目标集群 → **组件管理** → **安全** 页签。
2. 找到 **aliyun-acr-credential-helper 托管** 卡片，点击 **安装**。
3. 在参数配置中填写 `AcrInstanceInfo`：
   - `InstanceId`：ACR 企业版实例 ID（个人版留空）。
   - `regionId`：实例所在地域（如 `cn-hangzhou`）。
   - `domains`：可选，指定使用的域名（默认包含公网+内网）。
4. 其他配置保持默认即可：
   - `watchNamespace`：默认 `default`，可改为 `all` 或指定命名空间。
   - `serviceAccount`：默认 `Default`。

安装完成后，组件会自动在每个被监听的命名空间中创建对应的 `imagePullSecrets`，Pod 无需显式声明即可免密拉取。

### 2.3 跨账号免密拉取（自行运维版）

自行运维版支持三种权限模式，安全性由高到低：

| 模式 | 原理 | 适用场景 |
|------|------|----------|
| **RRSA** | Pod 级别，通过 OIDC Provider + STS AssumeRole 获取临时凭证 | 生产环境、多租户、严格隔离 |
| **Worker RAM Role 扮演** | 集群 Worker RAM Role 扮演目标账号的 RAM Role | 开发测试、统一权限 |
| **RAM 用户 AK/SK** | 使用长期 AK/SK | 快速验证、Demo（不推荐生产） |

**RRSA 配置要点**（最安全）：
1. 在 ACK 集群基本信息页开启 **RRSA** 功能。
2. 在目标账号（B 账号）创建 RAM Role，信任策略允许 A 账号的 OIDC Provider 扮演。
3. 给 B 账号 RAM Role 授权最小权限：
   ```json
   {
     "Version": "1",
     "Statement": [
       {
         "Action": [
           "cr:GetAuthorizationToken",
           "cr:ListInstanceEndpoint",
           "cr:PullRepository"
         ],
         "Resource": "*",
         "Effect": "Allow"
       }
     ]
   }
   ```
4. 安装免密组件时选择 **tokenMode = workerRole** 或托管版开启 RRSA，并在 ConfigMap `acr-configuration` 中配置 `rrsaRoleARN`、`rrsaOIDCProviderRoleARN`。

### 2.4 阿里云避坑

- **坑 1**：免密组件目前**不支持 2024 年 09 月 08 日之后创建的 ACR 个人版**。如无法安装组件，请回退到手动创建 `imagePullSecrets`。
- **坑 2**：`watchNamespace` 配置为 `all` 时，组件会在**所有命名空间**（包括 `kube-system`）中注入 Secret，可能干扰系统组件的镜像拉取。建议仅配置业务命名空间。
- **坑 3**：跨地域拉取必须填写 `regionId`，否则组件默认按集群所在地域请求 ACR，会报找不到实例。
- **坑 4**：使用 **WorkerRole** 模式时，必须给集群 Worker RAM Role 授予 `cr:GetAuthorizationToken`、`cr:ListInstanceEndpoint`、`cr:PullRepository` 权限。

---

## 3. AWS ECR — EKS IAM & IRSA

### 3.1 方案概述

AWS 提供多层免密拉取方案：
1. **Node IAM Role**：EKS 工作节点自带 IAM Role，只需附加 ECR 只读策略即可实现全节点免密。
2. **IRSA (IAM Roles for Service Accounts)**：为特定 ServiceAccount 绑定 IAM Role，实现 Pod 级别细粒度免密。
3. **ECR Credential Provider**：kubelet 内置/插件式自动刷新 ECR 登录 Token（12 小时有效期）。
4. **Pull-Through Cache**：通过 ECR 缓存 Docker Hub 等公共镜像，Node 只需有 ECR 权限即可拉取。

> **官方文档**：
> - [Amazon ECR managed policies](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonEC2ContainerRegistryPullOnly.html)
> - [AWS Karpenter Issue #7956 - ECR pull-through cache permissions](https://github.com/aws/karpenter-provider-aws/issues/7956)
> - [Debugging ECR Private Pull Through Cache](https://jasonbutz.info/2025/11/debugging-ecr-private-pull-through-cache/)

### 3.2 Node IAM Role 免密（最基础）

EKS 节点的 IAM Role 默认只需附加以下托管策略之一：

**推荐（最小权限）**：
```
arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly
```
该策略包含 `ecr:BatchImportUpstreamImage`，支持 **Pull-Through Cache**。

**旧版（权限过宽）**：
```
arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```
该策略缺少 `ecr:BatchImportUpstreamImage`，且包含大量不必要的只读 API（如 `DescribeRepositories`、`GetLifecyclePolicy` 等），存在过度授权风险。**AWS 官方已推荐使用 `PullOnly` 替代 `ReadOnly`**。

> 参考：AWS CDK 已于 2026 年初将默认 Node Role 策略从 `ReadOnly` 改为 `PullOnly`。

### 3.3 IRSA 免密（细粒度）

适用于需要 **Pod 级别权限隔离** 的场景：
1. 创建 IAM Role，信任策略允许 EKS OIDC Provider。
2. IAM Policy 示例：
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ecr:GetAuthorizationToken",
           "ecr:BatchCheckLayerAvailability",
           "ecr:GetDownloadUrlForLayer",
           "ecr:BatchGetImage"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
3. 在 K8s 中给 ServiceAccount 添加注解：
   ```yaml
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: my-app-sa
     namespace: default
     annotations:
       eks.amazonaws.com/role-arn: arn:aws:iam::<account-id>:role/<role-name>
   ```
4. Pod 引用该 ServiceAccount 即可。

### 3.4 ECR Pull-Through Cache 权限

如果使用了 ECR Pull-Through Cache（缓存 Docker Hub / GHCR / Quay 等公共镜像），Node Role 或 IRSA 必须额外包含：
- `ecr:BatchImportUpstreamImage`（从上游拉取并缓存镜像）
- `ecr:CreateRepository`（自动在 ECR 中创建对应仓库）

缺失这两个权限会导致：
- 镜像首次拉取时 403 / unauthorized
- 已缓存镜像可以正常拉取，但新 tag 无法自动同步

### 3.5 AWS 避坑

- **坑 1**：EKS Node Role 使用旧版 `AmazonEC2ContainerRegistryReadOnly` 会导致 Pull-Through Cache 失败，且权限过宽。请立即切换到 `AmazonEC2ContainerRegistryPullOnly`。
- **坑 2**：IRSA 的 IAM Role 信任策略中的 `sub` 必须精确匹配 `system:serviceaccount:<namespace>:<sa-name>`，一个空格或大小写错误都会导致 AssumeRole 失败。
- **坑 3**：如果 Pod 使用了 IRSA，但镜像仓库是 **Cross-Account ECR**，需要同时在目标账号的 ECR Repository Policy 中允许源账号的 IAM Role 访问。
- **坑 4**：ECR 的 `GetAuthorizationToken` 是全局 API（Resource 为 `*`），但 `BatchGetImage` 等操作可以限定到具体 Repository ARN。建议按最小权限拆分策略。

---

## 4. Azure ACR — AKS Managed Identity

### 4.1 方案概述

Azure 推荐通过 **Managed Identity**（托管身份）实现 AKS 对 ACR 的免密拉取。该方式无需管理密码，无 Secret 泄露风险，且支持自动轮换。

支持两种身份类型：
- **System-assigned managed identity**：由 AKS 自动创建并管理，生命周期与集群绑定。
- **User-assigned managed identity**：由用户独立创建，可跨多个资源复用，**推荐**。

> **官方文档**：
> - [Authenticate with Azure Container Registry (ACR) from Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/cluster-container-registry-integration)
> - [Azure Container Apps image pull with managed identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull)

### 4.2 AKS 集成 ACR（自动模式）

最简单的方式：
```bash
# 将 ACR 附加到 AKS 集群（自动配置 kubelet identity 权限）
az aks update \
  --name myAKSCluster \
  --resource-group myResourceGroup \
  --attach-acr myRegistry
```

该命令会自动给 AKS 的 **kubelet managed identity** 授予目标 ACR 的 `AcrPull` 角色。

### 4.3 使用 User-Assigned Managed Identity（推荐）

适用于多集群共享身份、或需要更细粒度控制的场景：

```bash
# 1. 创建用户分配托管身份
az identity create \
  --resource-group myResourceGroup \
  --name acr-pull-identity

IDENTITY_ID=$(az identity show --resource-group myResourceGroup --name acr-pull-identity --query id -o tsv)
IDENTITY_CLIENT_ID=$(az identity show --resource-group myResourceGroup --name acr-pull-identity --query clientId -o tsv)
IDENTITY_PRINCIPAL_ID=$(az identity show --resource-group myResourceGroup --name acr-pull-identity --query principalId -o tsv)

# 2. 获取 ACR 资源 ID 并授权
ACR_ID=$(az acr show --name myRegistry --resource-group myResourceGroup --query id -o tsv)
az role assignment create \
  --assignee $IDENTITY_PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull

# 3. 将身份分配给 AKS Agent Pool
az aks update \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --enable-managed-identity \
  --assign-identity $IDENTITY_ID
```

### 4.4 启用 ARM Token 认证（关键步骤）

从 2024 年起，部分 ACR 实例默认关闭了 **ARM audience token** 认证。使用 Managed Identity 拉取镜像前，必须确保该功能已开启：

```bash
# 检查当前状态
az acr config authentication-as-arm show -r myRegistry

# 如未开启，请执行
az acr config authentication-as-arm update -r myRegistry --status enabled
```

如果未开启，Pod 拉取镜像时会报 `unauthorized: authentication required`，即使 IAM 权限配置完全正确。

### 4.5 Azure 避坑

- **坑 1**：**ACR 的 ARM Token 认证未开启** 是使用 Managed Identity 失败的最常见原因。务必执行 `az acr config authentication-as-arm update --status enabled`。
- **坑 2**：使用 `az aks update --attach-acr` 时，如果 AKS 使用的是 **Service Principal**（旧版集群）而非 Managed Identity，该命令会失败。需要先升级集群到 Managed Identity 模式。
- **坑 3**：跨 Azure AD Tenant 拉取 ACR 镜像时，AKS 的默认 kubelet identity 无法直接跨租户认证。此时需要在目标租户中创建 **Multi-tenant Service Principal**，并更新 AKS 凭据。详见微软官方跨租户文档。
- **坑 4**：Azure Container Apps 使用 Managed Identity 拉镜像时，必须在容器组配置中显式指定 `imageRegistryCredentials.identity`，否则不会生效。

---

## 5. GCP Artifact Registry — GKE Workload Identity

### 5.1 方案概述

GCP 推荐 GKE 集群使用 **Workload Identity Federation**（以前叫 Workload Identity）实现 Pod 级别对 Artifact Registry / Container Registry 的免密访问。

- **同 Project**：GKE 节点默认服务账号（Compute Engine default SA）通常自动具有 `roles/artifactregistry.reader`，同项目下可直接拉取。
- **跨 Project / 细粒度控制**：使用 Workload Identity 将 K8s ServiceAccount 映射到 GCP ServiceAccount。

> **官方文档**：
> - [Authenticate Docker with Google Artifact Registry](https://cloud.google.com/artifact-registry/docs/docker/authentication)
> - [GKE Workload Identity Federation](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
> - [k8s-digester Workload Identity docs](https://github.com/google/k8s-digester/blob/main/docs/workload-identity.md)

### 5.2 同 Project 免密（Node SA 自动权限）

如果 GKE 集群与 Artifact Registry 在同一 GCP Project，通常无需额外配置：
1. GKE 节点默认使用 Compute Engine Service Account。
2. 该 SA 默认具有 Project 级别的 Editor 权限，包含 Artifact Registry Reader。
3. Pod 可直接拉取镜像：`us-central1-docker.pkg.dev/<project>/<repo>/<image>:<tag>`。

**安全建议**：即使同项目，也应给节点配置**自定义服务账号**并仅授予 `roles/artifactregistry.reader`，避免使用默认 Editor 权限。

```bash
# 为节点池指定最小权限 SA
gcloud container node-pools create secure-pool \
  --cluster=my-cluster \
  --service-account=gke-node-reader@<project>.iam.gserviceaccount.com
```

### 5.3 跨 Project / Pod 级别免密（Workload Identity）

**步骤 1**：创建 GCP ServiceAccount
```bash
export PROJECT_ID=$(gcloud config get-value project)
export GSA_NAME=gar-puller
gcloud iam service-accounts create $GSA_NAME \
  --display-name="GAR Puller"
```

**步骤 2**：授予 Artifact Registry 读取权限（可跨项目授权）
```bash
gcloud artifacts repositories add-iam-policy-binding my-repo \
  --location=us-central1 \
  --member="serviceAccount:$GSA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader" \
  --project=<image-project>
```

**步骤 3**：绑定到 K8s ServiceAccount
```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$GSA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --member="serviceAccount:$PROJECT_ID.svc.id.goog[default/my-app-sa]" \
  --role="roles/iam.workloadIdentityUser"
```

**步骤 4**：给 K8s SA 添加注解
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: default
  annotations:
    iam.gke.io/gcp-service-account: gar-puller@<project>.iam.gserviceaccount.com
```

### 5.4 GCP 避坑

- **坑 1**：GCR (Google Container Registry) 已于 **2024 年起逐步弃用**，预计 2025 年后不再接受新功能。新项目请直接使用 **Artifact Registry** (`REGION-docker.pkg.dev`)。
- **坑 2**：Workload Identity 要求 GKE 集群在创建时开启 `--workload-pool=$PROJECT_ID.svc.id.goog`。如果旧集群未开启，需要**重建集群**才能使用（无法热升级开启）。
- **坑 3**：`gcloud iam service-accounts add-iam-policy-binding` 中的成员格式必须严格为 `serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/SA_NAME]`，方括号和斜杠不能错。
- **坑 4**：如果 Pod 使用了 Workload Identity，但镜像本身也在 Artifact Registry，请确保该 GCP SA 被授予的是 `roles/artifactregistry.reader`（或更细粒度），而非 `roles/containerregistry.ServiceAgent`（后者仅适用于旧版 GCR）。

---

## 6. 腾讯云 TCR — TKE TCR Addon

### 6.1 方案概述

腾讯云 TKE 提供官方 TCR Addon 插件，安装后可在指定命名空间内自动注入 `imagePullSecrets`，实现内网免密拉取 TCR 企业版私有镜像。

> **官方文档**：
> - [TKE 集群使用 TCR 插件内网免密拉取容器镜像](https://cloud.tencent.com/document/product/1141/48184)
> - [TCR Addon 说明](https://cloud.tencent.com/document/product/457/49225)
> - [容器集群如何免密拉取镜像](https://cloud.tencent.com/developer/ask/2097086)

### 6.2 安装与配置

**前置条件**：
- 已购买 TCR 企业版实例。
- 已创建 TKE 标准集群（版本 >= 1.14，建议 >= 1.12）。
- TKE 集群 VPC 已关联到 TCR 实例，并配置内网域名解析。

**操作步骤**：
1. 登录 **TCR 控制台** → 访问控制 → 内网访问 → 关联集群所在 VPC → 配置自动解析（推荐 PrivateDNS）。
2. 登录 **TKE 控制台** → 目标集群 → **组件管理** → 安装 **TCR** 插件。
3. 在参数配置中勾选 **启用内网解析功能**（如 PrivateDNS 未覆盖该地域）。
4. 插件安装完成后，集群即具备免密拉取能力。

### 6.3 工作负载部署注意事项

创建工作负载时：
- **镜像访问凭证**：如果已安装 TCR 插件，**不要选择任何凭证**，保持为空即可实现免密拉取。
- 如果手动选择了其他 `imagePullSecrets`，可能覆盖插件自动注入的 Secret，导致免密失效。

### 6.4 腾讯云避坑

- **坑 1**：TCR 插件目前**仅支持 TCR 企业版**，个人版不支持免密组件。个人版用户只能手动配置 `imagePullSecrets` 或设置命名空间为公开。
- **坑 2**：如果 TKE 集群与 TCR 实例**跨地域**，必须确保内网访问链路打通（VPC 对等连接 / 云联网），并在插件参数中正确填写实例地域。
- **坑 3**：插件启用内网解析后，会通过 DaemonSet `hosts-updater` 修改节点 `/etc/hosts`。如果节点已有自定义 hosts 管理工具，可能发生冲突。
- **坑 4**：TCR 企业版默认拒绝全部外部访问，**未关联 VPC 前任何拉取都会超时/拒绝**。很多用户误以为插件安装失败，实际是网络访问控制未放行。

---

## 7. 华为云 SWR — CCE 节点委托 & Credential Provider

### 7.1 方案概述

华为云 CCE 提供两种免密拉取 SWR 私有镜像的方案：
1. **节点委托（Node Agency）**：通过给节点池配置 IAM 委托（Agency），kubelet 内置的 Credential Provider 自动获取临时凭证。无需 `imagePullSecrets`。
2. **default-secret 绑定 ServiceAccount**：传统方式，将 CCE 默认的 `default-secret` 关联到 ServiceAccount，实现命名空间级别的"伪免密"。

> **官方文档**：
> - [CCE 配置镜像免密下载](https://support.huaweicloud.com/usermanual-cce/cce_10_1091.html)
> - [CCE 免密拉取 SWR 基础版镜像](https://support.huaweicloud.com/bestpractice-swr/swr_bestpractice_0109.html)

### 7.2 节点委托方式（最新推荐）

**约束**：CCE 集群版本 >= v1.28.15-r70 / v1.29.15-r30 / v1.30.14-r30 / v1.31.10-r30 / v1.32.6-r30 / v1.33.5-r20 / v1.34.1-r0

**步骤 1：创建委托并授权**
1. 登录 **IAM 控制台** → 委托 → 创建委托。
2. 委托类型选择 **云服务**，授权给 **弹性云服务器 ECS / 裸金属服务器 BMS**。
3. 为委托授予 SWR 权限：
   - **SWR 基础版**：
     - `swr:repo:download`
     - `swr:system:createLoginSecret`
   - **SWR 企业版**：
     - `swr:repository:downloadArtifact`
     - `swr:instance:createTempCredential`
     - `swr:instance:list`

**步骤 2：节点池绑定委托**
1. 进入 CCE 控制台 → 目标集群 → 节点池。
2. 创建/编辑节点池 → 高级配置 → 委托 → 选择刚才创建的委托。
3. 保存后，**已有节点不会自动生效**，需跳转到 ECS 控制台手动为已有节点关联委托。

**步骤 3：开启 kubelet 镜像免密下载**
1. 节点池列表 → 点击节点池名称后的 **更多 → 配置管理**。
2. 在 **kubelet 组件配置** 中开启 `enable-swr-credential-provider`。
3. 确认后，kubelet 会重启，该节点池内所有节点逐步生效。

**验证**：在已配置节点池中创建工作负载，**不配置 `imagePullSecrets`**，Pod 应能正常拉取 SWR 私有镜像。

### 7.3 default-secret 绑定方式（兼容旧版）

适用于旧版本集群或不支持节点委托的场景：

```bash
# 1. 创建 ServiceAccount
kubectl create serviceaccount swr-service-account -n test-namespace

# 2. 将 default-secret 关联到 SA
kubectl patch serviceaccount swr-service-account -n test-namespace \
  -p '{"imagePullSecrets": [{"name": "default-secret"}]}'
```

然后在 Deployment 中显式指定 `serviceAccountName: swr-service-account`。

### 7.4 华为云避坑

- **坑 1**：节点池**更新委托对已有节点不生效**。很多用户修改节点池委托后，发现旧节点仍然拉取失败，原因是没有手动到 ECS 控制台为旧节点关联新委托。
- **坑 2**：开启 `enable-swr-credential-provider` 会**触发 kubelet 重启**。建议在业务低峰期执行，否则节点上的 Pod 会短暂中断。
- **坑 3**：如果委托过期（非永久委托），节点池的镜像免密功能会**突然失效**，且不会提前告警。建议创建永久委托。
- **坑 4**：基础版和企业版 SWR 的权限 Action 名称完全不同（`swr:repo:download` vs `swr:repository:downloadArtifact`）。授权时请根据实例类型选择正确的 Policy，混用会导致 403。

---

## 8. Kubernetes 未来趋势：KEP-4412

### 8.1 什么是 KEP-4412？

**KEP-4412: Projected Service Account Tokens for Kubelet Image Credential Providers**

这是 Kubernetes 社区正在推进的一项重大安全增强，旨在彻底消除镜像拉取阶段对长期密码/Secret 的依赖。

> **官方文档**：
> - [KEP-4412 GitHub](https://github.com/kubernetes/enhancements/blob/master/keps/sig-auth/4412-projected-service-account-tokens-for-kubelet-image-credential-providers/README.md)
> - [Kubernetes v1.34 Beta Release Blog](https://kubernetes.io/blog/2025/08/27/kubernetes-v1-34-release/)
> - [Kubernetes 1.33 Fixes a 10-Year-Old Image Pull Loophole](https://blog.abhimanyu-saharan.com/posts/kubernetes-v1-33-fixes-a-10-year-old-image-pull-loophole)

### 8.2 核心机制

传统模式下，kubelet 通过以下两种方式获取镜像凭证：
1. `imagePullSecrets`（长期 Secret，存储在 API Server 中）
2. Node 级别的 Credential Provider（全节点共享权限）

KEP-4412 引入第三种方式：
- kubelet 在拉取镜像前，为**具体 Pod 的 ServiceAccount 生成一个短期的、audience-bound 的 Projected Token**（类似 OIDC ID Token）。
- 将该 Token 传递给云厂商的 Credential Provider 插件。
- 插件用此 Token 向云厂商身份服务（如 AWS STS、Azure Entra ID、GCP IAM）**交换临时的、Pod 级别的镜像拉取凭证**。

### 8.3 带来的变革

| 维度 | 传统方式 | KEP-4412 新方式 |
|------|----------|-----------------|
| 凭证生命周期 | 长期（Secret / Node Token） | 短期（Pod 启动时生成，自动轮换） |
| 权限粒度 | Node 级别或 Namespace 级别 | **Pod / ServiceAccount 级别** |
| 安全隔离 | 差，一个节点被攻破可拉取所有镜像 | 好，Pod A 的 Token 无法用于拉取 Pod B 的镜像 |
| Secret 管理 | 需手动创建、轮换 `imagePullSecrets` | **零 Secret** |
| 合规性 | 难以满足禁止长期凭证的策略 | 天然满足 |

### 8.4 当前状态（截至 2025 年底 / 2026 年初）

- **Kubernetes v1.33**：KEP-4412 进入 **Alpha**。
- **Kubernetes v1.34**：进入 **Beta**，默认启用 `KubeletServiceAccountTokenForCredentialProviders` Feature Gate。
- **Kubernetes v1.35+ / v1.36**：预计 GA（稳定版）。

配合的另一个 Feature Gate：
- `ServiceAccountNodeAudienceRestriction`（v1.32 Beta，默认启用）：限制 kubelet 只能为特定的 audience 请求 ServiceAccount Token，防止滥用。

### 8.5 对云厂商的影响

各大云厂商正在跟进适配 KEP-4412：
- **AWS**：未来 EKS 的 ECR Credential Provider 将支持 Pod-level IRSA Token 用于镜像拉取。
- **Azure**：AKS 正在研发基于 Microsoft Entra Workload ID 的镜像拉取（预计 2026 Q1 发布）。
- **GCP**：GKE 的 Workload Identity 已具备类似能力，KEP-4412 将进一步标准化该流程。
- **JFrog / 私有仓库**：第三方 Credential Provider 也在跟进支持 PSAT（Projected Service Account Token）。

### 8.6 如何提前试用

如果你使用的是 Kubernetes v1.34+ 集群，可以尝试开启 Feature Gate：

```bash
# kubelet 启动参数
--feature-gates=KubeletServiceAccountTokenForCredentialProviders=true
```

同时需要在 kubelet 的 Credential Provider 配置中新增 `tokenAttributes` 字段：

```yaml
# /etc/kubernetes/credential-provider-config.yaml 示例
apiVersion: kubelet.config.k8s.io/v1
kind: CredentialProviderConfig
providers:
  - name: ecr-credential-provider
    matchImages:
      - "*.dkr.ecr.*.amazonaws.com"
    defaultCacheDuration: "12h"
    apiVersion: credentialprovider.kubelet.k8s.io/v1
    tokenAttributes:
      serviceAccountTokenAudience: "sts.amazonaws.com"
      cacheType: "ServiceAccount"
      requireServiceAccount: true
```

> **注意**：Alpha/Beta 功能不建议直接用于生产环境，建议先在测试集群验证。

---

## 9. 通用避坑指南

### 9.1 网络连通性优先

所有免密方案都建立在**节点与镜像仓库网络互通**的基础上。常见错误：
- 安全组 / NACL 未放行 443 端口到镜像仓库域名。
- 内网 DNS 解析未配置（ACR 的 PrivateDNS、TCR 的 VPC 解析）。
- 跨地域/跨 VPC 未建立对等连接 / 云联网 / Transit Gateway。

**排查命令**：
```bash
# 从 Node 上测试连通性和解析
curl -v https://<registry-endpoint>/v2/
nslookup <registry-endpoint>
```

### 9.2 区分 "Node 能拉" 和 "Pod 能拉"

- **Node 级别权限**：IAM Role / 节点委托赋予的是 kubelet（Docker/containerd）的权限。如果 Pod 使用 `imagePullSecrets`，可能会覆盖 Node 权限。
- **Pod 级别权限**：IRSA / Workload Identity 只作用于引用了特定 ServiceAccount 的 Pod。如果 Pod 使用默认 `default` SA，可能无法生效。

**排查方法**：
```bash
# 查看 Pod 使用的 ServiceAccount
kubectl get pod <pod-name> -o jsonpath='{.spec.serviceAccountName}'

# 查看 Pod 的 imagePullSecrets
kubectl get pod <pod-name> -o jsonpath='{.spec.imagePullSecrets}'
```

### 9.3 缓存与镜像策略的陷阱

Kubernetes v1.33 起引入了 `KubeletEnsureSecretPulledImages` 特性（计划 Beta 于 v1.34）。

**这意味着什么？**
- 以前：如果镜像已在节点本地缓存（`imagePullPolicy: IfNotPresent`），即使新 Pod 没有权限，kubelet 也可能允许其运行（因为不再向仓库发起拉取请求）。
- v1.33+：kubelet 会**始终校验** Pod 是否拥有有效的拉取凭证，即使镜像已缓存。凭证不匹配时，会尝试重新拉取或拒绝启动。

**影响**：
- 以前靠"缓存绕过权限检查"的漏洞被修复。
- 如果你升级了 K8s 到 v1.33+，突然发现某些 Pod 无法启动，很可能是因为它们缺少 `imagePullSecrets` 或节点 IAM 权限配置不完整。

### 9.4 镜像仓库域名匹配

无论是 Credential Helper 还是 `imagePullSecrets`，Docker/containerd 都是**按域名精确匹配**的。

例如：
- 配置了 `*.dkr.ecr.us-west-2.amazonaws.com`
- 但镜像地址写的是 `<account>.dkr.ecr.us-west-2.amazonaws.com.cn`（中国区域域名不同）
- 或者镜像写的是 `public.ecr.aws/xxx`

都会导致匹配失败，kubelet 不会调用对应的 Credential Provider。

**建议**：在配置 Credential Provider 的 `matchImages` 时，尽量覆盖所有可能使用的域名后缀。

### 9.5 临时凭证的 TTL 与缓存

各大云厂商的临时 Token 都有有效期：
- AWS ECR：`12 小时`
- Azure ACR：Managed Identity Token 通常 `24 小时`
- 阿里云 ACR：免密组件默认 `15 分钟` 过期阈值前刷新
- 华为云 SWR：由 Credential Provider 自动刷新

如果 Credential Provider 插件崩溃或 kubelet 无法连接 API Server，可能导致临时凭证无法刷新，进而出现**间歇性镜像拉取失败**。

**监控建议**：
- 监控 `ImagePullBackOff` 事件。
- 监控 Credential Provider Pod（如阿里云的 `tcr-assistant-controller-manager`、华为云的 kubelet 日志）的运行状态。

---

## 10. 参考文档

### 阿里云
- [使用免密组件拉取同账号 ACR 镜像](https://help.aliyun.com/zh/acr/user-guide/non-secret-pulling-container-image)
- [使用免密组件跨账号拉取镜像](https://help.aliyun.com/zh/acr/user-guide/use-secret-free-components-to-pull-images-across-accounts)
- [aliyun-acr-credential-helper 组件说明](https://help.aliyun.com/zh/ack/product-overview/aliyun-acr-credential-helper)

### AWS
- [AmazonEC2ContainerRegistryPullOnly Managed Policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonEC2ContainerRegistryPullOnly.html)
- [AmazonEC2ContainerRegistryReadOnly Managed Policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonEC2ContainerRegistryReadOnly.html)
- [EKS IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [ECR Pull Through Cache Rules](https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html)
- [AWS Karpenter #7956 - ECR PTC Permissions](https://github.com/aws/karpenter-provider-aws/issues/7956)

### Azure
- [Authenticate with ACR from AKS](https://learn.microsoft.com/en-us/azure/aks/cluster-container-registry-integration)
- [Azure Container Apps image pull with managed identity](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull)
- [Pull images from ACR to AKS in a different Microsoft Entra tenant](https://learn.microsoft.com/en-us/azure/aks/cluster-container-registry-integration?tabs=azure-cli#authenticate-using-a-service-principal-in-a-different-azure-ad-tenant)
- [ACR authentication-as-arm](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-as-arm)

### GCP
- [Artifact Registry Docker authentication](https://cloud.google.com/artifact-registry/docs/docker/authentication)
- [GKE Workload Identity Federation](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [Google k8s-digester Workload Identity docs](https://github.com/google/k8s-digester/blob/main/docs/workload-identity.md)

### 腾讯云
- [TKE 集群使用 TCR 插件内网免密拉取容器镜像](https://cloud.tencent.com/document/product/1141/48184)
- [TCR Addon 说明](https://cloud.tencent.com/document/product/457/49225)

### 华为云
- [CCE 配置镜像免密下载](https://support.huaweicloud.com/usermanual-cce/cce_10_1091.html)
- [CCE 免密拉取 SWR 基础版镜像](https://support.huaweicloud.com/bestpractice-swr/swr_bestpractice_0109.html)

### Kubernetes 社区
- [KEP-4412: Projected service account tokens for Kubelet image credential providers](https://github.com/kubernetes/enhancements/blob/master/keps/sig-auth/4412-projected-service-account-tokens-for-kubelet-image-credential-providers/README.md)
- [Kubernetes v1.34 Release Notes - Beta: Projected ServiceAccount tokens](https://kubernetes.io/blog/2025/08/27/kubernetes-v1-34-release/)
- [Kubernetes v1.33: From Secrets to Service Accounts](https://kubernetes.io/blog/2025/05/07/kubernetes-v1-33-wi-for-image-pulls/)
- [Kubernetes 1.33 Fixes a 10-Year-Old Image Pull Loophole](https://blog.abhimanyu-saharan.com/posts/kubernetes-v1-33-fixes-a-10-year-old-image-pull-loophole)

---

> **最后更新**：2026 年 4 月
>
> 建议收藏本指南，各大云厂商的 Credential Provider 和 Kubernetes KEP-4412 仍在快速演进中，将持续更新最佳实践。
