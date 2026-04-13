# AgentHive Node Exporter 镜像
# 系统指标采集器

FROM prom/node-exporter:latest

LABEL maintainer="agenthive" \
      description="AgentHive Cloud Monitoring - Node Exporter"

# 暴露端口
EXPOSE 9100

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9100/ || exit 1

# 启动命令（配置优化参数）
ENTRYPOINT ["/bin/node_exporter"]
CMD ["--path.procfs=/host/proc", \
     "--path.rootfs=/rootfs", \
     "--path.sysfs=/host/sys", \
     "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc|var/lib/docker/.+|run/docker/.+)($$|/)", \
     "--collector.filesystem.fs-types-exclude=^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|iso9660|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tracefs)$", \
     "--collector.cpu.info", \
     "--collector.meminfo_numa", \
     "--web.max-requests=40"]
