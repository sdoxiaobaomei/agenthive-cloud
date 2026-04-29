# AgentHive Cloud Helm Chart

> Helm Chart for AgentHive Cloud - AI-driven multi-agent collaboration platform.

## Prerequisites

- Kubernetes 1.27+
- Helm 3.12+
- Ingress Controller (nginx)
- cert-manager (for TLS, optional)

## Installation

### Development

```bash
helm install agenthive ./chart/agenthive -f values.yaml
```

### Staging

```bash
helm install agenthive-staging ./chart/agenthive \
  -f values.yaml \
  -f values.staging.yaml
```

### Production

```bash
helm install agenthive-prod ./chart/agenthive \
  -f values.yaml \
  -f values.prod.yaml
```

### Dry-run / Template

```bash
helm template agenthive ./chart/agenthive -f values.yaml
helm template agenthive ./chart/agenthive -f values.yaml -f values.prod.yaml
```

## Values Structure

| Top-Level Key | Description | Default |
|---------------|-------------|---------|
| `global` | Namespace, labels, image registry, security contexts | `agenthive` namespace |
| `api` | Node.js API service (Express) | `replicas: 2` |
| `landing` | Nuxt 3 frontend (Landing) | `replicas: 2` |
| `javaServices` | 7 Java Spring Cloud microservices | `enabled: true` |
| `ingress` | Nginx Ingress rules | `enabled: true` |
| `configmap` | Non-sensitive app configuration | `app-config` |
| `secret` | Secret references (managed externally) | `enabled: false` |
| `networkPolicy` | Zero-trust network policies | `enabled: true` |
| `nacos` | Service discovery (inline, Phase 1) | `enabled: false` |
| `rabbitmq` | Message broker (inline, Phase 1) | `enabled: false` |

### Java Services

All Java services share a common template (`java-deployment.yaml`) and are configured under `javaServices.services`:

| Service | Port | Type | DB Host |
|---------|------|------|---------|
| `gateway-service` | 8080 | LoadBalancer | — |
| `auth-service` | 8081 | ClusterIP | postgres-auth |
| `user-service` | 8082 | ClusterIP | postgres-user |
| `payment-service` | 8083 | ClusterIP | postgres-business |
| `order-service` | 8084 | ClusterIP | postgres-business |
| `cart-service` | 8085 | ClusterIP | postgres-business |
| `logistics-service` | 8086 | ClusterIP | postgres-business |

### Security Defaults

Every container includes:

- `runAsNonRoot: true`
- `readOnlyRootFilesystem: true`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`
- `automountServiceAccountToken: false`

### Layered Values

```
values.yaml          → base / development defaults
values.staging.yaml  → staging overrides (namespace, replicas, images)
values.prod.yaml     → production overrides (namespace, replicas, resources, TLS)
```

Override precedence (Helm): `values.yaml` < `-f values.*.yaml` < `--set`.

## Verification

```bash
helm lint chart/agenthive/
helm template agenthive chart/agenthive/ -f values.yaml
helm template agenthive chart/agenthive/ -f values.yaml -f values.prod.yaml
```

## Migration from Kustomize

This chart translates the existing `k8s/base/` and `k8s/overlays/production/` manifests into Helm templates.

| Kustomize | Helm |
|-----------|------|
| `namePrefix: prod-` | `global.namePrefix` |
| `namespace: agenthive-production` | `global.namespace` |
| `images: [newTag: v1.1.0]` | `api.image.tag`, `landing.image.tag` |
| `replicas: [count: 3]` | `api.replicas`, `landing.replicas` |
| `patches` (resources, hpa, ingress) | Per-service values overrides |
| `labels: [environment: production]` | `global.labels.environment` |

## Notes

- **PostgreSQL / Redis**: Out of scope for this chart; use external instances or dedicated charts.
- **Secrets**: The chart references `app-secrets` but does not create it by default. Use External Secrets Operator, Sealed Secrets, or CI/CD injection.
- **Nacos / RabbitMQ**: Inline for Phase 1; migration to subcharts planned for future releases.
