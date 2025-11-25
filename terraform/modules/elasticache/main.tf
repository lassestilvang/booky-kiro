# ElastiCache Redis Module - Cache and session store

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-redis-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-subnet"
    Environment = var.environment
  }
}

# Security Group
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-sg"
    Environment = var.environment
  }
}

# Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  name   = "${var.project_name}-${var.environment}-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-params"
    Environment = var.environment
  }
}

# Replication Group (Cluster Mode Disabled)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  replication_group_description = "Redis cluster for ${var.project_name} ${var.environment}"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  port                 = 6379

  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled          = var.num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  auth_token                = random_password.auth_token.result

  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window         = var.snapshot_window
  maintenance_window      = var.maintenance_window

  notification_topic_arn = var.sns_topic_arn

  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis"
    Environment = var.environment
  }
}

# Random auth token
resource "random_password" "auth_token" {
  length  = 32
  special = false
}

# Store auth token in Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "${var.project_name}-${var.environment}-redis-auth"
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-auth"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = aws_secretsmanager_secret.redis_auth.id
  secret_string = jsonencode({
    auth_token = random_password.auth_token.result
    endpoint   = aws_elasticache_replication_group.main.primary_endpoint_address
    port       = 6379
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}/slow-log"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-slow-log"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}/engine-log"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-engine-log"
    Environment = var.environment
  }
}
