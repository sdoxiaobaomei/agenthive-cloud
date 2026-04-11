#!/bin/bash
# AgentHive Cloud 成本优化脚本
# 使用方法: ./cost-optimization.sh [action]

set -euo pipefail

NAMESPACE="agenthive"
LOG_FILE="/var/log/agenthive-cost-optimization.log"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# 1. 资源右调建议
# ============================================================================
resource_right_sizing() {
    log "=== 资源右调分析 ==="
    
    # 获取所有 Deployment 的资源使用情况
    kubectl top pods -n $NAMESPACE --containers 2>/dev/null | awk '
    NR>1 {
        pod=$1; container=$2; cpu=$3; memory=$4
        gsub(/m/,"",cpu)
        gsub(/Mi/,"",memory)
        print pod","container","cpu","memory
    }' > /tmp/current_usage.csv
    
    echo "Pod,Container,Current CPU(m),Current Memory(Mi),CPU Request,CPU Limit,Memory Request,Memory Limit,Recommendation" > /tmp/right_sizing_report.csv
    
    # 遍历所有 deployment
    for deploy in $(kubectl get deployments -n $NAMESPACE -o name | cut -d/ -f2); do
        # 获取资源请求/限制
        resources=$(kubectl get deployment $deploy -n $NAMESPACE -o json | jq -r '
            .spec.template.spec.containers[] | 
            [.name, 
             (.resources.requests.cpu // "0"), 
             (.resources.limits.cpu // "0"),
             (.resources.requests.memory // "0"),
             (.resources.limits.memory // "0")] | 
            @tsv
        ')
        
        while IFS=$'\t' read -r container req_cpu limit_cpu req_mem limit_mem; do
            # 转换资源值为数值
            req_cpu_m=$(echo $req_cpu | sed 's/m//' | sed 's/[^0-9]//g')
            limit_cpu_m=$(echo $limit_cpu | sed 's/m//' | sed 's/[^0-9]//g')
            req_mem_mi=$(echo $req_mem | sed 's/Mi//' | sed 's/[^0-9]//g')
            limit_mem_mi=$(echo $limit_mem | sed 's/Mi//' | sed 's/[^0-9]//g')
            
            # 获取实际使用 (平均值)
            actual_cpu=$(grep ",$container," /tmp/current_usage.csv | awk -F, '{sum+=$3; count++} END {print (count>0)?sum/count:0}')
            actual_mem=$(grep ",$container," /tmp/current_usage.csv | awk -F, '{sum+=$4; count++} END {print (count>0)?sum/count:0}')
            
            # 计算建议值
            if (( $(echo "$actual_cpu > 0" | bc -l) )); then
                rec_cpu_request=$(echo "$actual_cpu * 1.5" | bc | cut -d. -f1)
                rec_cpu_limit=$(echo "$actual_cpu * 3" | bc | cut -d. -f1)
            else
                rec_cpu_request=$req_cpu_m
                rec_cpu_limit=$limit_cpu_m
            fi
            
            if (( $(echo "$actual_mem > 0" | bc -l) )); then
                rec_mem_request=$(echo "$actual_mem * 1.3" | bc | cut -d. -f1)
                rec_mem_limit=$(echo "$actual_mem * 2" | bc | cut -d. -f1)
            else
                rec_mem_request=$req_mem_mi
                rec_mem_limit=$limit_mem_mi
            fi
            
            # 生成建议
            recommendation=""
            if (( rec_cpu_request < req_cpu_m * 0.5 )); then
                recommendation+="CPU over-provisioned; "
            elif (( actual_cpu > req_cpu_m * 0.9 )); then
                recommendation+="CPU near limit; "
            fi
            
            if (( rec_mem_request < req_mem_mi * 0.5 )); then
                recommendation+="Memory over-provisioned; "
            elif (( actual_mem > req_mem_mi * 0.9 )); then
                recommendation+="Memory near limit; "
            fi
            
            if [ -z "$recommendation" ]; then
                recommendation="OK"
            fi
            
            echo "$deploy,$container,${actual_cpu:-N/A},${actual_mem:-N/A},${req_cpu_m},${limit_cpu_m},${req_mem_mi},${limit_mem_mi},$recommendation" >> /tmp/right_sizing_report.csv
        done <<< "$resources"
    done
    
    log "资源右调报告已生成: /tmp/right_sizing_report.csv"
    cat /tmp/right_sizing_report.csv
}

# ============================================================================
# 2. 识别并清理空闲资源
# ============================================================================
cleanup_idle_resources() {
    log "=== 清理空闲资源 ==="
    
    # 查找低利用率 Pod (CPU < 10m 且 Memory < 50Mi 持续 7 天)
    log "查找低利用率 Pod..."
    
    # 获取过去7天的 Pod 列表
    kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running -o name | while read pod; do
        pod_name=$(echo $pod | cut -d/ -f2)
        
        # 检查是否近期有活动
        last_start=$(kubectl get pod $pod_name -n $NAMESPACE -o jsonpath='{.status.startTime}')
        days_running=$(( ($(date +%s) - $(date -d "$last_start" +%s)) / 86400 ))
        
        if [ $days_running -gt 7 ]; then
            # 检查是否配置了 HPA
            has_hpa=$(kubectl get hpa -n $NAMESPACE -o json | jq -r --arg pod "$pod_name" '.items[] | select(.spec.scaleTargetRef.name | contains($pod)) | .metadata.name')
            
            if [ -z "$has_hpa" ]; then
                log "警告: Pod $pod_name 已运行 $days_running 天且无 HPA，请检查是否需要"
            fi
        fi
    done
    
    # 清理未使用的 ConfigMap
    log "检查未使用的 ConfigMap..."
    kubectl get configmaps -n $NAMESPACE -o name | while read cm; do
        cm_name=$(echo $cm | cut -d/ -f2)
        used=$(kubectl get pods -n $NAMESPACE -o json | jq -r --arg cm "$cm_name" '.items[].spec.volumes[]?.configMap.name // empty | select(. == $cm)')
        env_used=$(kubectl get pods -n $NAMESPACE -o json | jq -r --arg cm "$cm_name" '.items[].spec.containers[].envFrom[]?.configMapRef.name // empty | select(. == $cm)')
        
        if [ -z "$used" ] && [ -z "$env_used" ]; then
            log "未使用的 ConfigMap: $cm_name (请手动确认后删除)"
        fi
    done
    
    # 清理未使用的 Secret
    log "检查未使用的 Secret..."
    kubectl get secrets -n $NAMESPACE -o name | grep -v "default-token" | while read secret; do
        secret_name=$(echo $secret | cut -d/ -f2)
        used=$(kubectl get pods -n $NAMESPACE -o json | jq -r --arg secret "$secret_name" '.items[].spec.volumes[]?.secret.secretName // empty | select(. == $secret)')
        env_used=$(kubectl get pods -n $NAMESPACE -o json | jq -r --arg secret "$secret_name" '.items[].spec.containers[].envFrom[]?.secretRef.name // empty | select(. == $secret)')
        
        if [ -z "$used" ] && [ -z "$env_used" ]; then
            log "未使用的 Secret: $secret_name (请手动确认后删除)"
        fi
    done
}

# ============================================================================
# 3. Spot 实例中断处理优化
# ============================================================================
optimize_spot_instances() {
    log "=== Spot 实例优化 ==="
    
    # 检查 Spot 中断处理配置
    if kubectl get daemonset aws-node-termination-handler -n kube-system &>/dev/null; then
        log "Spot 中断处理器已安装"
    else
        log "警告: Spot 中断处理器未安装，建议安装 aws-node-termination-handler"
    fi
    
    # 检查 Pod 反亲和性配置
    log "检查 Pod 反亲和性配置..."
    kubectl get deployments -n $NAMESPACE -o json | jq -r '
        .items[] | 
        select(.spec.template.spec.affinity.podAntiAffinity == null) | 
        "警告: Deployment \(.metadata.name) 未配置 Pod 反亲和性"
    '
    
    # 检查 PDB (Pod Disruption Budget)
    log "检查 Pod Disruption Budget..."
    kubectl get pdb -n $NAMESPACE -o name || log "未配置 PDB，建议为关键服务配置"
}

# ============================================================================
# 4. 开发环境自动休眠/唤醒
# ============================================================================
dev_environment_scheduler() {
    log "=== 开发环境调度 ==="
    
    action=${1:-status}
    
    case $action in
        sleep)
            log "正在休眠开发环境..."
            # 将副本数缩减到 0
            kubectl get deployments -n ${NAMESPACE}-dev -o name | xargs -I {} kubectl scale {} --replicas=0 -n ${NAMESPACE}-dev
            kubectl get statefulsets -n ${NAMESPACE}-dev -o name | xargs -I {} kubectl scale {} --replicas=0 -n ${NAMESPACE}-dev
            log "开发环境已休眠"
            ;;
        wake)
            log "正在唤醒开发环境..."
            # 恢复默认副本数
            kubectl get deployments -n ${NAMESPACE}-dev -o name | xargs -I {} kubectl scale {} --replicas=1 -n ${NAMESPACE}-dev
            kubectl get statefulsets -n ${NAMESPACE}-dev -o name | xargs -I {} kubectl scale {} --replicas=1 -n ${NAMESPACE}-dev
            log "开发环境已唤醒"
            ;;
        status)
            log "开发环境状态:"
            kubectl get deployments -n ${NAMESPACE}-dev -o custom-columns=NAME:.metadata.name,REPLICAS:.spec.replicas
            ;;
    esac
}

# ============================================================================
# 5. 成本报告生成
# ============================================================================
generate_cost_report() {
    log "=== 生成成本报告 ==="
    
    report_file="/tmp/cost-report-$(date +%Y%m%d).txt"
    
    echo "========================================" > $report_file
    echo "AgentHive Cloud 成本报告" >> $report_file
    echo "生成时间: $(date)" >> $report_file
    echo "========================================" >> $report_file
    echo "" >> $report_file
    
    # 计算资源请求
    echo "资源请求汇总:" >> $report_file
    echo "----------------------------------------" >> $report_file
    kubectl get pods -n $NAMESPACE -o json | jq -r '
        [.items[].spec.containers[].resources.requests // {}] | 
        group_by(.cpu) | 
        map({cpu: .[0].cpu, count: length}) | 
        .[] | 
        "CPU Request: \(.cpu // "N/A"), Pods: \(.count)"
    ' >> $report_file
    
    kubectl get pods -n $NAMESPACE -o json | jq -r '
        [.items[].spec.containers[].resources.requests // {}] | 
        group_by(.memory) | 
        map({memory: .[0].memory, count: length}) | 
        .[] | 
        "Memory Request: \(.memory // "N/A"), Pods: \(.count)"
    ' >> $report_file
    
    echo "" >> $report_file
    echo "当前运行 Pod 数量:" >> $report_file
    kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running --no-headers | wc -l >> $report_file
    
    echo "" >> $report_file
    echo "按应用分类的 Pod 数量:" >> $report_file
    echo "----------------------------------------" >> $report_file
    kubectl get pods -n $NAMESPACE --field-selector=status.phase=Running -o custom-columns=APP:.metadata.labels.app --no-headers | sort | uniq -c | sort -rn >> $report_file
    
    echo "" >> $report_file
    echo "节点类型分布:" >> $report_file
    echo "----------------------------------------" >> $report_file
    kubectl get nodes -o custom-columns=NAME:.metadata.name,TYPE:.metadata.labels.\"node.kubernetes.io/instance-type\",CAPACITY:.metadata.labels.\"karpenter.sh/capacity-type\" --no-headers | sort -k3 | uniq -c >> $report_file
    
    log "成本报告已生成: $report_file"
    cat $report_file
}

# ============================================================================
# 6. 自动优化 (定时任务用)
# ============================================================================
auto_optimize() {
    log "=== 自动优化模式 ==="
    
    # 资源右调
    resource_right_sizing
    
    # 清理空闲资源
    cleanup_idle_resources
    
    # Spot 优化检查
    optimize_spot_instances
    
    # 生成报告
    generate_cost_report
}

# ============================================================================
# 主函数
# ============================================================================
main() {
    action=${1:-help}
    
    case $action in
        analyze|resource-right-sizing)
            resource_right_sizing
            ;;
        cleanup)
            cleanup_idle_resources
            ;;
        spot)
            optimize_spot_instances
            ;;
        dev-schedule)
            dev_environment_scheduler ${2:-status}
            ;;
        report)
            generate_cost_report
            ;;
        auto)
            auto_optimize
            ;;
        help|*)
            echo "AgentHive Cloud 成本优化工具"
            echo ""
            echo "用法: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  analyze              分析资源使用并生成右调建议"
            echo "  cleanup              识别并标记空闲资源"
            echo "  spot                 检查 Spot 实例优化"
            echo "  dev-schedule [sleep|wake|status]  开发环境调度"
            echo "  report               生成成本报告"
            echo "  auto                 运行所有优化检查"
            echo ""
            ;;
    esac
}

main "$@"
