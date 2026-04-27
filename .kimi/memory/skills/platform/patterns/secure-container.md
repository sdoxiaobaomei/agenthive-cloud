# Pattern: 安全容器配置

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
