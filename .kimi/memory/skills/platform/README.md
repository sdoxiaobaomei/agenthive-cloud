# Platform Agent — Procedural Memory / Skills

可复用的 K8s/Terraform/DevOps 模式、配置模板、问题解决方案。
由 Curator 步骤在任务完成后自动更新。

## 当前技能库

### [Pattern] Kustomize 多环境配置
```yaml
# 文件: patterns/kustomize-multi-env.md
```

### [Pattern] Terraform 模块设计
```hcl
// 文件: patterns/terraform-module.md
```

### [Fix] Pod OOMKilled 排查
```
// 文件: fixes/oomkilled-troubleshoot.md
```

## 添加新技能

当任务中发现新的可复用模式时：
1. 在对应目录创建 `.md` 文件
2. 使用 `## [Pattern|Fix|Snippet] 标题` 格式
3. 包含：场景描述、代码示例、注意事项
