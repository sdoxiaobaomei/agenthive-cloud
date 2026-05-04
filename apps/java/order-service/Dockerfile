# syntax=docker/dockerfile:1
# Order Service - Optimized Spring Boot 3 Layered Build with Multi-stage Maven

FROM eclipse-temurin:21-jdk-alpine AS maven-builder
WORKDIR /app

# Install wget for downloading opentelemetry agent
RUN apk add --no-cache wget

# Copy entire java workspace and build
COPY . .
RUN mvn clean package -pl order-service -am -DskipTests -B -q && \
    cd order-service && \
    java -Djarmode=layertools -jar target/order-service-*.jar extract && \
    wget -q https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.6.0/opentelemetry-javaagent.jar -O opentelemetry-javaagent.jar

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"
ENV SPRING_PROFILES_ACTIVE=docker

RUN addgroup -S appgroup -g 1001 && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app

COPY --from=maven-builder --chown=appuser:appgroup /app/order-service/dependencies/ ./
COPY --from=maven-builder --chown=appuser:appgroup /app/order-service/spring-boot-loader/ ./
COPY --from=maven-builder --chown=appuser:appgroup /app/order-service/snapshot-dependencies/ ./
COPY --from=maven-builder --chown=appuser:appgroup /app/order-service/application/ ./
COPY --from=maven-builder --chown=appuser:appgroup /app/order-service/opentelemetry-javaagent.jar ./

USER appuser

EXPOSE 8084

ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Order Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8084/actuator/health || exit 1

ENTRYPOINT exec java ${JAVA_OPTS} -javaagent:/app/opentelemetry-javaagent.jar org.springframework.boot.loader.launch.JarLauncher
