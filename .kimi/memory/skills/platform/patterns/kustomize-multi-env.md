# Pattern: Kustomize 多环境

```
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── dev/
    ├── staging/
    └── prod/
        ├── hpa.yaml
        ├── pdb.yaml
        └── kustomization.yaml
```

GitOps: 所有变更通过 PR 合并到 main，禁止手动 kubectl apply 到生产环境
