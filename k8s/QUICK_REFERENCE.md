# Kubernetes Quick Reference

Quick commands for managing the Bookmark Manager Platform on Kubernetes.

## Deployment

```bash
# Quick deploy (automated)
cd k8s && ./deploy.sh

# Deploy with kustomize
kubectl apply -k k8s/

# Production deployment
kubectl apply -k k8s/overlays/production/

# Staging deployment
kubectl apply -k k8s/overlays/staging/
```

## Status Checks

```bash
# All resources
kubectl get all -n bookmark-manager

# Pods
kubectl get pods -n bookmark-manager
kubectl get pods -n bookmark-manager -w  # Watch mode

# Deployments
kubectl get deployments -n bookmark-manager

# StatefulSets
kubectl get statefulsets -n bookmark-manager

# Services
kubectl get svc -n bookmark-manager

# Ingress
kubectl get ingress -n bookmark-manager

# HPA
kubectl get hpa -n bookmark-manager

# PVCs
kubectl get pvc -n bookmark-manager

# Events
kubectl get events -n bookmark-manager --sort-by='.lastTimestamp'
```

## Logs

```bash
# API logs
kubectl logs -f deployment/bookmark-api -n bookmark-manager

# Frontend logs
kubectl logs -f deployment/bookmark-frontend -n bookmark-manager

# Worker logs
kubectl logs -f deployment/snapshot-worker -n bookmark-manager
kubectl logs -f deployment/index-worker -n bookmark-manager
kubectl logs -f deployment/maintenance-worker -n bookmark-manager

# Database logs
kubectl logs -f statefulset/postgres -n bookmark-manager
kubectl logs -f statefulset/redis -n bookmark-manager

# Previous logs (if pod crashed)
kubectl logs --previous <pod-name> -n bookmark-manager

# All pods with label
kubectl logs -f -l app=bookmark-api -n bookmark-manager
```

## Describe Resources

```bash
# Pod details
kubectl describe pod <pod-name> -n bookmark-manager

# Deployment details
kubectl describe deployment bookmark-api -n bookmark-manager

# Service details
kubectl describe svc bookmark-api-service -n bookmark-manager

# Ingress details
kubectl describe ingress bookmark-manager-ingress -n bookmark-manager

# PVC details
kubectl describe pvc postgres-pvc -n bookmark-manager
```

## Scaling

```bash
# Manual scale
kubectl scale deployment bookmark-api --replicas=5 -n bookmark-manager
kubectl scale deployment snapshot-worker --replicas=4 -n bookmark-manager

# Check HPA status
kubectl get hpa -n bookmark-manager
kubectl describe hpa bookmark-api-hpa -n bookmark-manager
```

## Updates and Rollouts

```bash
# Update image
kubectl set image deployment/bookmark-api api=bookmark-manager/api:v1.2.0 -n bookmark-manager

# Rollout status
kubectl rollout status deployment/bookmark-api -n bookmark-manager

# Rollout history
kubectl rollout history deployment/bookmark-api -n bookmark-manager

# Rollback
kubectl rollout undo deployment/bookmark-api -n bookmark-manager

# Rollback to specific revision
kubectl rollout undo deployment/bookmark-api --to-revision=2 -n bookmark-manager

# Restart deployment
kubectl rollout restart deployment/bookmark-api -n bookmark-manager
```

## Exec into Pods

```bash
# Shell into API pod
kubectl exec -it deployment/bookmark-api -n bookmark-manager -- /bin/sh

# Shell into PostgreSQL
kubectl exec -it statefulset/postgres -n bookmark-manager -- psql -U bookmark_user -d bookmark_manager

# Shell into Redis
kubectl exec -it statefulset/redis -n bookmark-manager -- redis-cli -a <password>

# Run command in pod
kubectl exec deployment/bookmark-api -n bookmark-manager -- npm run migrate
```

## Port Forwarding

```bash
# Forward API port
kubectl port-forward deployment/bookmark-api 3000:3000 -n bookmark-manager

# Forward PostgreSQL
kubectl port-forward statefulset/postgres 5432:5432 -n bookmark-manager

# Forward Redis
kubectl port-forward statefulset/redis 6379:6379 -n bookmark-manager

# Forward MeiliSearch
kubectl port-forward statefulset/meilisearch 7700:7700 -n bookmark-manager

# Forward MinIO console
kubectl port-forward statefulset/minio 9001:9001 -n bookmark-manager
```

## Resource Usage

```bash
# Pod resource usage
kubectl top pods -n bookmark-manager

# Node resource usage
kubectl top nodes

# Specific pod
kubectl top pod <pod-name> -n bookmark-manager
```

## Configuration

```bash
# View ConfigMap
kubectl get configmap bookmark-manager-config -n bookmark-manager -o yaml

# Edit ConfigMap
kubectl edit configmap bookmark-manager-config -n bookmark-manager

# View Secret (base64 encoded)
kubectl get secret bookmark-manager-secrets -n bookmark-manager -o yaml

# Decode secret value
kubectl get secret bookmark-manager-secrets -n bookmark-manager -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

## Jobs and CronJobs

```bash
# List CronJobs
kubectl get cronjobs -n bookmark-manager

# Trigger manual backup
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%s) -n bookmark-manager

# View job status
kubectl get jobs -n bookmark-manager

# View job logs
kubectl logs job/<job-name> -n bookmark-manager

# Delete completed jobs
kubectl delete jobs --field-selector status.successful=1 -n bookmark-manager
```

## Database Operations

```bash
# Run migrations
kubectl run migration-$(date +%s) \
  --image=bookmark-manager/api:latest \
  --restart=Never \
  --namespace=bookmark-manager \
  --command -- npm run migrate

# Backup database
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%s) -n bookmark-manager

# Connect to PostgreSQL
kubectl run -it --rm psql --image=postgres:15-alpine --restart=Never -n bookmark-manager -- \
  psql -h postgres-service -U bookmark_user -d bookmark_manager

# Connect to Redis
kubectl run -it --rm redis --image=redis:7-alpine --restart=Never -n bookmark-manager -- \
  redis-cli -h redis-service -a <password>
```

## Debugging

```bash
# Create debug pod
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -n bookmark-manager -- bash

# Test connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n bookmark-manager -- \
  curl http://bookmark-api-service:3000/health

# DNS lookup
kubectl run -it --rm debug --image=busybox --restart=Never -n bookmark-manager -- \
  nslookup bookmark-api-service

# Check network policies
kubectl get networkpolicies -n bookmark-manager
kubectl describe networkpolicy api-network-policy -n bookmark-manager
```

## Monitoring

```bash
# View ServiceMonitors
kubectl get servicemonitors -n bookmark-manager

# View PrometheusRules
kubectl get prometheusrules -n bookmark-manager

# Check Prometheus targets (if installed)
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# Access Grafana (if installed)
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

## Cleanup

```bash
# Delete all resources (automated)
cd k8s && ./cleanup.sh

# Delete namespace (removes everything)
kubectl delete namespace bookmark-manager

# Delete specific resources
kubectl delete deployment bookmark-api -n bookmark-manager
kubectl delete statefulset postgres -n bookmark-manager
kubectl delete pvc postgres-pvc -n bookmark-manager
```

## Troubleshooting

```bash
# Pod not starting
kubectl describe pod <pod-name> -n bookmark-manager
kubectl logs <pod-name> -n bookmark-manager
kubectl logs --previous <pod-name> -n bookmark-manager

# Image pull errors
kubectl describe pod <pod-name> -n bookmark-manager | grep -A 10 Events

# PVC not binding
kubectl describe pvc <pvc-name> -n bookmark-manager
kubectl get pv

# Service not accessible
kubectl get endpoints <service-name> -n bookmark-manager
kubectl describe svc <service-name> -n bookmark-manager

# Ingress not working
kubectl describe ingress bookmark-manager-ingress -n bookmark-manager
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check resource constraints
kubectl describe node <node-name>
kubectl top nodes
kubectl top pods -n bookmark-manager
```

## Useful Aliases

Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
# Namespace alias
alias kbm='kubectl -n bookmark-manager'

# Common commands
alias kgp='kubectl get pods -n bookmark-manager'
alias kgs='kubectl get svc -n bookmark-manager'
alias kgd='kubectl get deployments -n bookmark-manager'
alias kgi='kubectl get ingress -n bookmark-manager'
alias kgh='kubectl get hpa -n bookmark-manager'

# Logs
alias klf='kubectl logs -f -n bookmark-manager'
alias kl='kubectl logs -n bookmark-manager'

# Describe
alias kdp='kubectl describe pod -n bookmark-manager'
alias kdd='kubectl describe deployment -n bookmark-manager'

# Exec
alias kex='kubectl exec -it -n bookmark-manager'
```

Usage with aliases:

```bash
kgp                                    # Get pods
klf deployment/bookmark-api            # Follow API logs
kdp <pod-name>                         # Describe pod
kex deployment/bookmark-api -- /bin/sh # Shell into API pod
```

## Emergency Procedures

### API Server Down

```bash
# Check pod status
kubectl get pods -l app=bookmark-api -n bookmark-manager

# Check logs
kubectl logs -l app=bookmark-api -n bookmark-manager --tail=100

# Restart deployment
kubectl rollout restart deployment/bookmark-api -n bookmark-manager

# Scale up temporarily
kubectl scale deployment bookmark-api --replicas=10 -n bookmark-manager
```

### Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl get pod -l app=postgres -n bookmark-manager
kubectl logs statefulset/postgres -n bookmark-manager

# Test connection
kubectl run -it --rm psql --image=postgres:15-alpine --restart=Never -n bookmark-manager -- \
  psql -h postgres-service -U bookmark_user -d bookmark_manager

# Restart PostgreSQL (last resort)
kubectl delete pod postgres-0 -n bookmark-manager
```

### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n bookmark-manager

# Identify high memory pods
kubectl top pods -n bookmark-manager --sort-by=memory

# Restart high memory pod
kubectl delete pod <pod-name> -n bookmark-manager

# Adjust resource limits
kubectl edit deployment <deployment-name> -n bookmark-manager
```

### Disk Space Issues

```bash
# Check PVC usage
kubectl get pvc -n bookmark-manager

# Describe PVC
kubectl describe pvc <pvc-name> -n bookmark-manager

# Check node disk space
kubectl describe node <node-name> | grep -A 5 "Allocated resources"

# Clean up old backups
kubectl exec statefulset/postgres -n bookmark-manager -- rm -rf /backups/old-*
```

## Quick Links

- Full Documentation: `k8s/README.md`
- Deployment Guide: `KUBERNETES_DEPLOYMENT.md`
- Manifest Summary: `k8s/MANIFEST_SUMMARY.md`
- Deploy Script: `k8s/deploy.sh`
- Cleanup Script: `k8s/cleanup.sh`
