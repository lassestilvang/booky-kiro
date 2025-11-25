output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.main.id
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "RDS instance address"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.main.db_name
}

output "db_username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "db_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "db_secret_arn" {
  description = "ARN of the secret containing database credentials"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "replica_endpoint" {
  description = "Read replica endpoint"
  value       = var.create_read_replica ? aws_db_instance.replica[0].endpoint : null
}
