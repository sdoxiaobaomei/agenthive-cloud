# syntax=docker/dockerfile:1
# Payment Service - Optimized Spring Boot 3 Layered Build

FROM eclipse-temurin:21-jre-alpine AS builder
WORKDIR /app
COPY target/payment-service-*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# Download OpenTelemetry Java Agent for unified observability (dev/prod parity)
# The agent is enabled/disabled at runtime via OTEL_JAVAAGENT_ENABLED env var
RUN wget -q https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.6.0/opentelemetry-javaagent.jar -O /app/opentelemetry-javaagent.jar

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"
ENV SPRING_PROFILES_ACTIVE=docker

RUN addgroup -S appgroup -g 1001 && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

COPY --from=builder --chown=appuser:appgroup /app/dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/spring-boot-loader/ ./
COPY --from=builder --chown=appuser:appgroup /app/snapshot-dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/application/ ./
COPY --from=builder --chown=appuser:appgroup /app/opentelemetry-javaagent.jar ./

USER appuser

EXPOSE 8083

ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Payment Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8083/actuator/health || exit 1

ENTRYPOINT exec java ${JAVA_OPTS} -javaagent:/app/opentelemetry-javaagent.jar org.springframework.boot.loader.launch.JarLauncher
