# Kubernetes Best Practices

> Official Kubernetes best practices for deploying and managing containerized applications.
> Source: https://kubernetes.io/docs/concepts/

---

## Overview

This skill provides official Kubernetes best practices for:
- Deployment configuration
- Service and Ingress setup
- ConfigMaps and Secrets
- Resource management
- Health checks and probes
- Security contexts
- Scaling and HPA

---

## 1. Deployment Configuration (MUST USE)

### Basic Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
  namespace: default
  labels:
    app: myapp
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
        version: v1
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: app
        image: myregistry/myapp:v1.0.0
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
```

### Key Points
- Always set resource requests and limits
- Use liveness and readiness probes
- Run as non-root user
- Use specific image tags, never `latest`

---

## 2. Service Configuration

### ClusterIP (Internal)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-service
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
```

### NodePort (External Access)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-nodeport
  namespace: default
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 3000
    nodePort: 30080
```

### LoadBalancer (Cloud)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-lb
  namespace: default
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - name: http
    port: 80
    targetPort: 3000
```

---

## 3. Ingress Configuration

### Basic Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 80
```

### Path-Based Routing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
```

---

## 4. ConfigMaps and Secrets

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DATABASE_HOST: "postgres"
  database.properties: |
    host=postgres
    port=5432
    name=mydb
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: default
type: Opaque
data:
  # echo -n 'secret-value' | base64
  database-password: c2VjcmV0LXZhbHVl
  api-key: bXktYXBpLWtleQ==
```

### Using ConfigMap and Secret in Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        # From ConfigMap
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
        # From Secret
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-password
        # Mount ConfigMap as file
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: app-config
```

---

## 5. Resource Management

### Resource Requests and Limits

```yaml
resources:
  requests:
    memory: "256Mi"      # Guaranteed memory
    cpu: "250m"          # 0.25 CPU cores
  limits:
    memory: "512Mi"      # Max memory (OOM if exceeded)
    cpu: "1000m"         # 1 CPU core (throttled if exceeded)
```

### Quality of Service Classes

| QoS Class | Requirements | Eviction Priority |
|-----------|-------------|-------------------|
| Guaranteed | Limits = Requests, for all resources | Last |
| Burstable | Limits ≠ Requests, or some resources set | Middle |
| BestEffort | No limits or requests set | First |

```yaml
# Guaranteed QoS
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "256Mi"  # Same as request
    cpu: "250m"      # Same as request
```

---

## 6. Health Checks and Probes

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
    httpHeaders:
    - name: Custom-Header
      value: liveness
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Startup Probe

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 30  # 30 * 5 = 150 seconds max
```

### Probe Types

```yaml
# HTTP GET
livenessProbe:
  httpGet:
    path: /health
    port: 3000

# TCP Socket
livenessProbe:
  tcpSocket:
    port: 3306

# Command execution
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy
```

---

## 7. Horizontal Pod Autoscaler (HPA)

### CPU-Based Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Custom Metrics

```yaml
metrics:
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "100"
```

---

## 8. Security Best Practices

### Pod Security Context

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
```

### Container Security Context

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
    add:
    - NET_BIND_SERVICE
  seccompProfile:
    type: RuntimeDefault
```

### Network Policy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: myapp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
```

---

## 9. StatefulSet for Databases

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: myapp
        - name: POSTGRES_USER
          value: dbuser
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: password
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

---

## 10. Common Commands

### Apply Configuration

```bash
# Apply a file
kubectl apply -f deployment.yaml

# Apply a directory
kubectl apply -f ./k8s/

# Apply with kustomize
kubectl apply -k ./k8s/overlays/production
```

### Check Status

```bash
# Pod status
kubectl get pods -n default

# Deployment status
kubectl get deployments -n default

# Detailed pod info
kubectl describe pod <pod-name>

# Pod logs
kubectl logs -f <pod-name>

# Events
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Debugging

```bash
# Execute into pod
kubectl exec -it <pod-name> -- /bin/sh

# Port forward
kubectl port-forward pod/<pod-name> 8080:3000

# Check resource usage
kubectl top pod
kubectl top node
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment app-deployment --replicas=5

# Rolling restart
kubectl rollout restart deployment/app-deployment

# Check rollout status
kubectl rollout status deployment/app-deployment

# Rollback
kubectl rollout undo deployment/app-deployment
```

---

## 11. Complete Application Example

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
type: Opaque
data:
  database-url: <base64-encoded>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: api
        image: myapp/api:v1.0.0
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: production
spec:
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 80
```

---

## References

- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [ConfigMaps and Secrets](https://kubernetes.io/docs/concepts/configuration/)
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)

---

## Version

Last Updated: 2026-04-07
Based on: Kubernetes Documentation (kubernetes.io) v1.29+
