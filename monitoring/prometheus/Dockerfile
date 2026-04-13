# AgentHive Prometheus 镜像
# 基于官方镜像，注入自定义配置

FROM prom/prometheus:latest

LABEL maintainer="agenthive" \
      description="AgentHive Cloud Monitoring - Prometheus"

# 复制配置文件
COPY prometheus.yml /etc/prometheus/prometheus.yml

# 设置权限（prometheus 用户使用 uid 65534）
USER root
RUN chown -R nobody:nobody /etc/prometheus/prometheus.yml && \
    chmod 644 /etc/prometheus/prometheus.yml

# 切换回默认用户
USER nobody

# 暴露端口
EXPOSE 9090

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy || exit 1

# 启动命令（覆盖默认参数）
ENTRYPOINT ["/bin/prometheus"]
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--storage.tsdb.retention.time=30d", \
     "--storage.tsdb.retention.size=10GB", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.enable-lifecycle", \
     "--web.enable-admin-api"]
