#!/bin/bash
# ==========================================
# AgentHive Cloud - Install NGINX Ingress Controller
# For Docker Desktop Kubernetes
# ==========================================

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Install NGINX Ingress Controller${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if Ingress Controller already exists
if kubectl get namespace ingress-nginx &> /dev/null; then
    echo -e "${YELLOW}Ingress Controller namespace already exists${NC}"
    
    if kubectl get deployment ingress-nginx-controller -n ingress-nginx &> /dev/null; then
        echo -e "${GREEN}Ingress Controller is already installed${NC}"
        echo ""
        echo -e "You can enable Ingress in k8s/local/ingress.yaml"
        echo -e "by uncommenting the Ingress resources"
        exit 0
    fi
fi

echo -e "${BLUE}Installing NGINX Ingress Controller...${NC}"
echo ""

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

echo ""
echo -e "${BLUE}Waiting for Ingress Controller to be ready...${NC}"

# Wait for namespace to be created
until kubectl get namespace ingress-nginx &> /dev/null; do
    echo "Waiting for namespace..."
    sleep 2
done

# Wait for deployment to be created
until kubectl get deployment ingress-nginx-controller -n ingress-nginx &> /dev/null; do
    echo "Waiting for deployment..."
    sleep 2
done

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=300s

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Ingress Controller Installed Successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "  1. Edit ${YELLOW}k8s/local/ingress.yaml${NC} and uncomment the Ingress resources"
echo -e "  2. Redeploy: ${YELLOW}kubectl apply -k k8s/local/${NC}"
echo ""
echo -e "  Access methods:"
echo -e "    - http://localhost (if using 'localhost' host)"
echo -e "    - http://agenthive.local (if using custom host, add to hosts file)"
echo ""

# Show Ingress Controller status
echo -e "${BLUE}Ingress Controller Status:${NC}"
kubectl get pods -n ingress-nginx
