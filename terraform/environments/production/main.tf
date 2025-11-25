# Production Environment Configuration

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket         = "bookmark-manager-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "bookmark-manager-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  enable_nat_gateway = true
  enable_flow_logs   = true
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.ecs_task_security_group_id]

  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  engine_version              = var.db_engine_version
  database_name               = var.db_name
  multi_az                    = true
  backup_retention_period     = 30
  deletion_protection         = true
  skip_final_snapshot         = false
  performance_insights_enabled = true
  create_read_replica         = var.db_create_read_replica
}

# ElastiCache Module
module "elasticache" {
  source = "../../modules/elasticache"

  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.ecs_task_security_group_id]

  node_type                = var.redis_node_type
  num_cache_nodes          = var.redis_num_cache_nodes
  engine_version           = var.redis_engine_version
  snapshot_retention_limit = 7
}

# OpenSearch Module
module "opensearch" {
  source = "../../modules/opensearch"

  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs.ecs_task_security_group_id]

  instance_type              = var.opensearch_instance_type
  instance_count             = var.opensearch_instance_count
  dedicated_master_enabled   = var.opensearch_dedicated_master_enabled
  dedicated_master_type      = var.opensearch_dedicated_master_type
  dedicated_master_count     = var.opensearch_dedicated_master_count
  ebs_volume_size            = var.opensearch_ebs_volume_size
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  project_name         = var.project_name
  environment          = var.environment
  cors_allowed_origins = var.cors_allowed_origins
}

# ALB Module
module "alb" {
  source = "../../modules/alb"

  project_name               = var.project_name
  environment                = var.environment
  vpc_id                     = module.vpc.vpc_id
  public_subnet_ids          = module.vpc.public_subnet_ids
  certificate_arn            = var.certificate_arn
  enable_deletion_protection = true
  enable_waf                 = true
}

# ECS Module
module "ecs" {
  source = "../../modules/ecs"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  alb_security_group_id = module.alb.alb_security_group_id
  api_target_group_arn  = module.alb.api_target_group_arn
  alb_listener_arn      = module.alb.https_listener_arn

  db_secret_arn         = module.rds.db_secret_arn
  redis_secret_arn      = module.elasticache.redis_secret_arn
  opensearch_secret_arn = module.opensearch.secret_arn

  secrets_arns = [
    module.rds.db_secret_arn,
    module.elasticache.redis_secret_arn,
    module.opensearch.secret_arn
  ]

  s3_bucket_arns = [
    module.s3.snapshots_bucket_arn,
    module.s3.uploads_bucket_arn,
    module.s3.backups_bucket_arn,
    module.s3.thumbnails_bucket_arn
  ]

  api_image                 = var.api_image
  snapshot_worker_image     = var.snapshot_worker_image
  index_worker_image        = var.index_worker_image
  maintenance_worker_image  = var.maintenance_worker_image

  api_cpu            = var.api_cpu
  api_memory         = var.api_memory
  api_desired_count  = var.api_desired_count
  api_min_capacity   = var.api_min_capacity
  api_max_capacity   = var.api_max_capacity

  worker_cpu           = var.worker_cpu
  worker_memory        = var.worker_memory
  worker_desired_count = var.worker_desired_count
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  alert_emails = var.alert_emails

  alb_arn_suffix              = split("/", module.alb.alb_arn)[1]
  ecs_cluster_name            = module.ecs.cluster_name
  api_service_name            = module.ecs.api_service_name
  db_instance_id              = module.rds.db_instance_id
  redis_replication_group_id  = module.elasticache.replication_group_id
  opensearch_domain_name      = module.opensearch.domain_name
  ecs_log_group_name          = "/ecs/${var.project_name}-${var.environment}"
}
