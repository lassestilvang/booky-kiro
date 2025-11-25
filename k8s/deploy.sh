#!/bin/bash

# Bookmark Manager Platform - Kubernetes Deployment Script
# This script deploys the entire platform to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="bookmark-manager"
TIMEOUT="300s"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please configure kubectl."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

create_namespace() {
    log_info "Creating namespace..."
    kubectl apply -f namespace.yaml
}

deploy_secrets() {
    log_warn "Deploying secrets..."
    log_warn "Make sure you have updated secrets.yaml with actual credentials!"
    read -p "Have you updated secrets.yaml? (yes/no): " answer
    
    if [ "$answer" != "yes" ]; then
        log_error "Please update secrets.yaml before deploying."
        exit 1
    fi
    
    kubectl apply -f secrets.yaml
}

deploy_config() {
    log_info "Deploying ConfigMap..."
    kubectl apply -f configmap.yaml
}

deploy_storage() {
    log_info "Creating PersistentVolumeClaims..."
    kubectl apply -f persistentvolumes.yaml
    
    log_info "Waiting for PVCs to be bound..."
    kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/postgres-pvc -n $NAMESPACE --timeout=$TIMEOUT || true
    kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/redis-pvc -n $NAMESPACE --timeout=$TIMEOUT || true
    kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/meilisearch-pvc -n $NAMESPACE --timeout=$TIMEOUT || true
    kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/minio-pvc -n $NAMESPACE --timeout=$TIMEOUT || true
}

deploy_statefulsets() {
    log_info "Deploying StatefulSets..."
    
    log_info "Deploying PostgreSQL..."
    kubectl apply -f statefulsets/postgres-statefulset.yaml
    
    log_info "Deploying Redis..."
    kubectl apply -f statefulsets/redis-statefulset.yaml
    
    log_info "Deploying MeiliSearch..."
    kubectl apply -f statefulsets/meilisearch-statefulset.yaml
    
    log_info "Deploying MinIO..."
    kubectl apply -f statefulsets/minio-statefulset.yaml
    
    log_info "Waiting for StatefulSets to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=ready pod -l app=meilisearch -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=ready pod -l app=minio -n $NAMESPACE --timeout=$TIMEOUT
}

deploy_services() {
    log_info "Deploying Services..."
    kubectl apply -f services/
}

deploy_applications() {
    log_info "Deploying application Deployments..."
    
    log_info "Deploying API..."
    kubectl apply -f deployments/api-deployment.yaml
    
    log_info "Deploying Frontend..."
    kubectl apply -f deployments/frontend-deployment.yaml
    
    log_info "Deploying Workers..."
    kubectl apply -f deployments/snapshot-worker-deployment.yaml
    kubectl apply -f deployments/index-worker-deployment.yaml
    kubectl apply -f deployments/maintenance-worker-deployment.yaml
    
    log_info "Waiting for Deployments to be ready..."
    kubectl wait --for=condition=available deployment/bookmark-api -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=available deployment/bookmark-frontend -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=available deployment/snapshot-worker -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=available deployment/index-worker -n $NAMESPACE --timeout=$TIMEOUT
    kubectl wait --for=condition=available deployment/maintenance-worker -n $NAMESPACE --timeout=$TIMEOUT
}

deploy_supporting_resources() {
    log_info "Deploying supporting resources..."
    
    kubectl apply -f serviceaccount.yaml
    kubectl apply -f networkpolicy.yaml
    kubectl apply -f poddisruptionbudget.yaml
    kubectl apply -f cronjob.yaml
}

deploy_ingress() {
    log_info "Deploying Ingress..."
    log_warn "Make sure you have updated ingress.yaml with your domain names!"
    read -p "Have you updated ingress.yaml? (yes/no): " answer
    
    if [ "$answer" != "yes" ]; then
        log_warn "Skipping Ingress deployment. You can deploy it later with: kubectl apply -f ingress.yaml"
        return
    fi
    
    kubectl apply -f ingress.yaml
}

run_migrations() {
    log_info "Running database migrations..."
    
    kubectl run migration-$(date +%s) \
        --image=bookmark-manager/api:latest \
        --restart=Never \
        --namespace=$NAMESPACE \
        --env="DB_HOST=postgres-service" \
        --env="DB_PORT=5432" \
        --env="DB_NAME=bookmark_manager" \
        --env="DB_USER=$(kubectl get secret bookmark-manager-secrets -n $NAMESPACE -o jsonpath='{.data.DB_USER}' | base64 -d)" \
        --env="DB_PASSWORD=$(kubectl get secret bookmark-manager-secrets -n $NAMESPACE -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)" \
        --command -- npm run migrate
    
    log_info "Migration job created. Check status with: kubectl get pods -n $NAMESPACE | grep migration"
}

show_status() {
    log_info "Deployment Status:"
    echo ""
    
    log_info "Pods:"
    kubectl get pods -n $NAMESPACE
    echo ""
    
    log_info "Services:"
    kubectl get svc -n $NAMESPACE
    echo ""
    
    log_info "Ingress:"
    kubectl get ingress -n $NAMESPACE
    echo ""
    
    log_info "HPA:"
    kubectl get hpa -n $NAMESPACE
    echo ""
    
    log_info "PVCs:"
    kubectl get pvc -n $NAMESPACE
}

# Main deployment flow
main() {
    log_info "Starting Bookmark Manager Platform deployment..."
    echo ""
    
    check_prerequisites
    create_namespace
    deploy_secrets
    deploy_config
    deploy_storage
    deploy_statefulsets
    deploy_services
    deploy_applications
    deploy_supporting_resources
    deploy_ingress
    
    echo ""
    log_info "Deployment completed successfully!"
    echo ""
    
    read -p "Do you want to run database migrations? (yes/no): " answer
    if [ "$answer" = "yes" ]; then
        run_migrations
    fi
    
    echo ""
    show_status
    
    echo ""
    log_info "Next steps:"
    echo "1. Check pod status: kubectl get pods -n $NAMESPACE"
    echo "2. View logs: kubectl logs -f deployment/bookmark-api -n $NAMESPACE"
    echo "3. Access the application via the Ingress URL"
    echo "4. Monitor HPA: kubectl get hpa -n $NAMESPACE -w"
}

# Run main function
main
