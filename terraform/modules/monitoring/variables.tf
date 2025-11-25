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

variable "alert_emails" {
  description = "List of email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch metrics"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "api_service_name" {
  description = "API service name"
  type        = string
}

variable "db_instance_id" {
  description = "RDS instance ID"
  type        = string
}

variable "redis_replication_group_id" {
  description = "Redis replication group ID"
  type        = string
}

variable "opensearch_domain_name" {
  description = "OpenSearch domain name"
  type        = string
}

variable "ecs_log_group_name" {
  description = "ECS CloudWatch log group name"
  type        = string
}
