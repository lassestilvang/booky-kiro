output "domain_id" {
  description = "OpenSearch domain ID"
  value       = aws_opensearch_domain.main.domain_id
}

output "domain_name" {
  description = "OpenSearch domain name"
  value       = aws_opensearch_domain.main.domain_name
}

output "endpoint" {
  description = "OpenSearch domain endpoint"
  value       = aws_opensearch_domain.main.endpoint
}

output "kibana_endpoint" {
  description = "OpenSearch Dashboards endpoint"
  value       = aws_opensearch_domain.main.dashboard_endpoint
}

output "security_group_id" {
  description = "OpenSearch security group ID"
  value       = aws_security_group.opensearch.id
}

output "secret_arn" {
  description = "ARN of the secret containing OpenSearch credentials"
  value       = aws_secretsmanager_secret.opensearch_credentials.arn
}
