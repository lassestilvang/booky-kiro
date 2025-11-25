# Kubernetes Deployment Guide

This document provides comprehensive instructions for deploying the Bookmark Manager Platform to Kubernetes.

## Overview

The Kubernetes deployment includes:

- **Application Components**:
  - API Server (3+ replicas with HPA)
  - Frontend Web App (2+ replicas with HPA)
  - Snapshot Worker (2+ replicas with HPA)
  - Index Worker (2+ replicas with HPA)
  - Maintenance Worker (1 replica)

- **Data Layer**:
  - PostgreSQL (StatefulSet)
  - Redis (StatefulSet)
  - MeiliSearch (StatefulSet)
  - MinIO (StatefulSet)

- **Supporting Resources**:
  - Ingress with TLS
  - Network Policies
  - Pod Disruption Budgets
  - Horizontal Pod Autoscalers
  - CronJobs for maintenance tasks
  - Service Accounts and RBAC

## Directory Structure

```
k8s/
├── README.md                          # Detailed deployment guide
├── deploy.sh                          # Automated deployment script
├── cleanup.sh                         # Cleanup script
├── kustomization.yaml                 # Base kustomization
├── namespace.yaml                     # Namespace definition
├── configmap.yaml                     # Application configuration
├── secrets.yaml                       # Secrets (update before deploying!)
├── persistentvolumes.yaml             # PVC definitions
├── ingress.yaml                       # Ingress configuration
├── networkpolicy.yaml                 # Network policies
├── poddisruptionbudget.yaml          # PDB definitions
├── serviceaccount.yaml                # Service accounts and RBAC
├── cronjob.yaml                       # Scheduled jobs
├── deployments/                       # Application deployments
│   ├── api-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── snapshot-worker-deployment.yaml
│   ├── index-worker-deployment.yaml
│   └── maintenance-worker-deployment.yaml
├── statefulsets/                      # Database statefulsets
│   ├── postgres-statefulset.yaml
│   ├── redis-statefulset.yaml
│   ├── meilisearch-statefulset.yaml
│   └── minio-statefulset.yaml
├── services/                          # Service definitions
│   ├── api-service.yaml
│   ├── frontend-service.yaml
│   ├── postgres-service.yaml
│   ├── redis-service.yaml
│   ├── meilisearch-service.yaml
│   └── minio-service.yaml
├── overlays/                          # Environment-specific overlays
│   ├── production/
│   │   ├── kustomization.yaml
│   │   ├── replica-patch.yaml
│   │   └── resource-patch.yaml
│   └── staging/
│       ├── kustomization.yaml
│       └── replica-patch.yaml
└── monitoring/                        # Monitoring configuration
    ├── servicemonitor.yaml
    └── prometheusrule.yaml
```

## Prerequisites

### Required Tools

- **kubectl** (v1.24+): Kubernetes CLI
- **helm** (v3+): Package manager for Kubernetes
- **kustomize** (optional): Built into kubectl
- **Docker**: For building images

### Cluster Requirements

- Kubernetes cluster (v1.24+)
- Minimum 3 worker nodes
- StorageClass configured for dynamic provisioning
- Ingress controller (nginx-ingress or AWS ALB)
- cert-manager for TLS certificates (optional but recommended)

### Resource Requirements

**Minimum**:

- 8 vCPUs
- 16 GB RAM
- 100 GB storage

**Recommended Production**:

- 16+ vCPUs
- 32+ GB RAM
- 500+ GB storage

## Quick Start

### 1. Automated Deployment

The easiest way to deploy is using the automated script:

```bash
cd k8s
./deploy.sh
```

This script will:

1. Check prerequisites
2. Create namespace
3. Deploy secrets and config
4. Create persistent volumes
5. Deploy databases (StatefulSets)
6. Deploy services
7. Deploy applications
8. Deploy supporting resources
9. Deploy ingress
10. Run database migrations (optional)

### 2. Manual Deployment

If you prefer manual control:

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Update and deploy secrets
vim secrets.yaml  # Update with actual credentials
kubectl apply -f secrets.yaml

# 3. Deploy configuration
kubectl apply -f configmap.yaml

# 4. Create persistent volumes
kubectl apply -f persistentvolumes.yaml

# 5. Deploy databases
kubectl apply -f statefulsets/
kubectl wait --for=condition=ready pod -l component=database -n bookmark-manager --timeout=300s

# 6. Deploy services
kubectl apply -f services/

# 7. Deploy applications
kubectl apply -f deployments/
kubectl wait --for=condition=available deployment --all -n bookmark-manager --timeout=300s

# 8. Deploy supporting resources
kubectl apply -f serviceaccount.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f poddisruptionbudget.yaml
kubectl apply -f cronjob.yaml

# 9. Deploy ingress
vim ingress.yaml  # Update with your domain
kubectl apply -f ingress.yaml
```

### 3. Using Kustomize

Deploy using kustomize for better configuration management:

```bash
# Base deployment
kubectl apply -k k8s/

# Production deployment
kubectl apply -k k8s/overlays/production/

# Staging deployment
kubectl apply -k k8s/overlays/staging/
```

## Configuration

### Secrets

**IMPORTANT**: Update `secrets.yaml` with actual credentials before deploying!

```yaml
# Required secrets:
- DB_USER
- DB_PASSWORD
- REDIS_PASSWORD
- MEILISEARCH_MASTER_KEY
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- JWT_PRIVATE_KEY (base64 encoded RSA private key)
- JWT_PUBLIC_KEY (base64 encoded RSA public key)
- SESSION_SECRET
```

Generate JWT keys:

```bash
# Generate RSA key pair
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Base64 encode for Kubernetes secret
cat jwt-private.pem | base64 -w 0
cat jwt-public.pem | base64 -w 0
```

### ConfigMap

Update `configmap.yaml` with your environment-specific values:

```yaml
# Key configurations:
- CORS_ORIGIN: Your frontend domain
- API_PORT: API server port (default: 3000)
- RATE_LIMIT_MAX_REQUESTS: Rate limit threshold
```

### Ingress

Update `ingress.yaml` with your domain names:

```yaml
spec:
  tls:
    - hosts:
        - bookmarks.example.com # Your domain
        - api.bookmarks.example.com # Your API domain
```

## Post-Deployment

### Run Database Migrations

```bash
kubectl run migration-$(date +%s) \
  --image=bookmark-manager/api:latest \
  --restart=Never \
  --namespace=bookmark-manager \
  --command -- npm run migrate
```

### Verify Deployment

```bash
# Check pod status
kubectl get pods -n bookmark-manager

# Check services
kubectl get svc -n bookmark-manager

# Check ingress
kubectl get ingress -n bookmark-manager

# Check HPA
kubectl get hpa -n bookmark-manager

# View logs
kubectl logs -f deployment/bookmark-api -n bookmark-manager
```

### Access the Application

1. Get the ingress IP/hostname:

   ```bash
   kubectl get ingress -n bookmark-manager
   ```

2. Update your DNS to point to the ingress IP

3. Access the application:
   - Frontend: https://bookmarks.example.com
   - API: https://api.bookmarks.example.com

## Monitoring

### Install Prometheus and Grafana

```bash
# Add Prometheus community Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Apply ServiceMonitors
kubectl apply -f monitoring/servicemonitor.yaml

# Apply PrometheusRules
kubectl apply -f monitoring/prometheusrule.yaml
```

### Access Grafana

```bash
# Get Grafana password
kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d

# Port forward to access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

Access Grafana at http://localhost:3000 (username: admin)

### Key Metrics to Monitor

- API request rate and latency
- Error rate (4xx, 5xx)
- Database connection pool usage
- Redis memory usage
- Worker queue depth
- Pod CPU and memory usage
- Disk space usage

## Scaling

### Manual Scaling

```bash
# Scale API
kubectl scale deployment bookmark-api --replicas=5 -n bookmark-manager

# Scale workers
kubectl scale deployment snapshot-worker --replicas=4 -n bookmark-manager
```

### Autoscaling

HPA is pre-configured for:

- API: 3-10 replicas (CPU/memory based)
- Frontend: 2-6 replicas (CPU based)
- Snapshot Worker: 2-8 replicas (CPU/memory based)
- Index Worker: 2-6 replicas (CPU/memory based)

Monitor HPA:

```bash
kubectl get hpa -n bookmark-manager -w
```

### Cluster Autoscaling

Enable cluster autoscaler for automatic node scaling:

**AWS EKS**:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

**GKE**:

```bash
gcloud container clusters update bookmark-manager --enable-autoscaling --min-nodes=3 --max-nodes=10
```

## Backup and Disaster Recovery

### Database Backups

Automated backups run daily at 2 AM via CronJob. Manual backup:

```bash
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%s) -n bookmark-manager
```

### Volume Snapshots

Create volume snapshots for disaster recovery:

```bash
# List PVCs
kubectl get pvc -n bookmark-manager

# Create snapshot (example for AWS EBS)
kubectl create -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-snapshot-$(date +%Y%m%d)
  namespace: bookmark-manager
spec:
  volumeSnapshotClassName: ebs-csi-snapshot-class
  source:
    persistentVolumeClaimName: postgres-pvc
EOF
```

### Restore from Backup

```bash
# Restore database from backup
kubectl run restore-$(date +%s) \
  --image=postgres:15-alpine \
  --restart=Never \
  --namespace=bookmark-manager \
  --command -- /bin/sh -c "gunzip -c /backups/postgres-backup.sql.gz | psql -h postgres-service -U bookmark_user -d bookmark_manager"
```

## Troubleshooting

### Common Issues

**Pods not starting**:

```bash
kubectl describe pod <pod-name> -n bookmark-manager
kubectl logs <pod-name> -n bookmark-manager
```

**Database connection errors**:

```bash
# Test PostgreSQL connection
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -n bookmark-manager -- \
  psql -h postgres-service -U bookmark_user -d bookmark_manager
```

**Storage issues**:

```bash
kubectl get pvc -n bookmark-manager
kubectl describe pvc <pvc-name> -n bookmark-manager
```

**Ingress not working**:

```bash
kubectl describe ingress bookmark-manager-ingress -n bookmark-manager
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### Debug Pod

Create a debug pod for troubleshooting:

```bash
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -n bookmark-manager -- bash
```

## Cleanup

To remove all resources:

```bash
cd k8s
./cleanup.sh
```

Or manually:

```bash
kubectl delete namespace bookmark-manager
```

## Production Best Practices

1. **Use Managed Services**:
   - AWS RDS for PostgreSQL
   - AWS ElastiCache for Redis
   - AWS OpenSearch for search
   - AWS S3 for object storage

2. **Security**:
   - Use external secrets management (AWS Secrets Manager, Vault)
   - Enable network policies
   - Apply pod security standards
   - Regular security scanning

3. **High Availability**:
   - Multi-zone deployment
   - Database replication
   - Redis cluster mode
   - Multiple ingress replicas

4. **Monitoring**:
   - Prometheus for metrics
   - Grafana for dashboards
   - ELK stack for logs
   - Alerting for critical issues

5. **Backup**:
   - Automated daily backups
   - Cross-region replication
   - Regular DR drills
   - Documented restore procedures

## Support

For issues and questions:

- Check logs: `kubectl logs -f <pod-name> -n bookmark-manager`
- Check events: `kubectl get events -n bookmark-manager`
- Review k8s/README.md for detailed documentation

## License

See main project LICENSE file.
