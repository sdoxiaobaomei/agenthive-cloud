> ⚠️ **v0.9 批量模板** — 此 skill 为初始化时批量生成，非实战沉淀。内容可能不完整或存在编码损坏。执行相关 Ticket 后应逐步替换为实战验证版本。

# Pattern: 瀹夊叏瀹瑰櫒閰嶇疆

Dockerfile:
```dockerfile
FROM gcr.io/distroless/java21-debian12:nonroot
COPY --chown=nonroot:nonroot target/app.jar /app.jar
USER nonroot
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

K8s SecurityContext:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: [ALL]
  seccompProfile:
    type: RuntimeDefault
```
