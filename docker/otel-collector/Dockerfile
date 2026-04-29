# AgentHive Cloud — OpenTelemetry Collector with Alpine base
# Adds curl/wget for Docker healthcheck compatibility

FROM otel/opentelemetry-collector-contrib:0.96.0 AS collector

FROM alpine:3.19
RUN apk add --no-cache ca-certificates curl

# Copy collector binary from upstream distroless image
COPY --from=collector /otelcol-contrib /otelcol-contrib

# Use same non-root user as upstream
USER 65532:65532

ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config=/etc/otel-collector.yml"]
