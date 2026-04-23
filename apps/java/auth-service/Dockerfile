# syntax=docker/dockerfile:1
# Auth Service - Optimized Spring Boot 3 Layered Build
# Uses jarmode=layertools to split fat JAR into cacheable layers.

# ============ 提取阶段 ============
FROM eclipse-temurin:21-jre-alpine AS builder
WORKDIR /app
COPY target/auth-service-*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# ============ 生产阶段 ============
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# JVM memory settings (container-aware)
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"
ENV SPRING_PROFILES_ACTIVE=docker

# Create non-root user
RUN addgroup -S appgroup -g 1001 && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

# Copy layers (dependencies rarely change -> cached)
COPY --from=builder --chown=appuser:appgroup /app/dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/spring-boot-loader/ ./
COPY --from=builder --chown=appuser:appgroup /app/snapshot-dependencies/ ./
COPY --from=builder --chown=appuser:appgroup /app/application/ ./

USER appuser

EXPOSE 8081

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Auth Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8081/actuator/health || exit 1

ENTRYPOINT exec java ${JAVA_OPTS} org.springframework.boot.loader.launch.JarLauncher
