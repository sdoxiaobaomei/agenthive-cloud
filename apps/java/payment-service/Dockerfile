FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY target/payment-service-*.jar app.jar

EXPOSE 8083

ENV JAVA_OPTS="-Xms256m -Xmx512m"

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Payment Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
