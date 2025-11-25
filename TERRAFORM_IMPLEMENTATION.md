# Terraform Infrastructure Implementation

This document provides a comprehensive overview of the Terraform infrastructure implementation for the Bookmark Manager Platform.

## Overview

The infrastructure is organized into reusable Terraform modules that can be composed to create different environments (dev, staging, production). All infrastructure is deployed on AWS using best practices for security, scalability, and cost optimization.

## Architecture Components

### 1. VPC Module (`terraform/modules/vpc/`)

Creates an isolated network infrastructure with:

- **VPC**: Configurable CIDR block (default: 10.0.0.0/16)
- **Subnets**: Public and private subnets across multiple availability zones
- **NAT Gateways**: One per AZ for private subnet internet access
- **Internet Gateway**: For public subnet internet access
- **Route Tables**: Separate routing for public and private subnets
- **VPC Endpoints**: S3 endpoint for cost optimization
- **Flow Logs**: Network traffic monitoring (optional)

**Key Features:**

- Multi-AZ deployment for high availability
- Separate public/private subnet architecture
- VPC Flow Logs for security monitoring
- S3 VPC endpoint to reduce data transfer costs

### 2. RDS Module (`terraform/modules/rds/`)

PostgreSQL database with:

- **Instance**: Configurable instance class (production: db.r6g.xlarge)
- **Storage**: GP3 storage with encryption at rest
- **Multi-AZ**: Automatic failover for high availability
- **Backups**: Automated daily backups with 30-day retention
- **Monitoring**: Enhanced monitoring and Performance Insights
- **Security**: Secrets Manager for credential management
- **Read Replica**: Optional read replica for scaling reads

**Key Features:**

- Encrypted storage using KMS
- Automated backups with point-in-time recovery
- Enhanced monitoring with 60-second granularity
- Performance Insights for query analysis
- Parameter group optimized for logging
- Security group restricting access to ECS tasks only

### 3. ElastiCache Module (`terraform/modules/elasticache/`)

Redis cluster for caching and session management:

- **Cluster**: Multi-node replication group
- **Encryption**: At-rest and in-transit encryption
- **Authentication**: AUTH token for secure access
- **Failover**: Automatic failover with Multi-AZ
- **Backups**: Daily snapshots with 5-day retention
- **Monitoring**: CloudWatch logs for slow queries and engine logs

**Key Features:**

- Redis 7.0 with cluster mode disabled
- Automatic failover for high availability
- Encrypted connections with AUTH token
- LRU eviction policy for memory management
- CloudWatch integration for monitoring

### 4. OpenSearch Module (`terraform/modules/opensearch/`)

Full-text search engine:

- **Cluster**: Multi-node cluster with zone awareness
- **Master Nodes**: Optional dedicated master nodes
- **Storage**: EBS volumes with GP3 storage
- **Security**: Fine-grained access control with master user
- **Encryption**: At-rest and in-transit encryption
- **Monitoring**: CloudWatch logs for slow queries and errors

**Key Features:**

- OpenSearch 2.11 with fine-grained access control
- Multi-AZ deployment for high availability
- Encrypted storage and node-to-node encryption
- HTTPS enforcement with TLS 1.2+
- Automated snapshots
- CloudWatch integration for monitoring

### 5. S3 Module (`terraform/modules/s3/`)

Object storage for various data types:

- **Snapshots Bucket**: Archived web pages with lifecycle policies
- **Uploads Bucket**: User-uploaded files (PDFs, images)
- **Backups Bucket**: User data backups with 30-day retention
- **Thumbnails Bucket**: Thumbnail images with CloudFront CDN

**Key Features:**

- Server-side encryption for all buckets
- Versioning enabled for data protection
- Lifecycle policies for cost optimization
- CloudFront distribution for thumbnail delivery
- CORS configuration for browser uploads
- Public access blocked by default

**Lifecycle Policies:**

- Snapshots: Transition to IA after 90 days, Glacier after 180 days
- Backups: Automatic deletion after 30 days
- Old versions: Deleted after 30 days

### 6. ALB Module (`terraform/modules/alb/`)

Application Load Balancer for traffic distribution:

- **Load Balancer**: Application-level load balancing
- **Target Groups**: Health-checked target groups for ECS services
- **Listeners**: HTTP (redirect to HTTPS) and HTTPS listeners
- **SSL/TLS**: ACM certificate integration
- **WAF**: AWS WAF for DDoS protection and rate limiting

**Key Features:**

- HTTP to HTTPS redirect
- Health checks with configurable thresholds
- Connection draining for graceful shutdowns
- Access logs to S3 (optional)
- AWS WAF with managed rule sets
- Rate limiting (2000 requests per IP per 5 minutes)

### 7. ECS Module (`terraform/modules/ecs/`)

Container orchestration for API and workers:

- **Cluster**: ECS Fargate cluster with Container Insights
- **API Service**: Auto-scaling API service behind ALB
- **Workers**: Snapshot, index, and maintenance workers
- **IAM Roles**: Task execution and task roles with least privilege
- **Auto Scaling**: CPU and memory-based auto scaling

**Services:**

1. **API Service**: Handles HTTP requests, auto-scales 3-20 tasks
2. **Snapshot Worker**: Processes page archival jobs
3. **Index Worker**: Indexes content in OpenSearch
4. **Maintenance Worker**: Runs duplicate detection and broken link checks

**Key Features:**

- Fargate launch type (serverless containers)
- Auto-scaling based on CPU and memory
- Secrets Manager integration for credentials
- CloudWatch Logs for centralized logging
- Health checks for zero-downtime deployments
- S3 access for snapshot and file storage

### 8. Monitoring Module (`terraform/modules/monitoring/`)

Comprehensive monitoring and alerting:

- **Dashboard**: CloudWatch dashboard with key metrics
- **Alarms**: 15+ CloudWatch alarms for critical metrics
- **SNS**: Email notifications for alerts
- **Log Insights**: Pre-configured queries for troubleshooting
- **Composite Alarms**: Combined alarms for critical issues

**Monitored Metrics:**

- **ALB**: Response time, request count, error rates
- **ECS**: CPU/memory utilization, task health
- **RDS**: CPU, connections, storage, replication lag
- **Redis**: CPU, memory, cache hit rate
- **OpenSearch**: Cluster status, JVM memory, indexing rate

**Alarms:**

- High response time (>500ms)
- High 5xx error rate (>10 per 5 minutes)
- High CPU utilization (>80%)
- High memory utilization (>85%)
- Low storage space (<10GB)
- Redis low cache hit rate (<80%)
- OpenSearch cluster red/yellow status

## Environment Structure

### Production Environment (`terraform/environments/production/`)

Production-grade configuration with:

- **High Availability**: Multi-AZ deployment for all services
- **Performance**: Larger instance sizes (r6g.xlarge for RDS)
- **Redundancy**: Read replicas, multiple cache nodes
- **Security**: Deletion protection, encrypted storage
- **Monitoring**: Comprehensive alarms and dashboards

**Resource Sizing:**

- RDS: db.r6g.xlarge with 500GB storage
- Redis: cache.r6g.large with 3 nodes
- OpenSearch: r6g.large.search with 3 data nodes + 3 master nodes
- API: 1024 CPU / 2048 MB memory, 3-20 tasks
- Workers: 512 CPU / 1024 MB memory, 2 tasks each

### Development/Staging Environments

Can be created by copying the production environment and adjusting:

- Smaller instance sizes (t3 instead of r6g)
- Single-AZ deployment
- Fewer replicas
- Shorter backup retention
- No deletion protection

## Deployment Process

### Prerequisites

1. **AWS Account**: With appropriate permissions
2. **Terraform**: Version 1.5.0 or later
3. **AWS CLI**: Configured with credentials
4. **S3 Backend**: For Terraform state storage
5. **DynamoDB Table**: For state locking

### Initial Setup

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://bookmark-manager-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket bookmark-manager-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name bookmark-manager-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Deployment Steps

```bash
# Navigate to environment directory
cd terraform/environments/production

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Review planned changes
terraform plan -var-file="terraform.tfvars"

# Apply infrastructure
terraform apply -var-file="terraform.tfvars"
```

### Post-Deployment

After infrastructure is deployed:

1. **Database Migration**: Run database migrations
2. **OpenSearch Setup**: Create indexes and mappings
3. **DNS Configuration**: Point domain to ALB DNS name
4. **SSL Certificate**: Request ACM certificate for domain
5. **Deploy Application**: Push Docker images and update ECS services

## Security Best Practices

### Network Security

- **VPC Isolation**: All resources in private subnets except ALB
- **Security Groups**: Least privilege access between services
- **NACLs**: Additional network-level protection
- **VPC Flow Logs**: Network traffic monitoring

### Data Security

- **Encryption at Rest**: All data encrypted using KMS
- **Encryption in Transit**: TLS 1.2+ for all connections
- **Secrets Management**: AWS Secrets Manager for credentials
- **IAM Roles**: Least privilege access for services

### Application Security

- **WAF**: Protection against common web exploits
- **Rate Limiting**: Per-IP rate limiting
- **DDoS Protection**: AWS Shield Standard
- **Security Groups**: Restrictive ingress/egress rules

## Cost Optimization

### Strategies Implemented

1. **Right-Sizing**: Appropriate instance sizes for workload
2. **Auto Scaling**: Scale down during low traffic
3. **Spot Instances**: Use Fargate Spot for workers (optional)
4. **S3 Lifecycle**: Transition old data to cheaper storage
5. **VPC Endpoints**: Reduce data transfer costs
6. **Reserved Instances**: For production RDS and ElastiCache

### Estimated Monthly Costs (Production)

- **RDS**: ~$500 (db.r6g.xlarge Multi-AZ)
- **ElastiCache**: ~$300 (3x cache.r6g.large)
- **OpenSearch**: ~$600 (3 data + 3 master nodes)
- **ECS Fargate**: ~$400 (API + workers)
- **ALB**: ~$50
- **S3**: ~$100 (varies with usage)
- **Data Transfer**: ~$100 (varies with traffic)
- **CloudWatch**: ~$50

**Total**: ~$2,100/month (varies with usage)

## Monitoring and Alerting

### CloudWatch Dashboard

Access the dashboard at:

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=bookmark-manager-production
```

### Key Metrics

- **API Performance**: Response time, throughput, error rate
- **Resource Utilization**: CPU, memory, storage
- **Database Performance**: Connections, queries, replication lag
- **Cache Performance**: Hit rate, evictions, memory usage
- **Search Performance**: Query latency, indexing rate

### Alert Channels

- **Email**: Sent to configured email addresses
- **SNS Topic**: Can integrate with PagerDuty, Slack, etc.
- **CloudWatch Alarms**: Visible in AWS Console

## Disaster Recovery

### Backup Strategy

- **RDS**: Automated daily backups, 30-day retention
- **Redis**: Daily snapshots, 5-day retention
- **OpenSearch**: Automated hourly snapshots
- **S3**: Versioning enabled, cross-region replication (optional)

### Recovery Procedures

1. **Database Recovery**: Restore from automated backup or snapshot
2. **Point-in-Time Recovery**: RDS supports PITR within retention period
3. **Cache Recovery**: Redis automatically rebuilds from RDS
4. **Search Recovery**: Re-index from database if needed

### RTO/RPO Targets

- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 5 minutes (RDS PITR)

## Maintenance

### Regular Tasks

- **Security Patches**: Auto-applied during maintenance windows
- **Backup Verification**: Monthly restore tests
- **Cost Review**: Monthly cost analysis and optimization
- **Performance Review**: Quarterly performance tuning
- **Capacity Planning**: Quarterly growth analysis

### Maintenance Windows

- **RDS**: Sunday 04:00-05:00 UTC
- **ElastiCache**: Sunday 05:00-07:00 UTC
- **OpenSearch**: Automatic during low-traffic periods

## Troubleshooting

### Common Issues

1. **High Response Time**
   - Check ECS CPU/memory utilization
   - Review RDS slow query logs
   - Check OpenSearch query performance

2. **Database Connection Errors**
   - Verify security group rules
   - Check connection pool settings
   - Review RDS connection count

3. **Cache Misses**
   - Review cache hit rate metrics
   - Check Redis memory usage
   - Verify cache key patterns

4. **Search Errors**
   - Check OpenSearch cluster status
   - Review JVM memory pressure
   - Verify index health

### Log Locations

- **API Logs**: `/ecs/bookmark-manager-production` (CloudWatch)
- **RDS Logs**: RDS console → Logs & events
- **Redis Logs**: `/aws/elasticache/bookmark-manager-production/*`
- **OpenSearch Logs**: `/aws/opensearch/bookmark-manager-production/*`

## Next Steps

1. **CI/CD Integration**: Automate deployments with GitHub Actions
2. **Multi-Region**: Deploy to multiple regions for global availability
3. **Advanced Monitoring**: Integrate with Datadog or New Relic
4. **Cost Optimization**: Implement Savings Plans and Reserved Instances
5. **Security Hardening**: Enable GuardDuty and Security Hub

## References

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [OpenSearch Best Practices](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html)
