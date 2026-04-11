# Kubernetes 快速参考卡片

打印出来放显示器旁边!

---

## 🚀 快速开始

```bash
# 查看集群信息
kubectl cluster-info

# 查看节点
kubectl get nodes

# 查看所有命名空间
kubectl get ns

# 切换命名空间
kubectl config set-context --current --namespace=<namespace>
```

---

## 📦 Pod 管理

```bash
# 查看 Pod
kubectl get pods
kubectl get pods -n <namespace>
kubectl get pods -A  # 所有命名空间
kubectl get pods -o wide  # 详细信息
kubectl get pods --show-labels

# 查看 Pod 详情
kubectl describe pod <pod-name>

# 查看日志
kubectl logs <pod-name>
kubectl logs <pod-name> -f  # 实时
kubectl logs <pod-name> --tail=100  # 最后100行
kubectl logs <pod-name> -c <container-name>  # 多容器

# 进入容器
kubectl exec -it <pod-name> -- /bin/sh
kubectl exec -it <pod-name> -- bash

# 删除 Pod
kubectl delete pod <pod-name>

# 创建临时 Pod 测试
kubectl run test --image=nginx --rm -it --restart=Never -- /bin/sh
```

---

## 🔄 Deployment 管理

```bash
# 查看 Deployment
kubectl get deployments
kubectl get deploy

# 查看详情
kubectl describe deployment <deploy-name>

# 扩容/缩容
kubectl scale deployment <deploy-name> --replicas=3

# 更新镜像
kubectl set image deployment/<deploy-name> <container>=<image>:<tag>

# 滚动重启
kubectl rollout restart deployment/<deploy-name>

# 查看滚动状态
kubectl rollout status deployment/<deploy-name>

# 回滚
kubectl rollout undo deployment/<deploy-name>
kubectl rollout undo deployment/<deploy-name> --to-revision=2

# 查看历史
kubectl rollout history deployment/<deploy-name>
```

---

## 🌐 Service & 网络

```bash
# 查看 Service
kubectl get services
kubectl get svc

# 查看详情
kubectl describe svc <svc-name>

# 端口转发到本地
kubectl port-forward svc/<svc-name> 8080:80
kubectl port-forward pod/<pod-name> 8080:80

# 查看 Endpoints
kubectl get endpoints

# 测试服务
kubectl run curl --image=curlimages/curl --rm -it --restart=Never -- curl <svc-name>:<port>
```

---

## 💾 存储

```bash
# 查看 PV
kubectl get pv

# 查看 PVC
kubectl get pvc

# 查看 StorageClass
kubectl get sc

# 查看 ConfigMap
kubectl get configmap
kubectl get cm
kubectl describe cm <cm-name>

# 查看 Secret
kubectl get secret
kubectl describe secret <secret-name>
kubectl get secret <secret-name> -o jsonpath='{.data.<key>}' | base64 -d
```

---

## 🔐 RBAC

```bash
# 查看 ServiceAccount
kubectl get serviceaccount
kubectl get sa

# 查看 Role
kubectl get roles

# 查看 RoleBinding
kubectl get rolebindings

# 查看 ClusterRole
kubectl get clusterroles

# 查看 ClusterRoleBinding
kubectl get clusterrolebindings
```

---

## 📊 资源监控

```bash
# 查看资源使用（需要 metrics-server）
kubectl top nodes
kubectl top pods
kubectl top pods -n <namespace>

# 查看 Pod 资源限制
kubectl describe pod <pod-name> | grep -A 5 "Limits"

# 查看事件
kubectl get events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl get events -n <namespace> --field-selector type=Warning
```

---

## 🛠️ 调试技巧

```bash
# 查看 Pod 启动失败原因
kubectl describe pod <pod-name> | grep -A 10 Events

# 查看容器退出码
kubectl get pod <pod-name> -o jsonpath='{.status.containerStatuses[0].state}'

# 复制文件到/从容器
kubectl cp <pod-name>:/path/in/container /local/path
kubectl cp /local/path <pod-name>:/path/in/container

# 运行临时调试 Pod
kubectl run debug --rm -it --image=nicolaka/netshoot -- /bin/bash

# 查看 DNS 配置
kubectl run -it --rm debug --image=busybox:1.28 --restart=Never -- nslookup kubernetes.default
```

---

## 📝 YAML 操作

```bash
# 导出资源为 YAML
kubectl get deploy <name> -o yaml > deploy.yaml

# 编辑资源
kubectl edit deploy <name>

# 应用 YAML
kubectl apply -f file.yaml
kubectl apply -f dir/  # 整个目录
kubectl apply -k dir/  # Kustomize

# 删除资源
kubectl delete -f file.yaml

# 生成 YAML（不执行）
kubectl run nginx --image=nginx --dry-run=client -o yaml

# 解释资源字段
kubectl explain pod
kubectl explain pod.spec.containers
```

---

## 🎯 AgentHive 专用

```bash
# 查看所有资源
kubectl get all -n agenthive

# 查看 Pod 日志
kubectl logs -f deployment/api -n agenthive --tail=100
kubectl logs -f deployment/landing -n agenthive --tail=100
kubectl logs -f statefulset/postgres -n agenthive --tail=50

# 进入容器
kubectl exec -it deployment/api -n agenthive -- sh
kubectl exec -it statefulset/postgres -n agenthive -- psql -U agenthive

# 端口转发
kubectl port-forward svc/api 3001:3001 -n agenthive
kubectl port-forward svc/postgres 5432:5432 -n agenthive
kubectl port-forward svc/redis 6379:6379 -n agenthive

# 重启服务
kubectl rollout restart deployment/api -n agenthive
kubectl rollout restart deployment/landing -n agenthive

# 完全清理
kubectl delete -k k8s/local/
kubectl delete pvc --all -n agenthive
```

---

## 🐳 Kind 专用

```bash
# 查看集群
kind get clusters

# 创建集群
kind create cluster --name my-cluster
kind create cluster --config kind-config.yaml

# 删除集群
kind delete cluster --name my-cluster

# 导出 kubeconfig
kind export kubeconfig --name my-cluster

# 加载本地镜像到 Kind
kind load docker-image my-image:latest --name my-cluster

# 进入节点
docker exec -it my-cluster-control-plane bash
```

---

## 💡 快捷别名

添加到 `~/.bashrc` 或 `~/.zshrc`:

```bash
# Kubectl 别名
alias k='kubectl'
alias kg='kubectl get'
alias kd='kubectl describe'
alias kdel='kubectl delete'
alias ka='kubectl apply'
alias kaf='kubectl apply -f'
alias kgp='kubectl get pods'
alias kgd='kubectl get deploy'
alias kgs='kubectl get svc'
alias kgn='kubectl get nodes'
alias kdf='kubectl delete -f'
alias kl='kubectl logs'
alias klf='kubectl logs -f'
alias ke='kubectl exec -it'

# 命名空间快捷
alias kns='kubectl config set-context --current --namespace'
```

---

## 📚 资源类型速查

| 短名 | 全称 | 说明 |
|-----|------|------|
| pod | pods | 最小部署单元 |
| deploy | deployments | 无状态应用 |
| sts | statefulsets | 有状态应用 |
| ds | daemonsets | 守护进程集 |
| svc | services | 服务暴露 |
| ing | ingresses | 入口路由 |
| cm | configmaps | 配置数据 |
| secret | secrets | 敏感数据 |
| pv | persistentvolumes | 持久卷 |
| pvc | persistentvolumeclaims | 持久卷声明 |
| sa | serviceaccounts | 服务账号 |
| ns | namespaces | 命名空间 |
| node | nodes | 集群节点 |
