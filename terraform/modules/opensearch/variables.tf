variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
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

variable "allowed_security_groups" {
  description = "Security groups allowed to access OpenSearch"
  type        = list(string)
}

variable "engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "OpenSearch_2.11"
}

variable "instance_type" {
  description = "Instance type for data nodes"
  type        = string
  default     = "t3.medium.search"
}

variable "instance_count" {
  description = "Number of data nodes"
  type        = number
  default     = 2
}

variable "dedicated_master_enabled" {
  description = "Enable dedicated master nodes"
  type        = bool
  default     = false
}

variable "dedicated_master_type" {
  description = "Instance type for dedicated master nodes"
  type        = string
  default     = "t3.small.search"
}

variable "dedicated_master_count" {
  description = "Number of dedicated master nodes"
  type        = number
  default     = 3
}

variable "ebs_volume_size" {
  description = "EBS volume size in GB"
  type        = number
  default     = 100
}

variable "ebs_iops" {
  description = "EBS IOPS"
  type        = number
  default     = 3000
}

variable "ebs_throughput" {
  description = "EBS throughput in MB/s"
  type        = number
  default     = 125
}

variable "master_username" {
  description = "Master username"
  type        = string
  default     = "admin"
}

variable "automated_snapshot_start_hour" {
  description = "Hour to start automated snapshots (UTC)"
  type        = number
  default     = 3
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
  default     = null
}
