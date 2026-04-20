# OTel Collector 镜像构建
# 基于官方 contrib 版本（包含更多 Receiver / Exporter / Processor）

FROM otel/opentelemetry-collector-contrib:0.96.0

# 复制配置文件
COPY otel-collector.yml /etc/otel-collector.yml

# 暴露端口
EXPOSE 4317 4318 8888 8889 13133

# 启动命令
ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config", "/etc/otel-collector.yml"]
