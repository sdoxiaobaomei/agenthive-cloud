# Node Exporter 文件系统排除规则指南

Node Exporter 的 `filesystem` 采集器会遍历 Linux 上所有挂载点。如果不加过滤，容器化环境会产生大量无意义的虚拟文件系统指标，淹没真正需要监控的物理磁盘数据。

---

## 为什么需要排除规则

Linux 内核和容器运行时会创建大量**伪文件系统**（虚拟挂载点）。它们的特点是：
- 不占用物理磁盘空间（或占用内存）
- 数量极多（一个 Docker 容器可产生数十个 overlay 挂载点）
- 容量与底层真实磁盘重复统计

**不排除的后果**：
- Prometheus 中 `node_filesystem_*` 指标数量暴涨，查询变慢。
- Grafana 磁盘面板被 `overlay`、`tmpfs`、`devtmpfs` 淹没，无法阅读。
- 磁盘使用率告警误报（tmpfs 占满触发磁盘告警，但它只是内存）。

---

## 挂载点排除（mount-points-exclude）

当前 Dockerfile 中的规则：

```bash
^/(sys|proc|dev|host|etc|var/lib/docker/.+|run/docker/.+)($$|/)
```

### 逐条解释

| 排除路径 | 本质 | 排除原因 |
|----------|------|----------|
| `/sys` | 内核 sysfs（虚拟） | 不存在真实磁盘容量概念。 |
| `/proc` | 进程信息 procfs（虚拟） | 不占用块设备空间，是运行时内核数据结构。 |
| `/dev` | 设备文件目录，通常由 devtmpfs 挂载 | 不是持久化存储，容量无意义。 |
| `/host` | 容器内挂载宿主机根目录时常用的别名 | 采集它会导致与 `/` 的磁盘容量**重复统计**。 |
| `/var/lib/docker/...` | Docker 存储驱动内部目录（如 overlay2） | 会产生大量重复、无意义的挂载点指标。 |
| `/run/docker/...` | Docker runtime 的临时挂载（socket、bind mount 等） | 属于容器运行时的临时文件，非业务数据。 |

---

## 文件系统类型排除（fs-types-exclude）

当前 Dockerfile 中的规则：

```bash
^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|iso9660|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tracefs)$
```

### 核心类型深度解释

#### 1. Overlay（OverlayFS）

**本质**：Linux 的**联合文件系统**（Union Filesystem）。

**Docker 中的作用**：把只读的镜像层（lower）和可写的容器层（upper）叠加在一起，对外表现为一个目录。每启动一个容器，Docker 就会创建至少一个 overlay 挂载点。

**排除原因**：
- **数量爆炸**：10 个容器至少 10 个 overlay 挂载点，K8s 集群可能上千个。
- **容量重复**：overlay 显示的总容量其实就是底层物理磁盘（ext4/xfs）的容量，监控它等于重复统计。
- **干扰图表**：Prometheus 会塞满 `device="overlay"`、`fstype="overlay"` 的时序数据，磁盘面板无法使用。

#### 2. tmpfs

**本质**：**内存文件系统**（temporary filesystem），数据完全存储在 RAM 中，断电或卸载即丢失。

**Docker 中的作用**：容器内的 `/run`、`/tmp`、`/dev/shm` 通常默认使用 tmpfs，加速临时文件读写。

**排除原因**：
- **不是磁盘**：Node Exporter 的 `filesystem` 采集器关注的是块设备磁盘，tmpfs 占的是内存，混进来会扭曲磁盘使用率。
- **容易误报警**：tmpfs 容量受内存限制，满了应该走内存告警通道，而不是磁盘告警。
- **无持久价值**：tmpfs 的数据本来就是临时的，监控其容量变化没有运维意义。

#### 3. 其他常见虚拟类型

| 类型 | 本质 | 排除原因 |
|------|------|----------|
| `proc` / `procfs` / `sysfs` / `devtmpfs` / `devpts` | 内核虚拟文件系统 | 无物理容量。 |
| `cgroup` / `cgroup2` | 容器资源隔离层级 | 不是磁盘，用于限制 CPU/内存。 |
| `nsfs` / `mqueue` / `bpf` / `configfs` / `debugfs` / `tracefs` / `pstore` / `rpc_pipefs` / `securityfs` / `selinuxfs` | 内核命名空间/调试/安全相关 | 各种特殊用途的伪文件系统。 |
| `autofs` | 自动挂载占位点 | 尚未真正挂载，无容量。 |
| `squashfs` | 只读压缩镜像（常用于 snap） | 容量固定不变，通常不需要监控。 |
| `iso9660` | 光盘镜像 | 无监控意义。 |

---

## 这套规则是否通用？

### 80% 场景直接可用

以下环境中，当前 Dockerfile 的排除规则基本无需修改：
- 公有云 ECS/EC2/CVM（阿里云、AWS、腾讯云）
- 裸金属服务器运行 Docker / Kubernetes
- 标准虚拟机（KVM、VMware、Hyper-V）

**原因**：这些系统的内核虚拟文件系统大同小异，Docker 都用 OverlayFS，tmpfs 都是内存盘。

### 行业例外

当业务数据落在**非本地块设备**上时，需要谨慎调整：

| 行业/场景 | 可能不该排除的类型 | 原因 |
|-----------|-------------------|------|
| HPC / AI 训练 | `lustre`、`gpfs`、`beegfs` | 核心生产数据存在并行文件系统上，容量必须监控。 |
| 金融 / 传统企业 | `nfs`、`nfs4`、`cifs` | 交易数据或共享目录挂在 NAS 上，是真实容量。 |
| 游戏 / 音视频 | `ceph`、`cephfs`、`zfs` | 资源库、素材库常用分布式存储或 ZFS 池。 |
| 嵌入式 / 物联网 | `squashfs`、`overlay` | 某些嵌入式系统把 overlay 做在闪存上，可能是唯一持久存储。 |

---

## 如何判断该排除哪些？

### 步骤 1：查看实际挂载

在目标服务器上执行：

```bash
df -T
```

或更详细的：

```bash
mount | awk '{print $3, $5}'
```

你会看到类似输出：

```
Filesystem     Type
/dev/vda1      ext4
/dev/vdb1      xfs
tmpfs          tmpfs
overlay        overlay
nas01:/data    nfs4
192.168.1.10:/vol ceph
```

### 步骤 2：三问法

对每个文件系统类型问自己：

1. **它有真实持久化的磁盘容量吗？** → 没有，排除。
2. **它是 Docker/容器内部的伪挂载吗？** → 是，排除。
3. **这个挂载点上存着我的业务数据吗？** → 是，**必须保留**。

### 步骤 3：在 Prometheus 中验证

先运行 5 分钟，在 Prometheus 查询：

```promql
node_filesystem_avail_bytes
```

观察返回的 `fstype` 和 `mountpoint` 标签：
- 如果看到大量 `fstype="overlay"` → 确认需要排除 overlay。
- 如果看到 `fstype="nfs4"` 且 mountpoint 是 `/data` → 确认**不能排除 nfs4**。
- 如果看到 `fstype="zfs"` 且是你重要的数据池 → 确认要保留。

**原则**：宁可先多排除一些，发现漏了再加回去；也不要一开始不排除，导致数据被淹没。

---

## 保守模板（推荐用于企业环境）

如果你不确定是否有 NFS/Ceph/ZFS 等共享存储，可以使用这个更保守的版本：

```bash
--collector.filesystem.mount-points-exclude='^/(sys|proc|dev|run|var/lib/docker/.+|run/docker/.+|boot|snap)($$|/)'
--collector.filesystem.fs-types-exclude='^(autofs|binfmt_misc|bpf|cgroup2?|configfs|debugfs|devpts|devtmpfs|fusectl|hugetlbfs|iso9660|mqueue|nsfs|overlay|proc|procfs|pstore|rpc_pipefs|securityfs|selinuxfs|squashfs|sysfs|tmpfs|tracefs)$'
```

**与激进版（原 Dockerfile）的区别**：
- **保留了** `nfs`、`nfs4`、`ceph`、`cephfs`、`zfs`、`lustre`、`gpfs` 等类型。
- 适合金融、HPC、游戏等使用共享存储的行业。

如果你确认服务器上只有本地 ext4/xfs 磁盘，直接使用原 Dockerfile 的排除规则即可。
