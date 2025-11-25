variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "ALB security group ID"
  type        = string
}

variable "api_target_group_arn" {
  description = "API target group ARN"
  type        = string
}

variable "alb_listener_arn" {
  description = "ALB listener ARN"
  type        = string
}

variable "db_secret_arn" {
  description = "Database secret ARN"
  type        = string
}

variable "redis_secret_arn" {
  description = "Redis secret ARN"
  type        = string
}

variable "opensearch_secret_arn" {
  description = "OpenSearch secret ARN"
  type        = string
}

variable "secrets_arns" {
  description = "List of secret ARNs for task execution role"
  type        = list(string)
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs for task role"
  type        = list(string)
}

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
  default     = 512
}

variable "api_memory" {
  description = "Memory for API task"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired count for API service"
  type        = number
  default     = 2
}

variable "api_min_capacity" {
  description = "Minimum capacity for API auto scaling"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum capacity for API auto scaling"
  type        = number
  default     = 10
}

variable "worker_cpu" {
  description = "CPU units for worker tasks"
  type        = number
  default     = 256
}

variable "worker_memory" {
  description = "Memory for worker tasks"
  type        = number
  default     = 512
}

variable "worker_desired_count" {
  description = "Desired count for worker services"
  type        = number
  default     = 1
}
