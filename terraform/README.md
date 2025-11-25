# Terraform Infrastructure

This directory contains Terraform modules for deploying the Bookmark Manager Platform infrastructure on AWS.

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- An AWS account with necessary permissions

## Architecture

The infrastructure consists of:

- **VPC**: Isolated network with public and private subnets across multiple AZs
- **RDS PostgreSQL**: Primary database with Multi-AZ deployment
- **ElastiCache Redis**: Cache and session store with cluster mode
- **OpenSearch**: Full-text search engine (alternative to Elasticsearch)
- **S3 Buckets**: Object storage for snapshots, uploads, and backups
- **ECS Cluster**: Container orchestration for API and workers
- **Application Load Balancer**: Traffic distribution and SSL termination
- **CloudWatch**: Monitoring, logging, and alerting

## Directory Structure

```
terraform/
├── modules/
│   ├── vpc/              # VPC and networking
│   ├── rds/              # PostgreSQL database
│   ├── elasticache/      # Redis cache
│   ├── opensearch/       # OpenSearch cluster
│   ├── s3/               # S3 buckets
│   ├── ecs/              # ECS cluster and services
│   └── alb/              # Application Load Balancer
├── environments/
│   ├── dev/              # Development environment
│   ├── staging/          # Staging environment
│   └── production/       # Production environment
└── README.md
```

## Usage

### Initialize Terraform

```bash
cd terraform/environments/dev
terraform init
```

### Plan Infrastructure Changes

```bash
terraform plan -var-file="terraform.tfvars"
```

### Apply Infrastructure

```bash
terraform apply -var-file="terraform.tfvars"
```

### Destroy Infrastructure

```bash
terraform destroy -var-file="terraform.tfvars"
```

## Environment Variables

Create a `terraform.tfvars` file in each environment directory:

```hcl
project_name = "bookmark-manager"
environment  = "dev"
aws_region   = "us-east-1"

# Database
db_instance_class = "db.t3.medium"
db_allocated_storage = 100

# Redis
redis_node_type = "cache.t3.medium"
redis_num_cache_nodes = 2

# OpenSearch
opensearch_instance_type = "t3.medium.search"
opensearch_instance_count = 2

# ECS
api_cpu = 512
api_memory = 1024
api_desired_count = 2

worker_cpu = 256
worker_memory = 512
worker_desired_count = 1
```

## Outputs

After applying, Terraform will output:

- VPC ID and subnet IDs
- RDS endpoint and connection string
- Redis endpoint
- OpenSearch endpoint
- S3 bucket names
- Load balancer DNS name
- ECS cluster name

## Security

- All sensitive data is encrypted at rest
- TLS/SSL enforced for all connections
- Security groups follow least privilege principle
- Secrets managed via AWS Secrets Manager
- VPC endpoints for AWS services to avoid internet traffic

## Cost Optimization

- Use appropriate instance sizes for each environment
- Enable auto-scaling for ECS services
- Use Reserved Instances for production
- Implement lifecycle policies for S3
- Monitor costs with AWS Cost Explorer

## Monitoring

CloudWatch dashboards and alarms are automatically created for:

- API response times and error rates
- Database CPU, memory, and connections
- Redis cache hit rates
- OpenSearch cluster health
- ECS task health and resource utilization
- Load balancer metrics
