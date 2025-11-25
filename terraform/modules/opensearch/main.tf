# OpenSearch Module - Full-text search engine

# Security Group
resource "aws_security_group" "opensearch" {
  name        = "${var.project_name}-${var.environment}-opensearch-sg"
  description = "Security group for OpenSearch"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTPS from ECS"
    from_port       = 443
    to_port         = 443
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
    Name        = "${var.project_name}-${var.environment}-opensearch-sg"
    Environment = var.environment
  }
}

# OpenSearch Domain
resource "aws_opensearch_domain" "main" {
  domain_name    = "${var.project_name}-${var.environment}"
  engine_version = var.engine_version

  cluster_config {
    instance_type            = var.instance_type
    instance_count           = var.instance_count
    dedicated_master_enabled = var.dedicated_master_enabled
    dedicated_master_type    = var.dedicated_master_enabled ? var.dedicated_master_type : null
    dedicated_master_count   = var.dedicated_master_enabled ? var.dedicated_master_count : null
    zone_awareness_enabled   = var.instance_count > 1

    dynamic "zone_awareness_config" {
      for_each = var.instance_count > 1 ? [1] : []
      content {
        availability_zone_count = min(var.instance_count, 3)
      }
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.ebs_volume_size
    iops        = var.ebs_iops
    throughput  = var.ebs_throughput
  }

  encrypt_at_rest {
    enabled    = true
    kms_key_id = var.kms_key_id
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  vpc_options {
    subnet_ids         = slice(var.private_subnet_ids, 0, min(length(var.private_subnet_ids), var.instance_count))
    security_group_ids = [aws_security_group.opensearch.id]
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = var.master_username
      master_user_password = random_password.master.result
    }
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_index_slow.arn
    log_type                 = "INDEX_SLOW_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_search_slow.arn
    log_type                 = "SEARCH_SLOW_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_error.arn
    log_type                 = "ES_APPLICATION_LOGS"
  }

  automated_snapshot_start_hour = var.automated_snapshot_start_hour

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch"
    Environment = var.environment
  }
}

# Random password for master user
resource "random_password" "master" {
  length  = 32
  special = true
}

# Store credentials in Secrets Manager
resource "aws_secretsmanager_secret" "opensearch_credentials" {
  name                    = "${var.project_name}-${var.environment}-opensearch-credentials"
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "opensearch_credentials" {
  secret_id = aws_secretsmanager_secret.opensearch_credentials.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    endpoint = aws_opensearch_domain.main.endpoint
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "opensearch_index_slow" {
  name              = "/aws/opensearch/${var.project_name}-${var.environment}/index-slow"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-index-slow"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "opensearch_search_slow" {
  name              = "/aws/opensearch/${var.project_name}-${var.environment}/search-slow"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-search-slow"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "opensearch_error" {
  name              = "/aws/opensearch/${var.project_name}-${var.environment}/error"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-error"
    Environment = var.environment
  }
}

# CloudWatch Log Resource Policy
resource "aws_cloudwatch_log_resource_policy" "opensearch" {
  policy_name = "${var.project_name}-${var.environment}-opensearch-log-policy"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "es.amazonaws.com"
        }
        Action = [
          "logs:PutLogEvents",
          "logs:CreateLogStream"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/opensearch/${var.project_name}-${var.environment}/*"
      }
    ]
  })
}
