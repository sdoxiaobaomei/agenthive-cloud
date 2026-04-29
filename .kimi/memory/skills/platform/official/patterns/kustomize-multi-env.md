> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Kustomize 澶氱幆澧?

```
k8s/
鈹溾攢鈹€ base/
鈹?  鈹溾攢鈹€ deployment.yaml
鈹?  鈹溾攢鈹€ service.yaml
鈹?  鈹斺攢鈹€ kustomization.yaml
鈹斺攢鈹€ overlays/
    鈹溾攢鈹€ dev/
    鈹溾攢鈹€ staging/
    鈹斺攢鈹€ prod/
        鈹溾攢鈹€ hpa.yaml
        鈹溾攢鈹€ pdb.yaml
        鈹斺攢鈹€ kustomization.yaml
```

GitOps: 鎵€鏈夊彉鏇撮€氳繃 PR 鍚堝苟鍒?main锛岀姝㈡墜鍔?kubectl apply 鍒扮敓浜х幆澧?
