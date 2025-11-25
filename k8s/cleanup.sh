#!/bin/bash

# Bookmark Manager Platform - Kubernetes Cleanup Script
# This script removes all resources from the Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="bookmark-manager"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

confirm_deletion() {
    log_warn "This will delete ALL resources in the $NAMESPACE namespace!"
    log_warn "This action cannot be undone."
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " answer
    
    if [ "$answer" != "yes" ]; then
        log_info "Cleanup cancelled."
        exit 0
    fi
}

delete_resources() {
    log_info "Deleting Ingress..."
    kubectl delete -f ingress.yaml --ignore-not-found=true
    
    log_info "Deleting CronJobs..."
    kubectl delete -f cronjob.yaml --ignore-not-found=true
    
    log_info "Deleting PodDisruptionBudgets..."
    kubectl delete -f poddisruptionbudget.yaml --ignore-not-found=true
    
    log_info "Deleting NetworkPolicies..."
    kubectl delete -f networkpolicy.yaml --ignore-not-found=true
    
    log_info "Deleting ServiceAccounts..."
    kubectl delete -f serviceaccount.yaml --ignore-not-found=true
    
    log_info "Deleting Deployments..."
    kubectl delete -f deployments/ --ignore-not-found=true
    
    log_info "Deleting Services..."
    kubectl delete -f services/ --ignore-not-found=true
    
    log_info "Deleting StatefulSets..."
    kubectl delete -f statefulsets/ --ignore-not-found=true
    
    log_info "Waiting for pods to terminate..."
    kubectl wait --for=delete pod --all -n $NAMESPACE --timeout=120s || true
    
    log_info "Deleting PersistentVolumeClaims..."
    kubectl delete -f persistentvolumes.yaml --ignore-not-found=true
    
    log_info "Deleting ConfigMap..."
    kubectl delete -f configmap.yaml --ignore-not-found=true
    
    log_info "Deleting Secrets..."
    kubectl delete -f secrets.yaml --ignore-not-found=true
    
    log_info "Deleting Namespace..."
    kubectl delete -f namespace.yaml --ignore-not-found=true
}

main() {
    log_info "Starting cleanup of Bookmark Manager Platform..."
    echo ""
    
    confirm_deletion
    
    echo ""
    delete_resources
    
    echo ""
    log_info "Cleanup completed successfully!"
    log_info "All resources have been removed from the cluster."
}

main
