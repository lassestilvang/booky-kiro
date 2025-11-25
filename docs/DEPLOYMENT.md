# Deployment Guide

This guide covers deploying the Bookmark Manager Platform to production environments using Docker, Kubernetes, and Terraform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [AWS Deployment with Terraform](#aws-deployment-with-terraform)
6. [Database Setup](#database-setup)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Backup and Recovery](#backup-and-recovery)
9. [Security Hardening](#security-hardening)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** 24+ and Docker Compose
- **Kubernetes** 1.28+ (kubectl configured)
- **Terraform** 1.6+
- **AWS CLI** 2.0+ (for AWS deployments)
- **Helm** 3.0+ (optional, for Kubernetes)

### Required Services

- **PostgreSQL** 15+ (managed or self-hosted)
- **Redis** 7+ (managed or self-hosted)
- **MeiliSearch** or **Elasticsearch** (search engine)
- **S3-compatible storage** (AWS S3, MinIO, etc.)

### Domain and SSL

- Domain name configured with DNS
- SSL/TLS certificates (Let's Encrypt recommended)

## Environment Configuration

### Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/bookmark_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

# Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=your-redis-password

# MeiliSearch
MEILISEARCH_HOST=https://search.yourdomain.com
MEILISEARCH_API_KEY=your-meilisearch-master-key

# Object Storage (S3)
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=bookmark-manager-storage
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_PRIVATE_KEY=path/to/private-key.pem
JWT_PUBLIC_KEY=path/to/public-key.pem
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# OAuth
OAUTH_CALLBACK_URL=https://yourdomain.com/auth/callback

# Email (for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_FREE_TIER=100
RATE_LIMIT_PRO_TIER=500
```

### Generate JWT Keys

Generate RS256 key pair for JWT signing:

```bash
# Generate private key
openssl genrsa -out private-key.pem 2048

# Generate public key
openssl rsa -in private-key.pem -pubout -out public-key.pem

# Store keys securely (AWS Secrets Manager, Kubernetes Secrets, etc.)
```

## Docker Deployment

### Production Docker Compose

Use the production Docker Compose configuration:

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Docker Compose Configuration

The `docker-compose.prod.yml` includes:

- **API Server** - Node.js backend with health checks
- **Frontend** - Nginx serving React build
- **Snapshot Worker** - Background job processor
- **Index Worker** - Content indexing processor
- **Maintenance Worker** - Scheduled maintenance tasks
- **PostgreSQL** - Primary database
- **Redis** - Cache and job queue
- **MeiliSearch** - Full-text search
- **MinIO** - Object storage

### Health Checks

All services include health checks:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Scaling Services

Scale specific services:

```bash
# Scale API servers
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale snapshot-worker=5
```

## Kubernetes Deployment

### Quick Start

Deploy to Kubernetes using the provided manifests:

```bash
# Navigate to k8s directory
cd k8s

# Deploy to production
./deploy.sh production

# Or use kubectl directly
kubectl apply -k overlays/production
```

### Kubernetes Architecture

The Kubernetes deployment includes:

**Deployments:**

- `api-deployment` - API servers (3 replicas with HPA)
- `frontend-deployment` - Frontend servers (2 replicas)
- `snapshot-worker-deployment` - Snapshot workers (5 replicas)
- `index-worker-deployment` - Index workers (3 replicas)
- `maintenance-worker-deployment` - Maintenance worker (1 replica)

**StatefulSets:**

- `postgres-statefulset` - PostgreSQL with persistent storage
- `redis-statefulset` - Redis with persistent storage
- `meilisearch-statefulset` - MeiliSearch with persistent storage
- `minio-statefulset` - MinIO with persistent storage

**Services:**

- `api-service` - ClusterIP for API
- `frontend-service` - ClusterIP for frontend
- `postgres-service` - ClusterIP for database
- `redis-service` - ClusterIP for Redis
- `meilisearch-service` - ClusterIP for search
- `minio-service` - ClusterIP for storage

**Ingress:**

- NGINX Ingress Controller with TLS termination
- Routes for API, frontend, and admin interfaces

### Configuration

1. **Create namespace:**

   ```bash
   kubectl create namespace bookmark-manager
   ```

2. **Create secrets:**

   ```bash
   kubectl create secret generic app-secrets \
     --from-literal=database-url=$DATABASE_URL \
     --from-literal=jwt-secret=$JWT_SECRET \
     --from-literal=redis-password=$REDIS_PASSWORD \
     --namespace=bookmark-manager
   ```

3. **Configure ingress:**
   Edit `k8s/ingress.yaml` with your domain:

   ```yaml
   spec:
     rules:
       - host: yourdomain.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: frontend-service
                   port:
                     number: 80
       - host: api.yourdomain.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: api-service
                   port:
                     number: 3000
   ```

4. **Deploy:**
   ```bash
   kubectl apply -k overlays/production
   ```

### Horizontal Pod Autoscaling

The API deployment includes HPA:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-deployment
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Persistent Volumes

Configure persistent storage for databases:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: gp3
```

### Monitoring

Deploy Prometheus and Grafana:

```bash
# Install Prometheus Operator
kubectl apply -f k8s/monitoring/prometheusrule.yaml
kubectl apply -f k8s/monitoring/servicemonitor.yaml

# Access Grafana
kubectl port-forward svc/grafana 3000:80 -n monitoring
```

## AWS Deployment with Terraform

### Infrastructure Overview

The Terraform configuration provisions:

- **VPC** with public and private subnets
- **ECS Cluster** for container orchestration
- **RDS PostgreSQL** for database
- **ElastiCache Redis** for caching
- **OpenSearch** for full-text search
- **S3 Buckets** for object storage
- **Application Load Balancer** for traffic distribution
- **CloudWatch** for monitoring and logging
- **Route53** for DNS management
- **ACM** for SSL certificates

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Terraform** installed
4. **S3 bucket** for Terraform state (recommended)

### Deployment Steps

1. **Initialize Terraform:**

   ```bash
   cd terraform/environments/production
   terraform init
   ```

2. **Configure variables:**
   Edit `terraform.tfvars`:

   ```hcl
   project_name = "bookmark-manager"
   environment  = "production"
   aws_region   = "us-east-1"

   # VPC Configuration
   vpc_cidr = "10.0.0.0/16"

   # Database Configuration
   db_instance_class = "db.t3.large"
   db_allocated_storage = 100

   # Redis Configuration
   redis_node_type = "cache.t3.medium"

   # OpenSearch Configuration
   opensearch_instance_type = "t3.medium.search"
   opensearch_instance_count = 2

   # ECS Configuration
   api_task_cpu    = 1024
   api_task_memory = 2048
   api_desired_count = 3

   # Domain Configuration
   domain_name = "yourdomain.com"
   api_domain_name = "api.yourdomain.com"
   ```

3. **Plan deployment:**

   ```bash
   terraform plan -out=tfplan
   ```

4. **Apply configuration:**

   ```bash
   terraform apply tfplan
   ```

5. **Get outputs:**
   ```bash
   terraform output
   ```

### Terraform Modules

The infrastructure is organized into modules:

- **`modules/vpc`** - VPC, subnets, NAT gateways
- **`modules/rds`** - PostgreSQL database
- **`modules/elasticache`** - Redis cluster
- **`modules/opensearch`** - OpenSearch domain
- **`modules/s3`** - S3 buckets with policies
- **`modules/ecs`** - ECS cluster and services
- **`modules/alb`** - Application Load Balancer
- **`modules/monitoring`** - CloudWatch dashboards and alarms

### Cost Optimization

**Production Environment:**

- RDS: db.t3.large (~$150/month)
- ElastiCache: cache.t3.medium (~$50/month)
- OpenSearch: 2x t3.medium.search (~$150/month)
- ECS: 3x API + 5x workers (~$200/month)
- S3: Pay per use (~$50/month)
- **Total: ~$600/month**

**Staging Environment:**

- Use smaller instance types
- Single availability zone
- Reduced replica counts
- **Total: ~$200/month**

## Database Setup

### Initial Migration

Run database migrations:

```bash
# Using Docker
docker exec -it bookmark-manager-api npm run migrate

# Using kubectl
kubectl exec -it deployment/api-deployment -- npm run migrate

# Directly
cd packages/backend
npm run migrate
```

### Database Backup

**Automated Backups (RDS):**

```hcl
resource "aws_db_instance" "postgres" {
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"
}
```

**Manual Backup:**

```bash
# PostgreSQL dump
pg_dump -h hostname -U username -d bookmark_db > backup.sql

# Restore
psql -h hostname -U username -d bookmark_db < backup.sql
```

### Database Optimization

**Indexes:**

```sql
-- Already created in migrations
CREATE INDEX idx_bookmarks_owner ON bookmarks(owner_id);
CREATE INDEX idx_bookmarks_collection ON bookmarks(collection_id);
CREATE INDEX idx_bookmarks_created ON bookmarks(created_at DESC);
```

**Connection Pooling:**

```javascript
const pool = new Pool({
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Monitoring and Logging

### Application Monitoring

**Metrics to Monitor:**

- Request rate and latency (p50, p95, p99)
- Error rate and types
- Database connection pool usage
- Redis memory usage
- Queue depth and processing time
- Worker job success/failure rates

**CloudWatch Dashboards:**

```bash
# View CloudWatch dashboard
aws cloudwatch get-dashboard --dashboard-name bookmark-manager-production
```

**Prometheus Metrics:**

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api-metrics
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
    - port: metrics
      path: /metrics
      interval: 30s
```

### Logging

**Structured Logging:**

```javascript
logger.info('Bookmark created', {
  userId: user.id,
  bookmarkId: bookmark.id,
  url: bookmark.url,
  requestId: req.id,
});
```

**Log Aggregation:**

- **CloudWatch Logs** for AWS deployments
- **ELK Stack** (Elasticsearch, Logstash, Kibana) for Kubernetes
- **Loki** with Grafana for lightweight logging

**Log Retention:**

- Application logs: 30 days
- Audit logs: 90 days
- Error logs: 180 days

### Alerting

**Critical Alerts:**

```yaml
# Prometheus AlertManager rules
groups:
  - name: bookmark-manager
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: 'High error rate detected'

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: 'High latency detected'

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_pool_size - pg_pool_available < 2
        for: 2m
        annotations:
          summary: 'Database connection pool nearly exhausted'
```

**Notification Channels:**

- Email for critical alerts
- Slack for warnings
- PagerDuty for on-call rotation

## Backup and Recovery

### Backup Strategy

**Database Backups:**

- **Automated**: Daily full backups at 2 AM UTC
- **Retention**: 30 days for daily, 12 months for monthly
- **Point-in-time recovery**: Enabled with 7-day window

**Object Storage Backups:**

- **Versioning**: Enabled on S3 buckets
- **Cross-region replication**: Enabled for disaster recovery
- **Lifecycle policies**: Archive to Glacier after 90 days

**Application Backups:**

- **Configuration**: Version controlled in Git
- **Secrets**: Backed up in AWS Secrets Manager
- **User data**: Automated Pro user backups

### Recovery Procedures

**Database Recovery:**

```bash
# Restore from automated backup (RDS)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier bookmark-db-restored \
  --db-snapshot-identifier bookmark-db-snapshot-2024-01-15

# Restore from manual backup
psql -h hostname -U username -d bookmark_db < backup.sql
```

**Object Storage Recovery:**

```bash
# Restore from S3 versioning
aws s3api list-object-versions \
  --bucket bookmark-manager-storage \
  --prefix snapshots/

aws s3api get-object \
  --bucket bookmark-manager-storage \
  --key snapshots/file.html \
  --version-id VERSION_ID \
  file.html
```

**Disaster Recovery:**

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour
3. **Failover procedure**:
   - Switch DNS to backup region
   - Restore database from latest backup
   - Deploy application from Docker images
   - Verify functionality with smoke tests

### Testing Recovery

**Quarterly DR Drills:**

```bash
# 1. Create test environment
terraform apply -var-file=dr-test.tfvars

# 2. Restore latest backup
./scripts/restore-backup.sh

# 3. Run smoke tests
npm run test:smoke

# 4. Verify functionality
curl https://dr-test.yourdomain.com/health

# 5. Tear down test environment
terraform destroy -var-file=dr-test.tfvars
```

## Security Hardening

### Network Security

**VPC Configuration:**

- Private subnets for databases and workers
- Public subnets for load balancers only
- NAT gateways for outbound traffic
- Security groups with least privilege

**Firewall Rules:**

```hcl
# API security group
resource "aws_security_group_rule" "api_ingress" {
  type              = "ingress"
  from_port         = 3000
  to_port           = 3000
  protocol          = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id = aws_security_group.api.id
}
```

### Application Security

**TLS Configuration:**

```nginx
# Nginx SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
```

**Security Headers:**

```javascript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

**Secrets Management:**

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name bookmark-manager/production/jwt-secret \
  --secret-string "your-jwt-secret"

# Retrieve in application
const secret = await secretsManager.getSecretValue({
  SecretId: 'bookmark-manager/production/jwt-secret'
}).promise();
```

### Compliance

**GDPR Compliance:**

- Data export API implemented
- Account deletion with 30-day grace period
- Privacy policy and terms of service
- Cookie consent management

**Security Audits:**

- Quarterly penetration testing
- Automated vulnerability scanning (Snyk, Dependabot)
- Code security analysis (SonarQube)
- Compliance audits (SOC 2, ISO 27001)

## Troubleshooting

### Common Issues

**1. Database Connection Errors**

```bash
# Check database connectivity
psql -h hostname -U username -d bookmark_db

# Check connection pool
kubectl logs deployment/api-deployment | grep "pool"

# Increase pool size if needed
DATABASE_POOL_MAX=30
```

**2. High Memory Usage**

```bash
# Check memory usage
kubectl top pods

# Increase memory limits
resources:
  limits:
    memory: 4Gi
  requests:
    memory: 2Gi
```

**3. Slow Search Queries**

```bash
# Check MeiliSearch health
curl http://meilisearch:7700/health

# Rebuild search index
npm run search:reindex

# Check index stats
curl http://meilisearch:7700/indexes/bookmarks/stats
```

**4. Worker Job Failures**

```bash
# Check worker logs
kubectl logs deployment/snapshot-worker-deployment

# Check queue depth
redis-cli LLEN snapshot-queue

# Retry failed jobs
npm run queue:retry-failed
```

### Performance Optimization

**Database Query Optimization:**

```sql
-- Analyze slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_bookmarks_url_hash
ON bookmarks(md5(url));
```

**Caching Strategy:**

```javascript
// Cache frequently accessed data
const cachedUser = await redis.get(`user:${userId}`);
if (cachedUser) {
  return JSON.parse(cachedUser);
}

const user = await db.users.findById(userId);
await redis.setex(`user:${userId}`, 3600, JSON.stringify(user));
return user;
```

### Support

For deployment issues:

- **Documentation**: https://docs.bookmarkmanager.example.com
- **GitHub Issues**: https://github.com/yourusername/bookmark-manager-platform/issues
- **Email**: devops@bookmarkmanager.example.com
- **Slack**: #bookmark-manager-ops

---

**Next Steps:**

- Review [Architecture Documentation](ARCHITECTURE.md)
- Set up [Monitoring and Alerting](#monitoring-and-logging)
- Configure [Backup and Recovery](#backup-and-recovery)
- Perform [Security Hardening](#security-hardening)
