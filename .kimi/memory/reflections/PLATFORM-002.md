# PLATFORM-002 Reflection — Start otel-collector Container

## Summary
The `agenthive-otel-collector` container had exited 41 hours ago, causing all Java services to log continuous DNS resolution errors (`Name does not resolve`) when attempting to export OpenTelemetry data.

## Root Causes Identified
1. **Container stopped**: The old container `agenthive-otel-collector` (without `-dev` suffix) was in `Exited (0)` state. A new container name `agenthive-otel-collector-dev` was defined in the current `docker-compose.dev.yml`.
2. **Broken healthcheck**: The compose file configured `wget`-based healthcheck, but the `otel/opentelemetry-collector-contrib:0.96.0` image is distroless — no shell, no `wget`, no `curl`. This caused the container to always be marked `unhealthy`.
3. **Port mismatch**: Java services were configured with `OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317`, but the Java agent uses HTTP/protobuf exporter by default, which requires port `4318` (the OTLP HTTP port). Port `4317` is gRPC-only and rejected HTTP/1.1 requests with `Connection reset`.
4. **Depends_on condition**: Java services used `condition: service_healthy` for otel-collector, which would block startup since the healthcheck always failed.

## Actions Taken
- Started otel-collector: `docker compose -f docker-compose.dev.yml --env-file .env.dev up -d otel-collector`
- Removed stale old container `agenthive-otel-collector`
- Restarted `agenthive-gateway-dev` to pick up correct endpoint configuration
- Verified container stays running and gateway logs show NO otel-collector ERRORs

## Pre-existing Fixes (commit ecb8da6)
The `docker-compose.dev.yml` already contained fixes made by an automated commit:
- Removed distroless-incompatible healthcheck from otel-collector
- Changed OTLP endpoint from `:4317` to `:4318` for all 8 Java-dependent services
- Changed `depends_on` condition from `service_healthy` to `service_started`

## Learnings
1. **Distroless images need careful healthcheck design**: When using distroless/collector images, avoid `wget`/`curl`-based healthchecks. Use binary subcommands (e.g., `/otelcol-contrib validate`) or rely on `service_started` dependencies.
2. **OTLP port awareness**: gRPC (4317) and HTTP/protobuf (4318) are separate ports in the OpenTelemetry Collector. Java Agent defaults to HTTP/protobuf — endpoint must match the correct port.
3. **Container name drift**: When `container_name` changes in compose, stale containers may be left behind. Always clean up orphaned containers.
4. **Connection state caching**: Java services may cache bad connection state. A simple container restart may not be enough — dependent services may also need restart after infrastructure fixes.

## Security Baseline
- [x] No secrets exposed in changes
- [x] No privilege escalation changes
- [x] Dev environment only — no production impact
