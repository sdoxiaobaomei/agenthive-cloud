# syntax=docker/dockerfile:1
# User Service - Optimized Spring Boot 3 Layered Build

FROM eclipse-temurin:21-jre-alpine AS builder
WORKDIR /app
COPY target/user-service-*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

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

USER appuser

EXPOSE 8082

ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive User Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8082/actuator/health || exit 1

ENTRYPOINT exec java ${JAVA_OPTS} org.springframework.boot.loader.launch.JarLauncher
