#!/bin/bash
# Agent Runtime Deployment Script

set -e

NAMESPACE="agenthive"
IMAGE_TAG=${1:-"latest"}

echo "🚀 Deploying Agent Runtime to Kubernetes..."
echo "Image tag: $IMAGE_TAG"

# Build Docker image
echo "📦 Building Docker image..."
docker build -t agenthive/agent-runtime:$IMAGE_TAG .

# Push to registry (optional)
if [ "$2" == "--push" ]; then
  echo "📤 Pushing to registry..."
  docker push agenthive/agent-runtime:$IMAGE_TAG
fi

# Create namespace if not exists
echo "🔧 Setting up namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes manifests
echo "☸️  Deploying to Kubernetes..."
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/hpa.yaml

# Wait for deployment
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/agent-runtime -n $NAMESPACE

# Show status
echo "✅ Deployment complete!"
echo ""
kubectl get pods -n $NAMESPACE -l component=agent-runtime
kubectl get svc -n $NAMESPACE
kubectl get hpa -n $NAMESPACE

echo ""
echo "📊 To view logs:"
echo "  kubectl logs -f deployment/agent-runtime -n $NAMESPACE"
echo ""
echo "🔧 To scale:"
echo "  kubectl scale deployment/agent-runtime --replicas=5 -n $NAMESPACE"
