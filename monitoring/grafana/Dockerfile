# AgentHive Grafana 镜像
# 预配置数据源和 Dashboard

FROM grafana/grafana:latest

LABEL maintainer="agenthive" \
      description="AgentHive Cloud Monitoring - Grafana"

# 切换到 root 用户来复制配置文件
USER root

# 创建必要的目录
RUN mkdir -p /etc/grafana/provisioning/datasources && \
    mkdir -p /etc/grafana/provisioning/dashboards && \
    mkdir -p /var/lib/grafana/dashboards && \
    mkdir -p /usr/share/grafana/.aws

# 复制数据源配置
COPY grafana/provisioning/datasources/prometheus.yml /etc/grafana/provisioning/datasources/

# 复制 Dashboard 提供者配置
COPY grafana/provisioning/dashboards/main.yaml /etc/grafana/provisioning/dashboards/

# 复制 Dashboard JSON 文件
COPY grafana/provisioning/dashboards/dashboards/system-monitor.json /etc/grafana/provisioning/dashboards/

# 调试：列出文件（验证 COPY 是否成功）
RUN ls -la /etc/grafana/provisioning/dashboards/

# 设置权限（grafana 用户 uid=472）
RUN chown -R 472:472 /etc/grafana/provisioning && \
    chmod -R 755 /etc/grafana/provisioning && \
    chmod 644 /etc/grafana/provisioning/dashboards/system-monitor.json

# 切换回 grafana 用户
USER 472

# 环境变量配置
ENV GF_SECURITY_ADMIN_USER=admin \
    GF_SECURITY_ADMIN_PASSWORD=admin123 \
    GF_USERS_ALLOW_SIGN_UP=false \
    GF_SERVER_HTTP_PORT=3000 \
    GF_SERVER_ROOT_URL=http://localhost:3000 \
    GF_AUTH_ANONYMOUS_ENABLED=false \
    GF_SECURITY_DISABLE_GRAVATAR=true \
    GF_SECURITY_ANGULAR_SUPPORT_ENABLED=false \
    GF_ANALYTICS_REPORTING_ENABLED=false \
    GF_ANALYTICS_CHECK_FOR_UPDATES=false \
    GF_LOG_MODE=console \
    GF_LOG_LEVEL=info

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1
