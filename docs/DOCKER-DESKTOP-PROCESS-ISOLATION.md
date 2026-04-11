# Docker Desktop 进程隔离详解

> 解释容器里的进程是否会出现在主机任务管理器中

---

## 🤔 问题的核心

**用户观察到的现象**:
```
Windows 任务管理器
  └── 进程列表
        └── node.exe 监听 3001 端口  ← 这是哪来的？

疑问:
  1. 这是容器里的 node 进程吗？
  2. 容器里的进程会体现在主机里吗？
  3. 这是正常的吗？
```

**直接答案**:
- ❌ **不正常** - 容器里的进程**不应该**直接出现在 Windows 任务管理器
- ⚠️ **可能的情况** - 你看到的是其他东西

---

## 🏗️ Docker Desktop 的进程隔离架构

### 完整的隔离层次

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Windows 主机                                          │
│                                                                              │
│  任务管理器能看到的进程:                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Docker Desktop.exe        (Docker 主程序)                        │   │
│  │  ✅ Docker Desktop Backend    (后端服务)                             │   │
│  │  ✅ com.docker.backend.exe    (后端进程)                             │   │
│  │  ✅ vpnkit.exe                (网络桥接)                             │   │
│  │  ✅ vmcompute.exe             (Hyper-V 计算服务)                      │   │
│  │                                                                     │   │
│  │  ❌ node.exe (容器里的)      ← 不应该看到！                         │   │
│  │  ❌ nginx.exe (容器里的)     ← 不应该看到！                         │   │
│  │  ❌ postgres.exe             ← 不应该看到！                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              Docker Desktop VM (Hyper-V / WSL2)                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Linux Kernel                                │  │   │
│  │  │                                                                  │  │   │
│  │  │   ┌─────────────────────────────────────────────────────────┐   │  │   │
│  │  │   │              Docker Daemon                               │   │  │   │
│  │  │   │                                                          │   │  │   │
│  │  │   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │   │  │   │
│  │  │   │   │ Container   │   │ Container   │   │ Container   │   │   │  │   │
│  │  │   │   │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │   │   │  │   │
│  │  │   │   │ │ node    │ │   │ │ nginx   │ │   │ │postgres │ │   │   │  │   │
│  │  │   │   │ │:3001    │ │   │ │ :80     │ │   │ │:5432    │ │   │   │  │   │
│  │  │   │   │ │ PID: 1  │ │   │ │ PID: 1  │ │   │ │ PID: 1  │ │   │   │  │   │
│  │  │   │   │ └─────────┘ │   │ └─────────┘ │   │ └─────────┘ │   │   │  │   │
│  │  │   │   └─────────────┘   └─────────────┘   └─────────────┘   │   │  │   │
│  │  │   │                                                          │   │  │   │
│  │  │   │   容器里的进程 PID 是独立的命名空间                         │   │  │   │
│  │  │   │   与 Windows 主机完全隔离                                   │   │  │   │
│  │  │   └─────────────────────────────────────────────────────────┘   │  │   │
│  │  │                                                                  │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 关键概念：Namespace 隔离

```yaml
Linux Namespace 机制:
  PID Namespace:    进程 ID 隔离（容器里的 PID 1 不是主机的 init）
  Network Namespace: 网络隔离（容器有自己的网卡、IP）
  Mount Namespace:  文件系统隔离（容器有自己的 /）
  UTS Namespace:    主机名隔离（容器可以有自己的 hostname）
  IPC Namespace:    进程间通信隔离
  User Namespace:   用户权限隔离

结果:
  容器里的进程 ↔ Windows 主机进程: 完全隔离，互相不可见
```

---

## 🔍 排查：任务管理器里的 node 进程到底是什么？

### 情况 1: 你在 Windows 主机上直接运行了 node（最常见）

```powershell
# 检查是否在主机上有 node 进程
Get-Process node -ErrorAction SilentlyContinue | 
  Select-Object Name, Id, Path, @{N='Port';E={
    (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue).LocalPort -join ', '
  }}

# 输出示例:
# Name  Id    Path                                      Port
# ----  --    ----                                      ----
# node  1234  C:\Program Files\nodejs\node.exe           3001
#         ↑
#         这是 Windows 上的 node，不是容器里的！
```

**如何确认**:
```powershell
# 1. 查看进程的完整路径
Get-Process node | Select-Object Path

# 如果是 C:\Program Files\nodejs\node.exe → 这是 Windows 安装的 node
# 如果是 C:\Users\...\AppData\...       → 可能是项目本地运行的

# 2. 停止容器后检查
docker stop <api-container>
# 如果 node 进程还在 → 确定是主机上的
# 如果 node 进程消失 → 可能是 Docker Desktop 的某种机制（不太可能）
```

### 情况 2: Docker Desktop 的端口转发进程

```powershell
# Docker Desktop 确实会创建一些进程来处理端口转发
# 但它们通常不叫 "node.exe"

# 查看端口 3001 的占用进程
Get-NetTCPConnection -LocalPort 3001 | 
  Select-Object LocalAddress, LocalPort, @{N='ProcessName';E={
    (Get-Process -Id $_.OwningProcess).ProcessName
  }}, @{N='ProcessPath';E={
    (Get-Process -Id $_.OwningProcess).Path
  }}

# 正常的输出应该是:
# LocalAddress  LocalPort  ProcessName        ProcessPath
# ------------  ---------  -----------        -----------
# 0.0.0.0       3001       com.docker.backend C:\Program Files\Docker\Docker\resources\com.docker.backend.exe
#         ↑
#         这是 Docker Desktop 的端口转发进程，不是 node
```

### 情况 3: WSL2 集成导致的混淆

```powershell
# 如果你通过 WSL2 运行了 node
# Windows 任务管理器可能会显示 wsl.exe 或 wslhost.exe

# 检查 WSL 进程
Get-Process wsl*, *wsl* | Select-Object Name, Id

# WSL 里的进程不会直接显示为 node.exe
# 它们会显示为 wsl.exe 的子进程或在 WSL VM 内部
```

---

## 🧪 验证实验

### 实验 1: 确认容器进程的隔离性

```powershell
# 步骤 1: 记录 Windows 当前的 node 进程
$before = Get-Process node -ErrorAction SilentlyContinue | Select-Object Id
Write-Host "启动容器前 node 进程数: $($before.Count)"

# 步骤 2: 启动一个 node 容器
docker run -d -p 3001:3001 --name test-node node:20-alpine node -e "
const http = require('http');
http.createServer((req, res) => res.end('Hello')).listen(3001);
"

# 步骤 3: 再次检查 Windows 的 node 进程
$after = Get-Process node -ErrorAction SilentlyContinue | Select-Object Id
Write-Host "启动容器后 node 进程数: $($after.Count)"

# 步骤 4: 对比 PID
Write-Host "新增进程:"
Compare-Object $before $after -Property Id

# 预期结果: 数量不变，或者增加的是 Docker Desktop 相关进程，不是 node.exe
# 因为容器里的 node 运行在 Linux VM 中，Windows 看不到

# 步骤 5: 清理
docker stop test-node
docker rm test-node
```

### 实验 2: 对比容器内外进程

```powershell
# Windows 主机上的进程
tasklist | findstr node
# （不应该看到容器里的 node）

# 进入 WSL2（Docker Desktop 的 VM）
wsl -d docker-desktop

# 在 VM 里查看进程
ps aux | grep node
# 这里应该能看到容器里的 node 进程！

# 退出 WSL
exit
```

### 实验 3: 网络层面的验证

```powershell
# 查看 3001 端口的监听情况
netstat -ano | findstr :3001

# 输出示例:
# TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345
#                                              ↑
#                                              进程 ID

# 查看这个进程是什么
tasklist | findstr 12345
# 如果是 Docker Desktop 的进程 → 正常
# 如果是 node.exe → 说明 node 在主机上运行
```

---

## ✅ 正确的认知

### 容器进程 vs 主机进程

| 特性 | 容器内进程 | Windows 主机进程 |
|------|-----------|-----------------|
| **可见性** | 只能在容器/Linux VM 内看到 | 只能在 Windows 上看到 |
| **PID** | 独立的 PID 命名空间 | Windows 自己的 PID |
| **任务管理器** | ❌ 不会出现 | ✅ 正常显示 |
| **资源监控** | 显示为 Docker Desktop 的资源占用 | 独立显示 |
| **结束进程** | `docker stop` 或 `kill` | Task Manager 或 `taskkill` |

### 什么情况会在主机看到 "node"？

```yaml
✅ 正常情况:
  - 你直接在 Windows 上安装了 Node.js
  - 你正在本机运行 npm run dev
  - 你使用了 nvm-windows
  - 其他应用程序内置了 node

❌ 不可能的情况:
  - Docker 容器里的 node 直接显示在任务管理器
  - 容器进程与主机进程混合
```

---

## 🔧 如何确定 node 进程的来源

### 方法 1: 查看进程路径

```powershell
# PowerShell 命令
Get-Process node | Select-Object Name, Id, Path

# 输出解释:
# Path: C:\Program Files\nodejs\node.exe          → Windows 安装的 Node
# Path: C:\Users\<name>\AppData\Roaming\npm\...   → npm 全局安装的包
# Path: C:\<project>\node_modules\...            → 项目本地运行的
```

### 方法 2: 查看父进程

```powershell
# 查看是谁启动了这个 node 进程
Get-WmiObject Win32_Process -Filter "Name='node.exe'" | 
  Select-Object Name, ProcessId, @{N='ParentProcess';E={
    (Get-Process -Id $_.ParentProcessId).ProcessName
  }}

# 如果父进程是:
# - cmd.exe / powershell.exe → 你手动启动的
# - explorer.exe             → 通过快捷方式启动的
# - services.exe             → 作为服务运行的
# - com.docker.*             → 可能是 Docker Desktop（不太可能）
```

### 方法 3: 查看命令行参数

```powershell
# 查看 node 启动时的完整命令
Get-WmiObject Win32_Process -Filter "Name='node.exe'" | 
  Select-Object ProcessId, CommandLine

# 这能帮你确定:
# - 是哪个项目的 node？
# - 运行的是什么脚本？
# - 工作目录在哪里？
```

### 方法 4: 停止 Docker 后检查

```powershell
# 1. 先记录当前的 node 进程
Get-Process node | Select-Object Id, Path | Out-File node_before.txt

# 2. 停止所有 Docker 容器
docker stop $(docker ps -q)

# 3. 退出 Docker Desktop
# 右下角托盘 → Docker Desktop → Quit

# 4. 再次检查 node 进程
Get-Process node | Select-Object Id, Path | Out-File node_after.txt

# 5. 对比
Compare-Object (Get-Content node_before.txt) (Get-Content node_after.txt)

# 如果 node 进程还在 → 确定不是 Docker 容器里的
```

---

## 🎯 给你的建议

### 如果你确定看到了 node.exe 监听 3001

```yaml
最可能的原因:
  1. 你之前在 Windows 上直接运行了 AgentHive API
     检查方式: Get-Process node | Select-Object Path

  2. 你有另一个终端在运行 npm run dev
     检查方式: 关闭所有终端，看 node 是否还在

  3. 某个 IDE (VS Code/WebStorm) 启动了 node
     检查方式: 关闭 IDE，看 node 是否还在

  4. 系统服务或启动项里有 node 程序
     检查方式: 任务管理器 → 启动 标签页
```

### 如何清理主机上的 node 进程

```powershell
# 方式 1: 优雅停止
# 找到对应的终端窗口，按 Ctrl+C

# 方式 2: 任务管理器
# 任务管理器 → 找到 node.exe → 右键 → 结束任务

# 方式 3: PowerShell
Get-Process node | Stop-Process -Force

# 方式 4: 命令行
taskkill /F /IM node.exe
```

---

## 📋 总结

| 问题 | 答案 |
|------|------|
| 容器里的 node 应该在任务管理器里吗？ | ❌ **不应该** |
| 如果看到了 node.exe，它是什么？ | 大概率是 **Windows 主机上直接运行的 node** |
| 如何确认？ | 查看进程路径、停止 Docker 后检查 |
| Docker Desktop 如何转发端口？ | 通过 `com.docker.backend.exe` 等进程，不是 node |

**一句话记忆**:
> Docker Desktop 容器里的进程运行在 Linux VM 中，Windows 任务管理器**看不到**它们。如果你看到了 node.exe，那一定是 Windows 主机上运行的另一个 node 程序。
