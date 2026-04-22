FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/auth-service-*.jar app.jar

EXPOSE 8081

# JVM 内存参数（可通过环境变量覆盖）
ENV JAVA_OPTS="-Xms256m -Xmx512m"

# Spring Profile（Docker 环境自动激活 docker profile）
ENV SPRING_PROFILES_ACTIVE=docker

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Auth Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
