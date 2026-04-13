# 搭建可观测性系统

本文档介绍如何在本地或 VM 上从零搭建 AgentHive 的 Metrics 可观测性栈。

## 架构

```
Node Exporter (9100)  →  采集宿主机系统指标
         ↓
Prometheus (9090)     →  存储时序数据，提供查询接口
         ↓
Grafana (3000)        →  可视化展示仪表盘
```

- **Node Exporter**：跑在每一台需要监控的机器上，暴露 CPU、内存、磁盘、网络等原始指标。
- **Prometheus**：主动拉取（scrape）Node Exporter 的数据，按时间序列存储在本地 TSDB 中。
- **Grafana**：从 Prometheus 查询数据，渲染成 Dashboard。

---

## 本地开发测试

使用项目自带的 `docker-compose.yml` 一键启动：

```bash
cd monitoring
docker-compose up -d
```

访问地址：
- Grafana: http://localhost:3000（默认账号 `admin` / `admin123`）
- Prometheus: http://localhost:9090

---

## 镜像从哪来：本地构建与推送

VM 上部署需要先从镜像仓库拉取镜像。如果你或团队之前没有推送过，你需要先在**开发机/CI 环境**构建并推送到镜像仓库（如阿里云 ACR）。

### 方式一：使用 Makefile（推荐）

项目 `monitoring/` 目录下提供了 `Makefile`，把构建、推送、测试、部署流程封装成了快捷命令：

```bash
cd monitoring

# 1. 构建所有镜像（本地生成 agenthive/prometheus:latest 等）
make build

# 2. 测试镜像是否能正常启动
make test

# 3. 推送所有镜像到远程仓库（默认 registry.cn-hangzhou.aliyuncs.com/agenthive）
# 注意：推送前确保已 docker login
make push

# 4. 在 VM 上部署指定版本
make deploy-vm VERSION=v20260413.3
```

**常用 Makefile 命令速查**：

| 命令 | 作用 |
|------|------|
| `make build` | 构建 prometheus + grafana + node-exporter 三个镜像 |
| `make push` | tag 并推送到 `REGISTRY/NAMESPACE` |
| `make test` | 本地临时启动三个容器做健康检查 |
| `make up` / `make down` | 本地 docker-compose 启动/停止 |
| `make deploy-vm VERSION=xxx` | 调用 `deploy-vm.sh` 在 VM 上部署 |
| `make clean` | 清理本地容器、镜像和数据卷 |

**覆盖默认仓库地址**：
```bash
make build push deploy-vm \
  REGISTRY=crpi-xxx.cn-beijing.personal.cr.aliyuncs.com \
  NAMESPACE=namespace-alpha \
  VERSION=v20260413.3
```

### 方式二：手动执行 docker build

如果你不想用 Makefile，也可以手动执行：

```bash
cd monitoring

# 构建 Prometheus
docker build -t agenthive/prometheus:v20260413.3 ./prometheus

# 构建 Grafana（注意 build context 必须是 monitoring/ 目录）
docker build -t agenthive/grafana:v20260413.3 -f ./grafana/Dockerfile .

# 构建 Node Exporter
docker build -t agenthive/node-exporter:v20260413.3 ./node-exporter

# 推送到你的 ACR 仓库（以阿里云为例）
docker tag agenthive/prometheus:v20260413.3 \
  crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/prometheus:v20260413.3

docker push crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/prometheus:v20260413.3

# Grafana 和 Node Exporter 同理...
```

> **为什么 Grafana 的 build context 是 `.` 而不是 `./grafana`？**
> 因为 `grafana/Dockerfile` 里的 `COPY` 指令写的是 `grafana/provisioning/...`，这要求 `docker build` 的 context 是 `monitoring/` 目录，否则找不到相对路径。这是最常见的构建失败原因。

### 推送后，在 VM 上拉取

确保 VM 能访问外网（或你的镜像仓库内网地址），然后：

```bash
docker pull crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/prometheus:v20260413.3
docker pull crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/grafana:v20260413.3
docker pull crpi-xxx.cn-beijing.personal.cr.aliyuncs.com/namespace-alpha/node-exporter:v20260413.3
```

---

## 一键 VM 部署：使用 deploy-vm.sh

如果你不想手动敲三个 `docker run` 命令，项目提供了 `deploy-vm.sh` 脚本，可以**一键完成**拉取、清理、网络创建、启动、健康检查的全流程。

### 基本用法

```bash
cd monitoring

# 部署 latest 版本（会从仓库重新拉取最新镜像）
./deploy-vm.sh latest

# 或部署指定版本
./deploy-vm.sh v20260413.3
```

### 环境变量覆盖

脚本支持通过环境变量覆盖默认配置，无需修改脚本本身：

```bash
REGISTRY=crpi-xxx.cn-beijing.personal.cr.aliyuncs.com \
NAMESPACE=namespace-alpha \
NETWORK_NAME=monitoring \
./deploy-vm.sh v20260413.3
```

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `REGISTRY` | `registry.cn-hangzhou.aliyuncs.com` | 镜像仓库域名 |
| `NAMESPACE` | `agenthive` | 镜像仓库命名空间 |
| `NETWORK_NAME` | `monitoring` | Docker 自定义网络名称 |
| `VERSION` | 脚本第一个参数 | 镜像标签版本 |

### 脚本执行流程

1. **检查 Docker** 是否已安装
2. **可选登录**镜像仓库
3. **拉取**三个组件镜像
4. **停止并删除**旧容器（保留数据卷）
5. **创建数据目录**和数据卷
6. **创建 Docker 自定义网络**
7. **依次启动** Node Exporter → Prometheus → Grafana
8. **健康检查**并输出访问地址

### 脚本输出示例

```
=== 容器状态 ===
NAMES                    STATUS                 PORTS
agenthive-prometheus     Up 3 seconds           0.0.0.0:9090->9090/tcp
agenthive-grafana        Up 3 seconds           0.0.0.0:3000->3000/tcp
agenthive-node-exporter  Up 3 seconds           0.0.0.0:9100->9100/tcp

=== 健康检查 ===
prometheus: 200
grafana: 200
node-exporter: 200

==============================================
🎉 部署完成！
==============================================
访问地址:
  Grafana:      http://172.16.1.5:3000
  Prometheus:   http://172.16.1.5:9090
==============================================
```

---

## VM 手动单容器部署

生产环境或独立 VM 上，建议直接使用 `docker run` 分别启动三个容器。这种方式对资源占用最小，且便于单独维护。

### 前置准备

1. **确认 Docker 已安装，且本地已有镜像**（或已从镜像仓库拉取）：

```bash
docker images | grep node-exporter
```

2. **创建 Docker 自定义网络**（这是避免容器名无法互访的关键）：

```bash
docker network create monitoring
```

> **为什么必须做这一步？** Docker 默认的 `bridge` 网络**不提供 DNS 解析**。如果不创建自定义网络，容器之间无法通过 `--name` 指定的名字互相访问，Grafana 会连不上 Prometheus，Prometheus 也解析不到 `node-exporter`。详见后面的 "常见坑：默认 bridge 网络不支持容器名互访"。

3. （可选）如果镜像名很长，可以在本地打短标签：

```bash
docker tag <长镜像名> node-exporter:v20260413.1
docker tag <长镜像名> prometheus:v20260413.1
docker tag <长镜像名> grafana:v20260413.1
```

下文示例将使用短名，你可以直接替换为实际的完整镜像地址。

---

### 1. 启动 Node Exporter

```bash
docker run -d \
  --name agenthive-node-exporter \
  --restart unless-stopped \
  --network monitoring \
  --pid="host" \
  -p 9100:9100 \
  -v "/proc:/host/proc:ro" \
  -v "/sys:/host/sys:ro" \
  -v "/:/rootfs:ro" \
  node-exporter:v20260413.1
```

#### 参数解释

| 参数 | 原因 | 不这样做的后果 |
|------|------|----------------|
| `--pid="host"` | Node Exporter 需要读取宿主机的进程信息（如 CPU、内存、线程数）。 | 容器只能看到自己的 PID 1（即 node_exporter 自身），CPU、loadavg 等指标几乎为空或错误。 |
| `-v "/proc:/host/proc:ro"` | Dockerfile 中默认 `CMD` 指定了 `--path.procfs=/host/proc`，必须让容器能读到宿主机的 `/proc`。 | `procfs` 采集器找不到数据，CPU、内存、进程类指标缺失。 |
| `-v "/sys:/host/sys:ro"` | 同理，对应 `--path.sysfs=/host/sys`，获取硬件、网络、块设备信息。 | `sysfs` 采集器失效，磁盘温度、网络队列、块设备信息缺失。 |
| `-v "/:/rootfs:ro"` | 对应 `--path.rootfs=/rootfs`，让 Node Exporter 能计算根文件系统的真实磁盘用量。 | 磁盘容量、磁盘使用率指标显示为容器自身的只读层，完全失真。 |
| `-p 9100:9100` | 这是 Prometheus 抓取指标的标准端口。 | Prometheus 无法连接到 Node Exporter，系统监控面板为空。 |
| `-d` | 后台常驻运行。 | 终端关闭后容器随之停止。 |

---

### 2. 启动 Prometheus

```bash
docker run -d \
  --name agenthive-prometheus \
  --restart unless-stopped \
  --network monitoring \
  -p 9090:9090 \
  -v prometheus-data:/prometheus \
  prometheus:v20260413.1
```

#### 参数解释

| 参数 | 原因 | 不这样做的后果 |
|------|------|----------------|
| `-v prometheus-data:/prometheus` | Dockerfile 中 `CMD` 指定了 `--storage.tsdb.path=/prometheus`，TSDB 数据会写在此路径。必须用命名卷持久化。 | 容器删除或重建后，所有历史监控数据全部丢失。 |
| `-p 9090:9090` | Prometheus 的 Web UI 和 API 端口。 | Grafana 无法配置数据源，也无法在浏览器中直接访问 Prometheus。 |

> **为什么不需要手动传启动参数？**
> 因为 Dockerfile 中已经通过 `ENTRYPOINT` + `CMD` 写死了默认参数（如 30 天 retention、enable lifecycle 等）。只要镜像构建正确，启动时无需额外配置。

---

### 3. 启动 Grafana

```bash
docker run -d \
  --name agenthive-grafana \
  --restart unless-stopped \
  --network monitoring \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  grafana:v20260413.1
```

#### 参数解释

| 参数 | 原因 | 不这样做的后果 |
|------|------|----------------|
| `-v grafana-data:/var/lib/grafana` | Grafana 的 sqlite 数据库、自定义 Dashboard、插件都存储在此目录。 | 容器重建后，所有自定义面板、用户配置、告警规则丢失。 |
| `-p 3000:3000` | Dockerfile 中 `GF_SERVER_HTTP_PORT=3000`，这是 Grafana 的默认服务端口。 | 无法通过浏览器访问可视化界面。 |

> **密码修改**
> 镜像中已通过 `ENV` 预置了默认管理员账号 `admin` / `admin123`。生产环境应在 `docker run` 时通过 `-e` 覆盖：
> ```bash
> -e GF_SECURITY_ADMIN_PASSWORD=YourStrongPassword
> ```
> 如果不修改，任何知道默认密码的人都能直接登录并查看全部监控数据。

---

## 常见坑：Grafana 预配置 Dashboard 未生效

如果你启动 Grafana 后登录进去，发现 **Dashboards 菜单里是空的**，没有预置的 "AgentHive Cloud - 系统监控" 面板，很可能是镜像构建时 `system-monitor.json` 没有成功 `COPY` 进去。

### 原因

#### 表层原因：镜像构建失败

你 VM 上运行的镜像里，**`system-monitor.json` 根本不存在**。Dockerfile 中负责复制它的 `COPY` 指令因为以下原因之一失败了：

1. **build context 不对**：`COPY grafana/provisioning/dashboards/dashboards/system-monitor.json ...` 这行要求 `docker build` 的 build context 是 `monitoring/` 目录。如果你在其他目录（如项目根目录）执行 build，Docker 找不到这个相对路径，`COPY` 就会失败。
2. **Dockerfile 本身的路径错误**：`RUN chmod 644 /etc/grafana/provisioning/system-monitor.json` 写错了路径。因为 `COPY` 的目标目录是 `/etc/grafana/provisioning/dashboards/`，所以文件最终位置应该是 `/etc/grafana/provisioning/dashboards/system-monitor.json`，原 Dockerfile 少写了 `/dashboards/` 这一层，导致无论 `COPY` 是否成功，`chmod` 都会报 `No such file or directory`，从而使整个 build 失败。
3. **没有重新 push/pull**：修改 Dockerfile 后，必须执行 `build → tag → push`，然后 VM 上 `docker pull` 拉取新镜像。很多人改了 Dockerfile 但跑的还是旧镜像。

你可以通过下面命令确认镜像是否是 build 成功后的新版本：
```bash
docker inspect <你的grafana镜像名> --format='{{.Created}}'
```

如果创建时间早于你修改 Dockerfile 的时间，说明你跑的是旧镜像。

### 修复方案：宿主机挂载 dashboard（无需 rebuild 镜像）

和 Prometheus 配置一样，直接在宿主机维护 dashboard 文件，用 `-v` 挂载进容器即可。

#### 1. 在宿主机创建目录并放入文件

```bash
mkdir -p /opt/agenthive-monitoring/grafana/provisioning/dashboards
```

如果你 VM 上有项目源码：
```bash
cp /path/to/agenthive-cloud/monitoring/grafana/provisioning/dashboards/main.yaml \
   /opt/agenthive-monitoring/grafana/provisioning/dashboards/

cp /path/to/agenthive-cloud/monitoring/grafana/provisioning/dashboards/dashboards/system-monitor.json \
   /opt/agenthive-monitoring/grafana/provisioning/dashboards/
```

如果没有源码，也可以从 GitHub raw 下载（替换为你的实际仓库地址）：
```bash
cd /opt/agenthive-monitoring/grafana/provisioning/dashboards
curl -O https://raw.githubusercontent.com/your-org/agenthive-cloud/main/monitoring/grafana/provisioning/dashboards/main.yaml
curl -O https://raw.githubusercontent.com/your-org/agenthive-cloud/main/monitoring/grafana/provisioning/dashboards/dashboards/system-monitor.json
```

#### 2. 重启 Grafana 容器并挂载该目录

```bash
docker stop agenthive-grafana
docker rm agenthive-grafana

docker run -d \
  --name agenthive-grafana \
  --restart unless-stopped \
  --network monitoring \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  -v /opt/agenthive-monitoring/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards \
  <你的grafana镜像名>
```

#### 3. 验证

```bash
docker exec agenthive-grafana ls -la /etc/grafana/provisioning/dashboards/
```

预期看到：
```
-rw-r--r-- 1 grafana 472  301 ... main.yaml
-rw-r--r-- 1 grafana 472  23K ... system-monitor.json
```

然后登录 Grafana，进入 **Dashboards → Browse → AgentHive**，应该能看到预置面板。

---

## 常见坑：默认 bridge 网络不支持容器名互访

如果你用 `docker run` 启动容器时**没有指定 `--network`**，Docker 会把它们放在默认的 `bridge` 网络中。此时 Grafana 的数据源配置里如果填写 `http://prometheus:9090` 或 `http://node-exporter:9100`，**一定会解析失败**。

### 原因

Docker 默认的 `bridge` 网络**不提供 DNS 解析**，容器之间无法通过 `--name` 指定的名字互相访问。只有**用户自定义网络**才会自动启用 DNS，让容器名等价于主机名。

### 修复方案

#### 方案 A：使用宿主机 IP（最快，无需重启容器）

在 VM 上获取内网 IP：

```bash
hostname -I | awk '{print $1}'
```

假设输出为 `172.16.1.5`，则在 Grafana 数据源 URL 中填写：

```
http://172.16.1.5:9090
```

**验证**（在 Grafana 容器内测试连通性）：

```bash
docker exec -it agenthive-grafana sh
wget --spider -q http://172.16.1.5:9090/-/healthy && echo "OK" || echo "FAIL"
```

#### 方案 B：创建自定义网络并接入已有容器（推荐）

如果你想继续使用 `http://prometheus:9090` 这种易维护的地址，可以动态创建网络并接入运行中的容器（**不会中断服务，也不会丢失数据**）：

```bash
# 1. 创建自定义网络
docker network create monitoring

# 2. 将已有容器接入该网络
docker network connect monitoring agenthive-prometheus
docker network connect monitoring agenthive-grafana
docker network connect monitoring agenthive-node-exporter
```

完成后，Grafana 数据源 URL 即可填写 `http://prometheus:9090`，Prometheus 的 `targets` 也可以写 `node-exporter:9100`。

---

## 常见坑：Prometheus 配置里的 `localhost` 指向的是容器自身

如果你在 `prometheus.yml` 里把 Node Exporter 的 target 写成了 `localhost:9100`，**Prometheus 容器会去访问它自己**，而不是宿主机上的 Node Exporter，导致抓取状态为 `connection refused` 或 `down`。

### 原因

容器内的 `localhost` / `127.0.0.1` 永远指向**容器自身的网络命名空间**，和宿主机是隔离的。只有当 Prometheus 使用 `--network host` 时，`localhost` 才等价于宿主机，但那样会牺牲网络隔离，一般不推荐。

### 修复方案：挂载外部配置文件（无需 rebuild 镜像）

**不要**为了改一个 hostname 就重新 build/push/pull 镜像。Docker 的标准做法是在宿主机维护一份 `prometheus.yml`，通过 `-v` 挂载进容器覆盖默认配置。

#### 1. 在宿主机创建配置文件

```bash
mkdir -p /opt/agenthive-monitoring/config
cat > /opt/agenthive-monitoring/config/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF
```

> 如果你有其他 job，一并复制进去，只把 Node Exporter 的 `localhost` 替换成 `node-exporter:9100`（自定义网络下）或宿主机内网 IP。

#### 2. 重启 Prometheus 容器并挂载该配置

```bash
# 停止并删除旧容器（数据不会丢失，因为数据在 prometheus-data 卷里）
docker stop agenthive-prometheus
docker rm agenthive-prometheus

# 重新启动，加一条 -v 挂载外部配置
docker run -d \
  --name agenthive-prometheus \
  --restart unless-stopped \
  --network monitoring \
  -p 9090:9090 \
  -v prometheus-data:/prometheus \
  -v /opt/agenthive-monitoring/config/prometheus.yml:/etc/prometheus/prometheus.yml \
  <你的prometheus镜像名>
```

#### 3. 验证

打开浏览器访问 `http://<VM_IP>:9090/targets`，查看 `node-exporter` 的状态是否为 `UP`。

#### 临时热重载（仅用于快速验证，重启后失效）

如果你只是想临时测试连通性，可以进容器改完配置后热重载：

```bash
docker exec -it agenthive-prometheus sh
sed -i 's/localhost:9100/node-exporter:9100/g' /etc/prometheus/prometheus.yml
kill -HUP 1
```

`kill -HUP 1` 会让 Prometheus 重新读取配置（因为镜像中已启用 `--web.enable-lifecycle`）。验证通过后，请务必用上面的 `-v` 挂载方式固化配置。

---

## 验证

三个容器都启动后，在宿主机执行以下命令验证服务是否就绪：

```bash
curl http://localhost:9100/metrics   # Node Exporter，应返回大量指标文本
curl http://localhost:9090/-/healthy # Prometheus，应返回 200
curl http://localhost:3000/api/health # Grafana，应返回 {"database":"ok"}
```
