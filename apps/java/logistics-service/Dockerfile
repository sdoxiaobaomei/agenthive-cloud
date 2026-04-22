FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY target/logistics-service-*.jar app.jar

EXPOSE 8086

ENV JAVA_OPTS="-Xms128m -Xmx384m"

# Labels for traceability
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
LABEL org.opencontainers.image.title="AgentHive Logistics Service"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.created="${BUILD_TIME}"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
