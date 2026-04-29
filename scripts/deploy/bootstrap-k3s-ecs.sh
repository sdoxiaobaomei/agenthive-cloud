#!/usr/bin/env bash
# =============================================================================
# AgentHive Cloud — ECS 单节点 K3s 集群一键安装脚本
# TICKET: PLATFORM-005
# Purpose: Bootstrap single-node K3s server on Alibaba Cloud ECS
# Usage  : sudo bash scripts/bootstrap-k3s-ecs.sh [--skip-prechecks]
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKIP_PRECHECKS=false
CERT_MANAGER_VERSION="v1.14.0"
INGRESS_NGINX_VERSION="controller-v1.9.6"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# --- Helpers ---
log_info()  { echo -e "${BLUE}ℹ️  ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✅ ${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${NC} $1"; }
log_error() { echo -e "${RED}❌ ${NC} $1"; }
log_step()  { echo -e "${BOLD}\n═══════════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"; }

die() {
  log_error "$1"
  echo ""
  echo "Rollback: sudo /usr/local/bin/k3s-uninstall.sh"
  exit 1
}

# --- Parse arguments ---
for arg in "$@"; do
  case "$arg" in
    --skip-prechecks) SKIP_PRECHECKS=true ;;
    --help|-h)
      echo "Usage: sudo bash $0 [--skip-prechecks]"
      echo ""
      echo "Options:"
      echo "  --skip-prechecks   Skip prerequisite checks (not recommended)"
      echo "  --help, -h         Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  K3S_TOKEN          Join token (auto-generated if empty)"
      echo "  K3S_FLANNEL_IFACE  Network interface for Flannel (auto-detected if empty)"
      echo "  ACME_EMAIL         Email for Let's Encrypt (default: admin@xiaochaitian.asia)"
      exit 0
      ;;
  esac
done

# --- Must run as root ---
if [[ $EUID -ne 0 ]]; then
  die "This script must be run as root (use sudo)."
fi

# =============================================================================
# 1. Prerequisites Check
# =============================================================================
if [[ "$SKIP_PRECHECKS" != "true" ]]; then
  log_step "Step 1/7 — Prerequisites Check"

  # OS check
  OS_ID=""
  OS_VERSION=""
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    OS_ID="$ID"
    OS_VERSION="$VERSION_ID"
  fi

  SUPPORTED_OS=false
  case "$OS_ID" in
    alinux|alios) SUPPORTED_OS=true ;;
    centos|rhel|rocky|almalinux|anolis) SUPPORTED_OS=true ;;
    fedora) SUPPORTED_OS=true ;;
  esac

  if [[ "$SUPPORTED_OS" != "true" ]]; then
    log_warn "Unsupported OS detected: ${OS_ID:-unknown} ${OS_VERSION:-unknown}"
    log_warn "This script is designed for Alibaba Cloud Linux 3 / CentOS-compatible distributions."
    read -rp "Continue anyway? [y/N]: " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  else
    log_ok "OS check passed: ${OS_ID} ${OS_VERSION}"
  fi

  # Memory check (>= 2GB required, >= 4GB recommended)
  TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))

  if [[ $TOTAL_MEM_GB -lt 2 ]]; then
    die "Insufficient memory: ${TOTAL_MEM_GB}GB (minimum 2GB required)"
  elif [[ $TOTAL_MEM_GB -lt 4 ]]; then
    log_warn "Memory is ${TOTAL_MEM_GB}GB (>= 4GB recommended for production)"
  else
    log_ok "Memory check passed: ${TOTAL_MEM_GB}GB"
  fi

  # Disk check (>= 10GB free on /)
  DISK_FREE_GB=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
  if [[ $DISK_FREE_GB -lt 10 ]]; then
    die "Insufficient disk space: ${DISK_FREE_GB}GB free on / (minimum 10GB required)"
  else
    log_ok "Disk check passed: ${DISK_FREE_GB}GB free on /"
  fi

  # Port availability check
  REQUIRED_PORTS=(80 443 6443 10250 2379 2380 8472)
  PORTS_IN_USE=()
  for port in "${REQUIRED_PORTS[@]}"; do
    if command -v ss &>/dev/null; then
      if ss -tlnp | awk '{print $4}' | grep -q ":${port}$"; then
        PORTS_IN_USE+=("$port")
      fi
    elif command -v netstat &>/dev/null; then
      if netstat -tlnp 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
        PORTS_IN_USE+=("$port")
      fi
    fi
  done

  if [[ ${#PORTS_IN_USE[@]} -gt 0 ]]; then
    log_warn "Required ports already in use: ${PORTS_IN_USE[*]}"
    log_warn "K3s may fail to start or bind correctly."
    read -rp "Continue anyway? [y/N]: " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  else
    log_ok "Port check passed: 80/443/6443/10250/2379/2380/8472 available"
  fi

  # Docker check (warning only — K3s can coexist but not recommended)
  if command -v docker &>/dev/null && docker info &>/dev/null; then
    log_warn "Docker is installed and running. K3s uses containerd; coexistence is possible but may cause port/resource conflicts."
    read -rp "Continue anyway? [y/N]: " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  else
    log_ok "Docker not detected (clean environment)"
  fi

  # SELinux check (warn if enforcing)
  if command -v getenforce &>/dev/null && [[ "$(getenforce)" == "Enforcing" ]]; then
    log_warn "SELinux is Enforcing. K3s may require additional policy configuration."
    log_warn "Consider: setenforce 0 (temporary) or installing container-selinux"
  fi
else
  log_warn "Skipping prerequisite checks (--skip-prechecks)"
fi

# =============================================================================
# 2. Install K3s Server (single-node, no Traefik)
# =============================================================================
log_step "Step 2/7 — Install K3s Server"

if command -v k3s &>/dev/null; then
  log_warn "K3s is already installed."
  k3s --version
  read -rp "Re-install / repair? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log_info "Skipping K3s installation."
  else
    log_info "Uninstalling existing K3s first..."
    /usr/local/bin/k3s-uninstall.sh || true
  fi
fi

# Build install flags
K3S_INSTALL_FLAGS=(
  "--disable=traefik"
  "--node-name=k3s-ecs-server"
  "--write-kubeconfig-mode=644"
  "--kube-apiserver-arg=authorization-mode=Node,RBAC"
)

# Auto-detect public network interface for Flannel (prefer eth0 / eth1 / ensX)
FLANNEL_IFACE="${K3S_FLANNEL_IFACE:-}"
if [[ -z "$FLANNEL_IFACE" ]]; then
  for iface in eth0 eth1 ens5 ens160; do
    if ip link show "$iface" &>/dev/null; then
      FLANNEL_IFACE="$iface"
      break
    fi
  done
fi
if [[ -n "$FLANNEL_IFACE" ]]; then
  K3S_INSTALL_FLAGS+=("--flannel-iface=$FLANNEL_IFACE")
  log_info "Using Flannel interface: $FLANNEL_IFACE"
fi

log_info "Downloading and installing K3s (this may take 2-3 minutes)..."
# Use install script from Rancher — pinned for reproducibility
export INSTALL_K3S_VERSION="${INSTALL_K3S_VERSION:-v1.29.1+k3s1}"
curl -sfL https://get.k3s.io | sh -s - server "${K3S_INSTALL_FLAGS[@]}"

log_ok "K3s installed successfully"
k3s --version

# =============================================================================
# 3. Configure kubeconfig
# =============================================================================
log_step "Step 3/7 — Configure kubeconfig"

KUBECONFIG_SRC="/etc/rancher/k3s/k3s.yaml"
KUBECONFIG_DST="${HOME}/.kube/config"
KUBECONFIG_SYMLINK="${PROJECT_ROOT}/k3s.kubeconfig.yaml"

mkdir -p "$(dirname "$KUBECONFIG_DST")"
cp "$KUBECONFIG_SRC" "$KUBECONFIG_DST"
chmod 600 "$KUBECONFIG_DST"

# Harden the source kubeconfig as well
chmod 600 "$KUBECONFIG_SRC"

# Create a copy in project root for team access (also 600)
cp "$KUBECONFIG_SRC" "$KUBECONFIG_SYMLINK"
chmod 600 "$KUBECONFIG_SYMLINK"
sed -i "s|127.0.0.1|$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')|g" "$KUBECONFIG_SYMLINK" || true

# Symlink kubectl for convenience
if ! command -v kubectl &>/dev/null; then
  ln -sf /usr/local/bin/k3s /usr/local/bin/kubectl
fi

export KUBECONFIG="$KUBECONFIG_DST"
log_ok "kubeconfig installed: $KUBECONFIG_DST (mode 600)"
log_info "Cluster access: export KUBECONFIG=${KUBECONFIG_DST}"

# =============================================================================
# 4. Wait for K3s Ready
# =============================================================================
log_step "Step 4/7 — Wait for K3s Core Ready"

log_info "Waiting for node to be Ready..."
MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if kubectl get nodes 2>/dev/null | grep -q " Ready"; then
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo -n "."
done
echo ""

if [[ $WAITED -ge $MAX_WAIT ]]; then
  die "K3s node did not become Ready within ${MAX_WAIT}s"
fi

log_ok "K3s node is Ready"
kubectl get nodes -o wide

# =============================================================================
# 5. Install ingress-nginx
# =============================================================================
log_step "Step 5/7 — Install ingress-nginx Controller"

# For bare-metal / single-node ECS, use the generic bare-metal manifest
# which uses hostNetwork or NodePort. We patch it to use hostNetwork
# so ports 80/443 are directly bound on the ECS node.
kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/baremetal/deploy.yaml"

# Patch ingress-nginx controller to use hostNetwork for direct 80/443 binding
kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/ports/0/hostPort", "value": 80}, {"op": "add", "path": "/spec/template/spec/containers/0/ports/1/hostPort", "value": 443}, {"op": "add", "path": "/spec/template/spec/hostNetwork", "value": true}]' || true

# Wait for ingress-nginx
log_info "Waiting for ingress-nginx controller (up to 120s)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s || die "ingress-nginx controller did not become ready"

log_ok "ingress-nginx installed and ready"

# =============================================================================
# 6. Install cert-manager + ClusterIssuers
# =============================================================================
log_step "Step 6/7 — Install cert-manager"

# Install cert-manager CRDs and controller
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

log_info "Waiting for cert-manager pods (up to 120s)..."
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s || die "cert-manager did not become ready"

log_ok "cert-manager installed and ready"

# Apply AgentHive ClusterIssuers
log_info "Applying ClusterIssuers..."
kubectl apply -k "${PROJECT_ROOT}/k8s/components/cert-manager/"

log_ok "ClusterIssuers applied"
kubectl get clusterissuers

# =============================================================================
# 7. Post-install Summary & Security Hardening
# =============================================================================
log_step "Step 7/7 — Post-install Summary"

# Ensure kubeconfig permissions remain strict
chmod 600 "$KUBECONFIG_DST"
chmod 600 "$KUBECONFIG_SYMLINK" || true

# Disable k3s-serving (self-signed) ingress if not needed
kubectl delete ingress -n kube-system --all 2>/dev/null || true

echo ""
echo -e "${GREEN}${BOLD}🎉 K3s bootstrap complete!${NC}"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Cluster Info${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
kubectl cluster-info
echo ""
kubectl get nodes -o wide
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Core Components${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo "  ingress-nginx:   $(kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'unknown')"
echo "  cert-manager:    $(kubectl get pods -n cert-manager -l app.kubernetes.io/instance=cert-manager -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo 'unknown')"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Next Steps${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo "  1. Configure Alibaba Cloud SLB / EIP to forward 80/443 → this ECS"
echo "  2. Update DNS A-record to point at the SLB/EIP public IP"
echo "  3. Verify with: bash scripts/verify-k3s.sh"
echo "  4. Deploy apps with: bash scripts/deploy-k8s.sh"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Security Notes${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo "  • kubeconfig:      ${KUBECONFIG_DST} (mode 600)"
echo "  • kubeconfig copy: ${KUBECONFIG_SYMLINK} (mode 600)"
echo "  • Firewall: Ensure ECS Security Group allows:"
echo "      TCP 80, 443  (HTTP/HTTPS ingress)"
echo "      TCP 6443     (Kubernetes API — restrict to bastion IP)"
echo "      TCP 10250    (Kubelet — restrict to node CIDR)"
echo "      UDP 8472     (Flannel VXLAN — restrict to node CIDR)"
echo "  • No hardcoded secrets in scripts. Email loaded from:"
echo "      k8s/components/cert-manager/cluster-issuers.yaml"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Rollback${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo "  To completely remove K3s:"
echo "    sudo /usr/local/bin/k3s-uninstall.sh"
echo "  Existing Docker Compose environment is untouched."
echo ""

# Run verification automatically
log_info "Running verification..."
bash "${SCRIPT_DIR}/verify-k3s.sh" || true
