> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: Secret 绠＄悊

绂佹鏄庢枃 Secret:
```yaml
# 閿欒
stringData:
  password: mypassword123
```

姝ｇ‘ 鈥?External Secrets Operator:
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-password
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: alicloud-kms
  target:
    name: db-password-secret
  data:
    - secretKey: password
      remoteRef:
        key: agenthive-prod-db-password
```
