# 可观测系统日常运维

本文档介绍系统跑起来后，如何查看状态、跟踪日志、探活服务和安全重启。

---

## 查看容器状态

### 快速列表

```bash
docker ps --filter "name=agenthive-node-exporter|agenthive-prometheus|agenthive-grafana"
```

### 带健康检查状态的精简视图

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

典型输出：

```
NAMES                    STATUS                     PORTS
agenthive-node-exporter  Up 2 minutes (healthy)     0.0.0.0:9100->9100/tcp
agenthive-prometheus     Up 2 minutes (healthy)     0.0.0.0:9090->9090/tcp
agenthive-grafana        Up 2 minutes (healthy)     0.0.0.0:3000->3000/tcp
```

#### 状态解读

| 状态 | 含义 | 建议 |
|------|------|------|
| `(healthy)` | 连续通过 Dockerfile 中定义的健康检查。 | 正常，无需处理。 |
| `(starting)` | 仍在 `HEALTHCHECK` 的 `start-period` 宽限期内。 | Grafana 的 start-period 为 60 秒，等待即可。 |
| `(unhealthy)` | 连续失败达到 `retries` 阈值。 | 立即查看该容器日志排查。 |

### 单独查看健康状态

```bash
docker inspect --format='{{.State.Health.Status}}' agenthive-node-exporter
docker inspect --format='{{.State.Health.Status}}' agenthive-prometheus
docker inspect --format='{{.State.Health.Status}}' agenthive-grafana
```

### 查看资源占用

```bash
docker stats --no-stream agenthive-node-exporter agenthive-prometheus agenthive-grafana
```

可实时查看 CPU、内存、网络 I/O 和块 I/O。

### 查看容器重启次数

```bash
docker inspect --format='{{.RestartCount}}' agenthive-node-exporter
```

如果数字在持续增长，说明容器反复崩溃，必须查看日志定位根因。

---

## 跟踪日志

### 实时刷新（不自动关闭）

```bash
docker logs -f agenthive-node-exporter
```

`-f`（follow）会让终端持续阻塞并刷新新日志，按 `Ctrl + C` 即可退出。**退出日志查看不会停止容器**。

### 只看最后 N 行并继续跟踪

```bash
docker logs -f --tail 100 agenthive-node-exporter
```

**推荐使用**：避免首次打开时刷出数千行历史日志淹没终端。

### 带时间戳跟踪

```bash
docker logs -ft --tail 20 agenthive-node-exporter
```

`-t` 会在每行前加上 ISO 8601 时间戳，便于排查问题发生的确切时间。

### 只查看最近一段时间的日志

```bash
docker logs --since 10m agenthive-prometheus
```

适合在已知告警触发时间附近快速定位错误。

---

## 服务探活

从宿主机直接 curl 各组件的健康接口，是最直接有效的验证方式。

| 组件 | 命令 | 预期结果 |
|------|------|----------|
| Node Exporter | `curl -s -o /dev/null -w "%{http_code}" http://localhost:9100/` | `200` |
| Prometheus | `curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/-/healthy` | `200` |
| Grafana | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health` | `200` |

如果返回非 200 或连接超时，按以下顺序排查：
1. `docker ps` 确认容器是否在运行。
2. `docker logs --tail 50 <容器名>` 查看最近是否有 ERROR 或 PANIC。
3. `netstat -tlnp`（或 `ss -tlnp`）确认端口是否被其他进程占用。

---

## 安全重启与清理

### 重启单个容器

```bash
docker restart agenthive-prometheus
```

重启后数据不会丢失（因为已挂载持久化卷），但正在采集的指标会有短暂中断（通常 < 5 秒）。

### 停止并移除（保留数据）

```bash
docker stop agenthive-node-exporter agenthive-prometheus agenthive-grafana
docker rm agenthive-node-exporter agenthive-prometheus agenthive-grafana
```

由于使用了 Docker 命名卷（`prometheus-data`、`grafana-data`），容器移除后数据仍然保留在 `/var/lib/docker/volumes/` 中，下次 `docker run` 时重新挂载即可恢复。

### 彻底清理（包括数据）

```bash
docker stop agenthive-node-exporter agenthive-prometheus agenthive-grafana
docker rm agenthive-node-exporter agenthive-prometheus agenthive-grafana
docker volume rm prometheus-data grafana-data
```

**警告**：执行 `docker volume rm` 后，所有历史监控数据和 Grafana 配置将永久删除，不可恢复。

---

## Dashboard 显示 No Data 的排查

Dashboard 已加载但所有面板显示 **No Data**，说明 Grafana 能读到面板定义，但查询不到数据。按以下顺序排查：

### 1. 数据源是否连通

Grafana: **Administration → Data Sources → Prometheus → Save & test**
- 显示 "Data source is working" → 继续下一步
- 显示报错 → 检查 URL 和网络（参考本文档"服务探活"和网络章节）

### 2. Prometheus Targets 是否正常

浏览器打开 `http://<VM_IP>:9090/targets`
- `node-exporter` 应为 `UP`
- 如果 `DOWN`，点击 Error 查看具体原因

### 3. Prometheus 里是否有原始指标

在 Prometheus Graph 页面执行：
```promql
up
node_cpu_seconds_total
```

如果返回空 → 回到第 2/4 步检查 Node Exporter。

### 4. Node Exporter 是否暴露指标

在 VM 宿主机执行：
```bash
curl http://localhost:9100/metrics | head -n 20
```

应返回大量 `# HELP ...` 开头的文本。如果连不上，查看 `docker logs agenthive-node-exporter`。

### 5. 检查数据源 UID（最常见但最隐蔽）

这是一个 provisioning 配置遗漏导致的问题：
- `grafana/provisioning/datasources/prometheus.yml` 里**没有写 `uid: prometheus`**
- Grafana 自动创建数据源时，UID 是随机生成的（如 `PBFA97CFB590B2093`）
- 但 `system-monitor.json` 里每个面板的 `datasource.uid` 都硬编码为 `"prometheus"`
- 于是面板查询找不到匹配的数据源，直接显示 No Data

**快速验证**：

Grafana: **Administration → Data Sources → Prometheus**，查看 **UID** 字段。

- 如果 UID 不是 `prometheus`，手动改成 `prometheus` 后 Save，刷新 Dashboard，数据会立刻出现。
- 如果 UID 已经是 `prometheus` 但仍 No Data → 继续检查 PromQL 本身（第 6 步）。

**根治修复**：

修改 `monitoring/grafana/provisioning/datasources/prometheus.yml`，显式声明：
```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    uid: prometheus
    isDefault: true
```

然后重新 build/push/pull Grafana 镜像。

### 6. 一个极具迷惑性的现象：Edit 一下就有数据

如果你发现：
- 大部分面板显示 **No Data**
- 但随便点一个面板进入 **Edit** 模式，什么都不改直接 **Save**，刷新后这个面板突然就有数据了
- 不 edit 的面板仍然 No Data

**这就是典型的数据源 UID 不匹配。**

**原因**：Grafana 的 Edit 模式有一个自动兜底机制——当面板引用的 datasource UID 找不到时，会自动把它切换成 **默认数据源（`default`）**。你点 Save 后，这个面板的 datasource 引用就被重写成实际存在的那个数据源了。所以你只是在**手动逐个修复面板**，而不是解决了根因。

**为什么不推荐这样做**：
- 每个面板都要手动 edit-save，效率极低
- 下次部署新环境还要重复手工操作
- 修改后的 dashboard JSON 会和 git 里的版本不一致，后续更新难以合并

**正确做法**：直接修改 Grafana 数据源的 UID（第 5 步），或删除 `grafana-data` 卷后重新启动容器，让所有面板一次性恢复正常。

### 7. 在 Prometheus 中直接执行 Dashboard 的 PromQL

在 Grafana 中点击一个 No Data 面板的标题 → **Edit**，复制右侧的 PromQL 查询。

例如 CPU 面板：
```promql
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

把这条查询粘贴到 Prometheus 的 Graph 页面执行：
- 如果 Prometheus **有数据**，但 Grafana **No Data** → 几乎可以确定是数据源 UID 不匹配（回到第 5 步）。
- 如果 Prometheus 也**没数据** → 指标名或标签过滤条件与当前环境不匹配，需要检查 Node Exporter 版本或 `instance` 标签值。
