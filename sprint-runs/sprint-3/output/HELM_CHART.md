# Helm Chart for AgentHive

**Auto-generated**: 2026-03-31  
**Sprint**: 3  
**Status**: ✅ Completed

---

## Chart Structure

```
deploy/helm/agenthive/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-production.yaml
└── templates/
    ├── _helpers.tpl
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secret.yaml
    ├── web-deployment.yaml
    ├── web-service.yaml
    ├── web-ingress.yaml
    ├── supervisor-deployment.yaml
    ├── supervisor-service.yaml
    ├── redis.yaml
    ├── postgres.yaml
    └── minio.yaml
```

---

## Quick Start

```bash
# Install with default values
helm install agenthive ./deploy/helm/agenthive

# Install for development
helm install agenthive ./deploy/helm/agenthive \
  -f ./deploy/helm/agenthive/values-dev.yaml

# Upgrade
helm upgrade agenthive ./deploy/helm/agenthive
```

---

## Values

```yaml
# values.yaml
replicaCount: 1

image:
  registry: ghcr.io/agenthive
  pullPolicy: IfNotPresent

web:
  image: web
  tag: latest
  service:
    type: ClusterIP
    port: 80
  ingress:
    enabled: true
    host: agenthive.local

supervisor:
  image: supervisor
  tag: latest
  service:
    port: 8080
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi

redis:
  enabled: true
  auth:
    enabled: false

postgresql:
  enabled: true
  auth:
    username: agenthive
    password: agenthive
    database: agenthive

minio:
  enabled: true
  auth:
    rootUser: agenthive
    rootPassword: agenthive123
```

---

## Templates

### web-deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "agenthive.fullname" . }}-web
spec:
  replicas: {{ .Values.web.replicaCount }}
  selector:
    matchLabels:
      app.kubernetes.io/component: web
  template:
    metadata:
      labels:
        app.kubernetes.io/component: web
    spec:
      containers:
      - name: web
        image: "{{ .Values.image.registry }}/{{ .Values.web.image }}:{{ .Values.web.tag }}"
        ports:
        - containerPort: 80
        resources:
          {{- toYaml .Values.web.resources | nindent 12 }}
```

---

## Skaffold Integration

```yaml
# skaffold.yaml
apiVersion: skaffold/v4beta7
kind: Config

build:
  artifacts:
    - image: agenthive/web
      context: apps/web
    - image: agenthive/supervisor
      context: apps/supervisor

deploy:
  helm:
    releases:
      - name: agenthive
        chartPath: deploy/helm/agenthive
        valuesFiles:
          - deploy/helm/agenthive/values-dev.yaml
```

---

## Makefile Targets

```makefile
cluster-up:
	@kind create cluster --name agenthive-dev

infra-up:
	@helm upgrade --install redis bitnami/redis -n agenthive
	@helm upgrade --install postgres bitnami/postgresql -n agenthive
	@helm upgrade --install minio bitnami/minio -n agenthive

dev-up:
	@skaffold dev -f deploy/skaffold.yaml

deploy-prod:
	@helm upgrade --install agenthive ./deploy/helm/agenthive \
	  -f ./deploy/helm/agenthive/values-production.yaml
```
