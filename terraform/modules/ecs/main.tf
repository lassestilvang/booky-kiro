# ECS Module - Container orchestration for API and workers

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}"
    Environment = var.environment
  }
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-logs"
    Environment = var.environment
  }
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-task-execution"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.project_name}-${var.environment}-ecs-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      }
    ]
  })
}

# ECS Task Role (for application permissions)
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-task"
    Environment = var.environment
  }
}

# S3 access policy for task role
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${var.project_name}-${var.environment}-ecs-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = concat(
          [for arn in var.s3_bucket_arns : arn],
          [for arn in var.s3_bucket_arns : "${arn}/*"]
        )
      }
    ]
  })
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-tasks"
    Environment = var.environment
  }
}

# API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = "3000"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.db_secret_arn}:host::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.redis_secret_arn}:endpoint::"
        },
        {
          name      = "OPENSEARCH_URL"
          valueFrom = "${var.opensearch_secret_arn}:endpoint::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-${var.environment}-api"
    Environment = var.environment
  }
}

# API Service
resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-${var.environment}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.api_target_group_arn
    container_name   = "api"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api"
    Environment = var.environment
  }

  depends_on = [var.alb_listener_arn]
}

# Auto Scaling for API
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project_name}-${var.environment}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${var.project_name}-${var.environment}-api-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
  }
}

# Worker Task Definitions and Services
resource "aws_ecs_task_definition" "snapshot_worker" {
  family                   = "${var.project_name}-${var.environment}-snapshot-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "snapshot-worker"
      image     = var.snapshot_worker_image
      essential = true

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "WORKER_TYPE"
          value = "snapshot"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.db_secret_arn}:host::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.redis_secret_arn}:endpoint::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "snapshot-worker"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-${var.environment}-snapshot-worker"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "snapshot_worker" {
  name            = "${var.project_name}-${var.environment}-snapshot-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.snapshot_worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-snapshot-worker"
    Environment = var.environment
  }
}

# Similar task definitions for index and maintenance workers
resource "aws_ecs_task_definition" "index_worker" {
  family                   = "${var.project_name}-${var.environment}-index-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "index-worker"
      image     = var.index_worker_image
      essential = true

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "WORKER_TYPE"
          value = "index"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.db_secret_arn}:host::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.redis_secret_arn}:endpoint::"
        },
        {
          name      = "OPENSEARCH_URL"
          valueFrom = "${var.opensearch_secret_arn}:endpoint::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "index-worker"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-${var.environment}-index-worker"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "index_worker" {
  name            = "${var.project_name}-${var.environment}-index-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.index_worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-index-worker"
    Environment = var.environment
  }
}

resource "aws_ecs_task_definition" "maintenance_worker" {
  family                   = "${var.project_name}-${var.environment}-maintenance-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "maintenance-worker"
      image     = var.maintenance_worker_image
      essential = true

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "WORKER_TYPE"
          value = "maintenance"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.db_secret_arn}:host::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${var.redis_secret_arn}:endpoint::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "maintenance-worker"
        }
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-${var.environment}-maintenance-worker"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "maintenance_worker" {
  name            = "${var.project_name}-${var.environment}-maintenance-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.maintenance_worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-maintenance-worker"
    Environment = var.environment
  }
}
