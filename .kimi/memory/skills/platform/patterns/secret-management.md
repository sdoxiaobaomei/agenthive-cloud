# Pattern: Secret 管理

禁止明文 Secret:
```yaml
# 错误
stringData:
  password: mypassword123
```

正确 — External Secrets Operator:
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
