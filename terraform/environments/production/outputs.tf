output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.redis_endpoint
}

output "opensearch_endpoint" {
  description = "OpenSearch endpoint"
  value       = module.opensearch.endpoint
}

output "opensearch_dashboards_endpoint" {
  description = "OpenSearch Dashboards endpoint"
  value       = module.opensearch.kibana_endpoint
}

output "snapshots_bucket" {
  description = "Snapshots S3 bucket"
  value       = module.s3.snapshots_bucket_id
}

output "uploads_bucket" {
  description = "Uploads S3 bucket"
  value       = module.s3.uploads_bucket_id
}

output "backups_bucket" {
  description = "Backups S3 bucket"
  value       = module.s3.backups_bucket_id
}

output "thumbnails_bucket" {
  description = "Thumbnails S3 bucket"
  value       = module.s3.thumbnails_bucket_id
}

output "thumbnails_cdn_domain" {
  description = "CloudFront domain for thumbnails"
  value       = module.s3.thumbnails_cdn_domain
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "db_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.rds.db_secret_arn
  sensitive   = true
}

output "redis_secret_arn" {
  description = "Redis auth token secret ARN"
  value       = module.elasticache.redis_secret_arn
  sensitive   = true
}

output "opensearch_secret_arn" {
  description = "OpenSearch credentials secret ARN"
  value       = module.opensearch.secret_arn
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.monitoring.dashboard_url
}

output "alerts_sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = module.monitoring.sns_topic_arn
}
