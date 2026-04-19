# 共享模块与跨云最佳实践

> 本目录存放跨云通用的 IaC 模块、策略模板和工具配置。

---

## 跨云资源对照表

当团队需要在多个云厂商之间保持架构一致性时，可参考下表进行资源映射：

| 资源类型 | AWS | Azure | 阿里云 |
|----------|-----|-------|--------|
| **虚拟网络** | VPC | VNet | VPC |
| **子网** | Subnet | Subnet | VSwitch |
| **安全组** | Security Group | NSG | Security Group |
| **负载均衡** | ALB / NLB | Application Gateway / Load Balancer | SLB / ALB |
| **容器编排** | EKS | AKS | ACK |
| **无服务器容器** | ECS Fargate | Container Apps | SAE (Serverless 应用引擎) |
| **函数计算** | Lambda | Azure Functions | 函数计算 FC3 |
| **关系型数据库** | RDS (PostgreSQL) | Azure Database for PostgreSQL | RDS PostgreSQL |
| **缓存** | ElastiCache (Redis) | Azure Cache for Redis | 云数据库 Redis |
| **对象存储** | S3 | Blob Storage | OSS |
| **跨账户网络** | Transit Gateway + RAM | VNet Peering / VWAN | CEN (云企业网) |
| **密钥管理** | KMS / Secrets Manager | Azure Key Vault | KMS |
| **CI/CD** | CodePipeline / GitHub Actions | Azure DevOps / GitHub Actions | 云效 / GitHub Actions |
| **IaC 模板服务** | CloudFormation | ARM / Bicep | ROS |

---

## CI/CD 流水线模板 (GitHub Actions)

### Terraform 通用流水线

```yaml
name: Terraform CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.14.7"
      - name: Terraform Format
        run: terraform fmt -check -recursive
      - name: Terraform Init
        run: terraform init
      - name: Terraform Validate
        run: terraform validate
      - name: Security Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: '.'
      - name: Terraform Plan
        run: terraform plan -no-color
```

### Bicep 通用流水线

```yaml
name: Bicep CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  bicep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Bicep Build
        run: az bicep build --file azure/bicep/main.bicep
      - name: What-If Deployment
        run: |
          az deployment group what-if \
            --resource-group rg-demo \
            --template-file azure/bicep/main.bicep \
            --parameters environment=dev
```

### CDK 通用流水线

```yaml
name: CDK CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  cdk:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx cdk synth
      - run: npx cdk-nag
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-southeast-1
      - run: npx cdk diff
```

---

## 安全扫描工具速查

| 工具 | 支持格式 | 用途 |
|------|----------|------|
| `tflint` | Terraform | 语法和最佳实践检查 |
| `checkov` | Terraform/CloudFormation/Bicep/ARM | 安全与合规扫描 |
| `tfsec` / `trivy` | Terraform | 安全配置扫描 |
| `cdk-nag` | AWS CDK | CDK 合规检查 |
| `cfn-guard` | CloudFormation | AWS 策略即代码 |
| `cfn-lint` | CloudFormation | 模板验证 |
| `az bicep build` | Bicep | 编译和语法检查 |
| `az deployment group what-if` | Bicep/ARM | 部署前变更预览 |
| `terraform plan` | Terraform | 执行计划预览 |

## 场景化部署建议

### Serverless 场景
- **阿里云**: 使用 `alicloud_fcv3_function` + `alicloud_fcv3_trigger`，配合 OSS 事件触发实现自动化处理
- **Azure**: 使用 Container Apps 实现零到 N 副本的容器自动扩缩，避免管理 K8s 控制平面
- **AWS**: Lambda + API Gateway 适合短时请求；ECS Fargate 适合需要长时间运行容器的场景

### 多环境管理
- **Terraform**: 使用 `terraform workspace` + `local` 映射表实现环境隔离，配合远程后端保证状态安全
- **Bicep**: 使用 `.bicepparam` 参数文件分离环境配置，通过 `what-if` 预览后再部署
- **CDK**: 使用 Stack 分离或 Context 注入实现环境差异化

### 网络隔离
- 生产环境务必使用 **Hub-Spoke** 或 **CEN 多 VPC** 架构，将数据库等资源置于私有子网
- 跳板机/堡垒机应部署在独立的 Management VPC/Hub 中，通过最小权限安全组访问生产环境
