# Monitoring Module - CloudWatch dashboards, alarms, and log aggregation

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${var.environment}-alerts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = length(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_emails[count.index]
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # API Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            [".", ".", { stat = "p95" }],
            [".", ".", { stat = "p99" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "API Response Time"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", { stat = "Sum" }],
            [".", "HTTPCode_Target_2XX_Count", { stat = "Sum" }],
            [".", "HTTPCode_Target_4XX_Count", { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "API Request Count"
        }
      },
      # ECS Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", { stat = "Average", dimensions = { ClusterName = var.ecs_cluster_name } }],
            [".", "MemoryUtilization", { stat = "Average", dimensions = { ClusterName = var.ecs_cluster_name } }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Resource Utilization"
        }
      },
      # RDS Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", { stat = "Average", dimensions = { DBInstanceIdentifier = var.db_instance_id } }],
            [".", "DatabaseConnections", { stat = "Average", dimensions = { DBInstanceIdentifier = var.db_instance_id } }],
            [".", "FreeableMemory", { stat = "Average", dimensions = { DBInstanceIdentifier = var.db_instance_id } }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      },
      # Redis Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { stat = "Average", dimensions = { ReplicationGroupId = var.redis_replication_group_id } }],
            [".", "DatabaseMemoryUsagePercentage", { stat = "Average", dimensions = { ReplicationGroupId = var.redis_replication_group_id } }],
            [".", "CacheHitRate", { stat = "Average", dimensions = { ReplicationGroupId = var.redis_replication_group_id } }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Redis Metrics"
        }
      },
      # OpenSearch Metrics
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ES", "ClusterStatus.green", { stat = "Minimum", dimensions = { DomainName = var.opensearch_domain_name } }],
            [".", "ClusterStatus.yellow", { stat = "Maximum", dimensions = { DomainName = var.opensearch_domain_name } }],
            [".", "ClusterStatus.red", { stat = "Maximum", dimensions = { DomainName = var.opensearch_domain_name } }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "OpenSearch Cluster Status"
        }
      }
    ]
  })
}

# ALB Alarms
resource "aws_cloudwatch_metric_alarm" "alb_high_response_time" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 0.5
  alarm_description   = "ALB response time is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-alb-high-response-time"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_high_5xx_errors" {
  alarm_name          = "${var.project_name}-${var.environment}-alb-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB 5xx error rate is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-alb-high-5xx-errors"
    Environment = var.environment
  }
}

# ECS Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-ecs-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-high-cpu"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_high_memory" {
  alarm_name          = "${var.project_name}-${var.environment}-ecs-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "ECS memory utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-high-memory"
    Environment = var.environment
  }
}

# RDS Alarms
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-high-cpu"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240 # 10 GB in bytes
  alarm_description   = "RDS free storage space is low"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-low-storage"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_high_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS connection count is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-high-connections"
    Environment = var.environment
  }
}

# Redis Alarms
resource "aws_cloudwatch_metric_alarm" "redis_high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-high-cpu"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_low_cache_hit_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-redis-low-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CacheHitRate"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 0.8
  alarm_description   = "Redis cache hit rate is too low"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = var.redis_replication_group_id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-low-cache-hit-rate"
    Environment = var.environment
  }
}

# OpenSearch Alarms
resource "aws_cloudwatch_metric_alarm" "opensearch_cluster_red" {
  alarm_name          = "${var.project_name}-${var.environment}-opensearch-cluster-red"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ClusterStatus.red"
  namespace           = "AWS/ES"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "OpenSearch cluster status is red"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DomainName = var.opensearch_domain_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-cluster-red"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "opensearch_cluster_yellow" {
  alarm_name          = "${var.project_name}-${var.environment}-opensearch-cluster-yellow"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ClusterStatus.yellow"
  namespace           = "AWS/ES"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "OpenSearch cluster status is yellow"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DomainName = var.opensearch_domain_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-cluster-yellow"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "opensearch_high_jvm_memory" {
  alarm_name          = "${var.project_name}-${var.environment}-opensearch-high-jvm-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "JVMMemoryPressure"
  namespace           = "AWS/ES"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "OpenSearch JVM memory pressure is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DomainName = var.opensearch_domain_name
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-opensearch-high-jvm-memory"
    Environment = var.environment
  }
}

# Log Metric Filters and Alarms
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${var.project_name}-${var.environment}-api-errors"
  log_group_name = var.ecs_log_group_name
  pattern        = "[time, request_id, level=ERROR*, ...]"

  metric_transformation {
    name      = "APIErrors"
    namespace = "${var.project_name}/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-api-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "APIErrors"
  namespace           = "${var.project_name}/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "API error rate is too high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-error-rate"
    Environment = var.environment
  }
}

# CloudWatch Logs Insights Queries
resource "aws_cloudwatch_query_definition" "api_errors_query" {
  name = "${var.project_name}-${var.environment}-api-errors"

  log_group_names = [var.ecs_log_group_name]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter level = "ERROR"
    | sort @timestamp desc
    | limit 100
  QUERY
}

resource "aws_cloudwatch_query_definition" "slow_queries" {
  name = "${var.project_name}-${var.environment}-slow-queries"

  log_group_names = [var.ecs_log_group_name]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /duration/
    | parse @message /duration: (?<duration>\d+)ms/
    | filter duration > 1000
    | sort duration desc
    | limit 50
  QUERY
}

# CloudWatch Composite Alarm for Critical Issues
resource "aws_cloudwatch_composite_alarm" "critical_system_health" {
  alarm_name          = "${var.project_name}-${var.environment}-critical-system-health"
  alarm_description   = "Critical system health issues detected"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alerts.arn]

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.alb_high_5xx_errors.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.rds_high_cpu.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.opensearch_cluster_red.alarm_name})"
  ])

  tags = {
    Name        = "${var.project_name}-${var.environment}-critical-system-health"
    Environment = var.environment
  }
}
