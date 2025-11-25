variable "project_name" {
  description = "Project name"
  type        = string
  default     = "bookmark-manager"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# Database variables
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 500
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "bookmarks"
}

variable "db_create_read_replica" {
  description = "Create read replica"
  type        = bool
  default     = true
}

# Redis variables
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 3
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

# OpenSearch variables
variable "opensearch_instance_type" {
  description = "OpenSearch instance type"
  type        = string
  default     = "r6g.large.search"
}

variable "opensearch_instance_count" {
  description = "Number of OpenSearch data nodes"
  type        = number
  default     = 3
}

variable "opensearch_dedicated_master_enabled" {
  description = "Enable dedicated master nodes"
  type        = bool
  default     = true
}

variable "opensearch_dedicated_master_type" {
  description = "OpenSearch dedicated master instance type"
  type        = string
  default     = "r6g.large.search"
}

variable "opensearch_dedicated_master_count" {
  description = "Number of dedicated master nodes"
  type        = number
  default     = 3
}

variable "opensearch_ebs_volume_size" {
  description = "OpenSearch EBS volume size in GB"
  type        = number
  default     = 500
}

# ECS variables
variable "api_image" {
  description = "Docker image for API"
  type        = string
}

variable "snapshot_worker_image" {
  description = "Docker image for snapshot worker"
  type        = string
}

variable "index_worker_image" {
  description = "Docker image for index worker"
  type        = string
}

variable "maintenance_worker_image" {
  description = "Docker image for maintenance worker"
  type        = string
}

variable "api_cpu" {
  description = "CPU units for API task"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Memory for API task"
  type        = number
  default     = 2048
}

variable "api_desired_count" {
  description = "Desired count for API service"
  type        = number
  default     = 3
}

variable "api_min_capacity" {
  description = "Minimum capacity for API auto scaling"
  type        = number
  default     = 3
}

variable "api_max_capacity" {
  description = "Maximum capacity for API auto scaling"
  type        = number
  default     = 20
}

variable "worker_cpu" {
  description = "CPU units for worker tasks"
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "Memory for worker tasks"
  type        = number
  default     = 1024
}

variable "worker_desired_count" {
  description = "Desired count for worker services"
  type        = number
  default     = 2
}

# ALB variables
variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

# CORS variables
variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://bookmarks.example.com"]
}

# Monitoring variables
variable "alert_emails" {
  description = "List of email addresses for alerts"
  type        = list(string)
  default     = []
}
