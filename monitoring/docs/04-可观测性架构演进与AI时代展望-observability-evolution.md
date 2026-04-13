# 可观测性架构演进与 AI 时代展望

本文整理自业界公开的最佳实践、技术白皮书与厂商研究报告，涵盖从传统高可用集群到云原生、再到 AI 时代的可观测性体系演进路径。

> **阅读提示**：本文所有核心观点均标注了来源出处，供进一步查证。部分内容为对公开资料的综述与提炼，不代表单一厂商立场。

---

## 1. 云下高可用集群应用的可观测性系统架构

### 1.1 核心设计目标

在云下（On-Premise）高可用集群中，可观测性系统自身必须是高可用的。当单节点 OAP 服务器面临每秒数十万条追踪数据处理压力时，集群化部署成为必然选择[^1]。

### 1.2 典型架构：三层解耦

以 Apache SkyWalking 为例，其高可用集群由三大核心组件构成[^1]：

- **OAP 服务器集群**：负责数据接收、分析和存储
- **协调服务**：维护集群节点状态与配置同步（ZooKeeper / Etcd / Kubernetes）
- **共享存储**：Elasticsearch / BanyanDB 等分布式存储

**数据分片机制**：采用一致性哈希算法分配数据分片，追踪 ID 通过哈希映射到特定 OAP 节点，元数据通过广播同步，指标数据按时间窗口分片存储以支持并行聚合[^1]。

### 1.3 现代可观测性平台的统一架构趋势

随着数据量增长，业界逐渐形成"统一收集 + 统一存储 + 统一查询"的架构[^2]：

- **统一存储**：将原始数据存储在云对象存储（如 S3，采用 gzip + Parquet 格式），相比预先索引所有内容的高性能数据库，可将每字节成本降低一个数量级[^2]。
- **开源代表**：
  - 指标：Prometheus + Cortex / Mimir
  - 日志：Loki
  - 追踪：Tempo
- **列式数据库**：ClickHouse 也是常用方案，但存储层与查询层耦合，解耦能力受限[^2]。

### 1.4 企业实践：阿里云弹性计算管控可观测体系

阿里云 ECS 管控团队将可观测体系划分为五层[^3]：

| 层级 | 职责 | 核心原则 |
|------|------|----------|
| **Service（依赖服务层）** | 基于阿里云公共云产品构建 | Cloud First |
| **Data Center（数据中心）** | 汇聚 log、metric、trace、event、CMDB、业务数据 | 数据质量与覆盖度决定上层能力 |
| **Process Layer（处理层）** | ETL、统一建模、标准化、业务适配 | 统一建模 |
| **Operation Brain（运维大脑）** | 专家经验 + AIOps / LLMOps | 根因定位、容量预测 |
| **Automation Center（自动化中心）** | 告警通知、变更广播、自动扩容、限流自愈 | 标准化与业务覆盖 |

**关键洞察**：所有上层的可观测性工具都依赖同一份底层运维数据，避免数据孤岛[^3]。

---

## 2. 云原生的可观测性系统架构

### 2.1 云原生可观测性的三大支柱

在云原生（Cloud-Native）与 Kubernetes 环境下，可观测性以 **Metrics、Logs、Traces** 为三大支柱[^4][^5]：

- **Metrics**：反映系统性能和状态的关键数值数据（CPU、内存、延迟、错误率）
- **Logs**：离散事件记录，回答"发生了什么"
- **Traces**：请求在微服务间的完整流转路径，回答"请求如何流转"

### 2.2 推荐技术栈

| 数据类型 | 推荐工具组合 |
|----------|-------------|
| **Metrics** | Prometheus + Grafana |
| **Logs** | EFK（Elasticsearch + Fluentd + Kibana）或 PLG（Promtail + Loki + Grafana） |
| **Traces** | Jaeger 或 SkyWalking |

### 2.3 分层观测策略

Kubernetes 环境下的可观测性建议采用分层覆盖[^4][^6]：

1. **基础设施层**：CPU、内存、磁盘、网络
2. **系统层**：Kubernetes 组件状态、etcd 性能
3. **应用层**：响应时间、错误率、吞吐量（黄金指标）
4. **业务层**：用户行为、业务流程完成率

### 2.4 eBPF：内核级零侵入采集

eBPF（Extended Berkeley Packet Filter）已成为现代平台工程的支柱技术[^7][^8]。其核心优势在于：

- **零侵入**：无需修改应用代码或部署 Sidecar
- **全面性**：可采集程序调用、网络传输、协议栈性能、服务黄金指标
- **应对容器动态性**：容器启动/停止时自动感知，无需重启目标系统
- **与 OpenTelemetry 结合**：通过 eBPF 采集内核数据，经 OpenTelemetry Collector 标准化后导出[^8]

### 2.5 OpenTelemetry 成为事实标准

根据 CNCF 及各大云厂商推动，OpenTelemetry 正在巩固其在遥测数据采集中的基石地位[^7][^9]：

- 统一了 Metrics、Logs、Traces 的数据格式
- 2024 年进一步推出 **Profiling** 标准
- 由于协议和 Collector 的厂商无关性，后端可由不同厂商实现，避免锁定

### 2.6 架构设计原则：分层解耦

根据 Google Cloud 的研究，理想的云原生可观测性架构应包含四个核心模块[^6]：

- **数据采集层**：Agent / Collector / eBPF
- **处理层**：ETL、协议解析、指标聚合
- **存储层**：时序数据库、对象存储、数据湖
- **可视化层**：Grafana、Kibana、Jaeger UI

---

## 3. 云下迁移至云上：要做的事情与担忧

### 3.1 迁移必须做的事情

#### (1) 建立集中式日志与可见性

Microsoft Azure Cloud Adoption Framework 强烈建议[^10]：

> 使用**单个监视日志工作区**集中管理平台，除非基于角色的访问控制（RBAC）、数据主权要求和数据保留策略强制使用单独的工作区。集中日志记录对于运营管理团队所需的可见性至关重要。

#### (2) 数据保留策略

如果日志保留要求超过七年，应将日志导出到对象存储，并使用**不可变存储**（WORM 策略），使数据在用户指定的时间间隔内不可擦除且不可修改[^10]。

#### (3) Cloud First 策略

阿里云弹性计算管控团队的经验是[^3]：

- 优先考虑基于云产品的开放集成能力构建可观测性（如 SLS、ARMS、云监控）
- 独立运维乃至自主研发此类工具的收益往往不显著，业务规模扩大后独立运维成本会上升
- 深度挖掘云端产品潜能，减少运维边际成本

#### (4) 标准化与 SOP

- 建立标准化机制，确保数据模型、指标定义、日志格式的一致性
- 提供与开源工具、云产品无缝对接的可集成能力
- 设计之初预留模块化与水平扩展能力[^3]

### 3.2 迁移中的核心担忧

#### (1) 云产品本身的不可靠性

> 不妨提出一个挑战性问题：倘若依赖的 XXX 云产品突发故障，我们将如何应对？[^3]

近期 AK 故障引发的大量云产品异常事件表明，大量依赖云产品构建的观测能力在该场景下也会全部异常。团队需要内省并探讨：**如何在云产品可能出现故障的情境下，仍能确保核心的观测能力和监控告警机制的有效性？**[^3]

#### (2) 混合架构下的集成复杂性

- 云环境与本地部署混合时，可观测性数据集成会变得更加复杂
- 技术栈多样性要求可观测性解决方案与不同平台、框架兼容[^11]

#### (3) 网络流量监控与合规

Azure 建议使用网络观察程序（Network Watcher）主动监视流量流，通过 NSG 流日志分析虚拟网络中的 IP 流量，收集通信主机、应用程序协议、允许/阻止的流等关键信息[^10]。

---

## 4. AI 应用 vs 传统 Web / 游戏：可观测系统的区别

### 4.1 LLM 应用可观测性的独特难点

阿里云 ARMS 团队指出，实现 LLM 应用的可观测面临七大挑战[^11]：

| 挑战 | 具体表现 |
|------|----------|
| **数据量与复杂度** | 多模态输入（文本、图像、音频）+ 多阶段处理流程 |
| **性能与实时性** | 可观测性本身需要额外计算资源和网络带宽 |
| **安全与隐私** | LLM 涉及敏感数据，如何在保护隐私的同时收集观测数据 |
| **语义理解与模型解释** | 需要理解模型内部决策过程，监控准确性和偏见 |
| **动态调整与自适应** | 系统负载和资源可用性波动大，需要自适应调整 |
| **成本与效率** | 全面的可观测性可能带来较高成本（存储、计算） |
| **集成与兼容性** | 技术栈多样，混合架构集成复杂 |

### 4.2 软件 Agent vs 具身 Agent：可观测性的本质差异

根据 Datawhale《hello-agents》教材的总结[^12]：

| 维度 | 软件 Agent（传统 Web / API） | 具身 Agent（机器人 / 游戏） |
|------|---------------------------|---------------------------|
| **感知** | 结构化 JSON / 表格 | 非结构化、高维、充满噪声的传感器数据 |
| **可观测性** | **完全可观测**（Full Observability） | **部分可观测**（Partial Observability） |
| **行动空间** | 离散、确定（API 调用成功/失败） | 连续、随机（电机误差、摩擦力导致不确定） |
| **状态推断** | 直接获取 | 必须基于不完整观测历史推断世界状态 |

### 4.3 从"技术成功"到"业务成功"的监控转变

传统 Web 应用的可观测性关注：

- 请求为什么慢？
- 机器为什么宕机？
- 数据库为什么抖动？

而 AI 应用（尤其是 Agent）需要回答的新问题是[^13][^14]：

- 为什么 Agent 选了这个工具，而不是那个工具？
- 为什么它在这一轮对话里改变了策略？
- 为什么这次成本高出 3 倍？
- 为什么技术上成功了（HTTP 200），但业务上失败了？
- 为什么输出没有违反 API 错误阈值，却违反了业务规则？

### 4.4 数据模型：从 MELT 到 Wide Events

传统可观测性以 MELT（Metrics / Events / Logs / Traces）为核心。但在 Agent 时代，业界开始转向 **Wide Events**（高维度宽表事件）模型[^15]：

- **Metrics、Logs、Traces 不再是独立的存储系统**，而是对同一底层原始数据的不同查询视图
- Agent 场景需要记录：prompt、tool 调用、reasoning 步骤、eval 结果、policy 检查、成本等多维上下文
- ClickHouse（2025 年推出 ClickStack）和 GreptimeDB 等数据库都在向"统一存储、原始数据优先"的方向演进[^15]

---

## 5. AI 时代可观测性系统的展望与未来

### 5.1 核心定位升级：从排障工具到运行时控制平面

快猫星云的判断是[^13]：

> **AI Agent 和 LLM 应用进入生产后，可观测性不再只是排障工具，而会成为可靠性、治理、审计、成本控制和 Agent 自动化的运行时控制平面。**

底层逻辑：传统软件是确定性系统，而 Agent、LLM、工具调用、多步推理把系统变成了**更高变化率、更高不确定性、也更高成本敏感**的运行环境。系统越不确定，就越需要可观测性——不是更少，而是更多[^13]。

### 5.2 2025 年可观测性十大趋势

综合 The New Stack、Grafana Labs、Dynatrace、阿里云开发者社区等来源，2025 年可观测性领域呈现以下关键趋势[^7]：

| 趋势 | 说明 |
|------|------|
| **AIOps 平台化** | 管理异常发现、根因分析、自动化功能的统一平台 |
| **OpenTelemetry 标准化** | 巩固遥测数据采集的基石地位，Profiling 加入标准 |
| **统一观测平台** | Log / Trace / Metric / Event / Profile 整合到单一视图 |
| **观测右移** | 从前端、边缘设备到 IoT 场景的轻量级采集 |
| **eBPF 成为平台工程支柱** | 把 Profiling 甚至整体观测责任从应用团队转移到平台团队 |
| **日志分析的 AI 化** | 通过传统 AI/ML 和生成式 AI 释放日志洞察力 |
| **从事后回溯到事前预防** | AI 驱动预测，在问题影响业务前进行干预 |
| **DevOps 与 AIOps 融合** | 形成统一的运营团队，管理软件生命周期和 AI 模型生命周期 |
| **AgentOps 兴起** | AI Agent 从实验走向生产的必经之路，可观测性是第一优先级 |
| **自然语言交互** | Chat2PromQL、Chat2SQL 降低查询门槛 |

### 5.3 下一代数据模型：MELT + 四层扩展

未来的可观测性平台，至少还要把以下四层变成"一等公民"[^13]：

1. **Agent Runtime**：agent、tool、handoff、workflow 的运行时状态
2. **Eval（评估）**：质量分、任务完成度、回归结果、人工审核结果
3. **Policy（策略）**：安全、权限、越权调用、敏感信息、合规审计
4. **Business Context**：用户、租户、订单、收入、转化、任务收益

这意味着可观测性必须从"纯技术遥测平台"进化成"技术与业务共同解释平台"[^13]。

### 5.4 数据稀缺性转移：从"采集"到"高质量上下文"

AI 时代的一个错觉是：只要把 prompt、trace、log 都收进来，问题就解决了。实际上，真正稀缺的是[^13]：

- **统一语义**：让不同来源的数据能被一致理解
- **业务关联**：让技术数据与业务结果挂钩
- **权限边界**：在正确权限下被 Agent 使用
- **成本控制**：在数据量暴涨的情况下还能跑得动

### 5.5 自动化演进路径：从建议到可审计的执行

未来的可观测性不会一步跳到 fully autonomous operations（完全自主运维），而是沿着以下路径演进[^13]：

1. **给建议**
2. **给证据**
3. **给可审计的 action plan**
4. **在明确授权边界内执行自动化动作**

> 未来的重点不是"自动化更多"，而是**在可信证据和权限约束下自动化**。[^13]

---

## 参考来源

[^1]: Apache SkyWalking 集群部署最佳实践：高可用架构设计. CSDN, 2025. https://blog.csdn.net/gitblog_00745/article/details/151592994
[^2]: 现代可观测性平台的架构. 腾讯云开发者社区, 2024. https://cloud.tencent.com/developer/article/2401727
[^3]: 浅谈弹性计算管控可观测性体系建设. 阿里云, 2024. http://mp.weixin.qq.com/s?__biz=MzIzOTU0NTQ0MA==&mid=2247537233&idx=1&sn=7f2140a4618e9dbae38074e24637cd14
[^4]: 可观测性概览. Kubernetes Handbook / Jimmy Song, 2025. https://jimmysong.io/zh/book/kubernetes-handbook/observability/overview/
[^5]: 云原生架构下 Kubernetes 与微服务可观测性实践指南. 云原生实践, 2024. https://www.oryoy.com/news/yun-yuan-sheng-jia-gou-xia-kubernetes-yu-wei-fu-wu-ke-guan-ce-xing-shi-jian-zhi-nan.html
[^6]: 云原生可观测性架构：Metrics、Tracing 与 Logging 集成. CSDN, 2025. https://blog.csdn.net/2501_92431050/article/details/148657238
[^7]: 2025 年可观测 10 大趋势预测. observability.cn / 阿里云开发者社区, 2025. https://observability.cn/article/hm7ie7gdct1f0gk4/
[^8]: 【CSA GCR】2023 云原生可观测性技术研究与应用白皮书. AIGC 研究报告, 2024. https://aigc.idigital.com.cn/djyanbao/【CSA%20GCR】2023云原生可观测性技术研究与应用白皮书-2024-02-04.pdf
[^9]: OpenTelemetry Profiling. OpenTelemetry Blog, 2024. https://opentelemetry.io/blog/2024/profiling/
[^10]: 清单和可见性注意事项 - Cloud Adoption Framework. Microsoft Learn, 2025. https://learn.microsoft.com/zh-cn/azure/cloud-adoption-framework/ready/landing-zone/design-area/management-platform
[^11]: 实现 LLM 应用的可观测，难在哪里？阿里云 / GOTC 2024, 2024. http://mp.weixin.qq.com/s?__biz=MjM5NzM0MjcyMQ==&mid=2650211387&idx=2&sn=042636d575a171e2c35a44003d56bdd6
[^12]: LLM & VLM & Agent 面试回答参考 - 4.9 软件 Agent vs 具身 Agent. Datawhale / hello-agents. https://github.com/datawhalechina/hello-agents/blob/main/Extra-Chapter/Extra01-参考答案.md （中国大陆访问困难时可尝试 Gitee 镜像或 Datawhale 官方渠道）
[^13]: AI 时代的可观测性：从排障工具到运行时控制平面. 快猫星云 / Flashcat, 2026. https://flashcat.cloud/blog/ai-era-observability-runtime-control-plane/
[^14]: AI 代理时代的可观测性. F5, 2025. https://www.f5.com.cn/company/blog/observability-in-the-age-of-ai-agents
[^15]: Agent 可观测性：旧瓶装新酒，还是需要新瓶？Greptime, 2025. https://greptime.cn/blogs/2025-12-11-agent-observability
