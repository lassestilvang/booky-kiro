# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the Bookmark Manager Platform to a Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured to access your cluster
- Helm 3 (optional, for cert-manager and ingress-nginx)
- Container registry with built Docker images
- StorageClass configured for persistent volumes

## Architecture Overview

The deployment consists of:

- **API Server**: 3+ replicas with HPA (Horizontal Pod Autoscaler)
- **Frontend**: 2+ replicas with HPA
- **Workers**:
  - Snapshot Worker: 2+ replicas with HPA
  - Index Worker: 2+ replicas with HPA
  - Maintenance Worker: 1 replica
- **Databases**:
  - PostgreSQL: StatefulSet with persistent storage
  - Redis: StatefulSet with persistent storage
  - MeiliSearch: StatefulSet with persistent storage
  - MinIO: StatefulSet with persistent storage

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f namespace.yaml
```

### 2. Configure Secrets

**Important**: Update the secrets with your actual credentials before deploying!

```bash
# Edit secrets.yaml with your actual values
vim secrets.yaml

# Apply secrets
kubectl apply -f secrets.yaml
```

### 3. Configure ConfigMap

Update `configmap.yaml` with your environment-specific values:

```bash
vim configmap.yaml
kubectl apply -f configmap.yaml
```

### 4. Create Persistent Volumes

```bash
kubectl apply -f persistentvolumes.yaml
```

### 5. Deploy StatefulSets (Databases)

```bash
kubectl apply -f statefulsets/postgres-statefulset.yaml
kubectl apply -f statefulsets/redis-statefulset.yaml
kubectl apply -f statefulsets/meilisearch-statefulset.yaml
kubectl apply -f statefulsets/minio-statefulset.yaml
```

Wait for all StatefulSets to be ready:

```bash
kubectl wait --for=condition=ready pod -l component=database -n bookmark-manager --timeout=300s
kubectl wait --for=condition=ready pod -l component=cache -n bookmark-manager --timeout=300s
kubectl wait --for=condition=ready pod -l component=search -n bookmark-manager --timeout=300s
kubectl wait --for=condition=ready pod -l component=storage -n bookmark-manager --timeout=300s
```

### 6. Deploy Services

```bash
kubectl apply -f services/
```

### 7. Deploy Applications

```bash
kubectl apply -f deployments/
```

### 8. Deploy Supporting Resources

```bash
kubectl apply -f serviceaccount.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f poddisruptionbudget.yaml
kubectl apply -f cronjob.yaml
```

### 9. Deploy Ingress

First, install ingress-nginx controller (if not already installed):

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

Install cert-manager for TLS certificates:

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

Create ClusterIssuer for Let's Encrypt:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

Update `ingress.yaml` with your domain names and apply:

```bash
vim ingress.yaml
kubectl apply -f ingress.yaml
```

## Verification

### Check Pod Status

```bash
kubectl get pods -n bookmark-manager
```

All pods should be in `Running` state.

### Check Services

```bash
kubectl get svc -n bookmark-manager
```

### Check Ingress

```bash
kubectl get ingress -n bookmark-manager
kubectl describe ingress bookmark-manager-ingress -n bookmark-manager
```

### Check HPA Status

```bash
kubectl get hpa -n bookmark-manager
```

### View Logs

```bash
# API logs
kubectl logs -f deployment/bookmark-api -n bookmark-manager

# Worker logs
kubectl logs -f deployment/snapshot-worker -n bookmark-manager
kubectl logs -f deployment/index-worker -n bookmark-manager

# Database logs
kubectl logs -f statefulset/postgres -n bookmark-manager
```

## Scaling

### Manual Scaling

```bash
# Scale API
kubectl scale deployment bookmark-api --replicas=5 -n bookmark-manager

# Scale workers
kubectl scale deployment snapshot-worker --replicas=4 -n bookmark-manager
```

### Autoscaling

HPA is configured for:

- API: 3-10 replicas based on CPU/memory
- Frontend: 2-6 replicas based on CPU
- Snapshot Worker: 2-8 replicas based on CPU/memory
- Index Worker: 2-6 replicas based on CPU/memory

View HPA status:

```bash
kubectl get hpa -n bookmark-manager -w
```

## Monitoring

### Resource Usage

```bash
kubectl top pods -n bookmark-manager
kubectl top nodes
```

### Events

```bash
kubectl get events -n bookmark-manager --sort-by='.lastTimestamp'
```

## Maintenance

### Database Backup

Backups run automatically via CronJob daily at 2 AM. To trigger manually:

```bash
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%s) -n bookmark-manager
```

### Database Migration

```bash
# Run migrations as a Job
kubectl run migration --image=bookmark-manager/api:latest \
  --restart=Never \
  --namespace=bookmark-manager \
  --command -- npm run migrate
```

### Update Application

```bash
# Update image
kubectl set image deployment/bookmark-api \
  api=bookmark-manager/api:v1.2.0 \
  -n bookmark-manager

# Rollout status
kubectl rollout status deployment/bookmark-api -n bookmark-manager

# Rollback if needed
kubectl rollout undo deployment/bookmark-api -n bookmark-manager
```

## Troubleshooting

### Pod Not Starting

```bash
kubectl describe pod <pod-name> -n bookmark-manager
kubectl logs <pod-name> -n bookmark-manager --previous
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -n bookmark-manager -- \
  psql -h postgres-service -U bookmark_user -d bookmark_manager

# Test Redis connection
kubectl run -it --rm debug --image=redis:7-alpine --restart=Never -n bookmark-manager -- \
  redis-cli -h redis-service -a <password> ping
```

### Storage Issues

```bash
kubectl get pvc -n bookmark-manager
kubectl describe pvc <pvc-name> -n bookmark-manager
```

### Network Issues

```bash
# Test connectivity between pods
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -n bookmark-manager -- bash

# Inside the debug pod:
curl http://bookmark-api-service:3000/health
curl http://postgres-service:5432
```

## Production Considerations

### High Availability

1. **Multi-Zone Deployment**: Spread pods across availability zones
2. **Database Replication**: Use managed database services (RDS, Cloud SQL) or PostgreSQL replication
3. **Redis Cluster**: Deploy Redis in cluster mode for HA
4. **Search Engine**: Use Elasticsearch cluster (3+ nodes) instead of single MeiliSearch instance
5. **Object Storage**: Use managed S3/GCS/Azure Blob instead of MinIO

### Security

1. **Secrets Management**: Use external secrets management (AWS Secrets Manager, Vault)
2. **Network Policies**: Enable and configure network policies
3. **Pod Security Standards**: Apply pod security policies
4. **RBAC**: Configure fine-grained RBAC
5. **Image Scanning**: Scan container images for vulnerabilities
6. **TLS**: Enable TLS for all internal communication

### Monitoring and Observability

1. **Metrics**: Deploy Prometheus and Grafana
2. **Logging**: Use ELK stack or managed logging (CloudWatch, Stackdriver)
3. **Tracing**: Implement distributed tracing (Jaeger, Zipkin)
4. **Alerting**: Configure alerts for critical metrics

### Backup and Disaster Recovery

1. **Database Backups**: Automated daily backups with retention policy
2. **Volume Snapshots**: Regular snapshots of persistent volumes
3. **Disaster Recovery Plan**: Document and test DR procedures
4. **Multi-Region**: Consider multi-region deployment for critical workloads

### Cost Optimization

1. **Resource Requests/Limits**: Right-size pod resources
2. **HPA Configuration**: Tune autoscaling parameters
3. **Storage Classes**: Use appropriate storage tiers
4. **Spot Instances**: Use spot/preemptible instances for workers
5. **Cluster Autoscaler**: Enable cluster autoscaling

## Alternative Deployment Options

### AWS EKS

```bash
# Create EKS cluster
eksctl create cluster --name bookmark-manager --region us-west-2 --nodes 3

# Use AWS Load Balancer Controller instead of nginx-ingress
# Use RDS for PostgreSQL
# Use ElastiCache for Redis
# Use OpenSearch for search
# Use S3 for object storage
```

### Google GKE

```bash
# Create GKE cluster
gcloud container clusters create bookmark-manager \
  --num-nodes=3 \
  --zone=us-central1-a

# Use Cloud SQL for PostgreSQL
# Use Memorystore for Redis
# Use Cloud Storage for objects
```

### Azure AKS

```bash
# Create AKS cluster
az aks create \
  --resource-group bookmark-manager \
  --name bookmark-manager \
  --node-count 3

# Use Azure Database for PostgreSQL
# Use Azure Cache for Redis
# Use Azure Blob Storage
```

## Support

For issues and questions:

- Check logs: `kubectl logs -f <pod-name> -n bookmark-manager`
- Check events: `kubectl get events -n bookmark-manager`
- Review documentation in the main README.md

## License

See main project LICENSE file.
