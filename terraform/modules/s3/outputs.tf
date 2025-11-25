output "snapshots_bucket_id" {
  description = "Snapshots bucket ID"
  value       = aws_s3_bucket.snapshots.id
}

output "snapshots_bucket_arn" {
  description = "Snapshots bucket ARN"
  value       = aws_s3_bucket.snapshots.arn
}

output "uploads_bucket_id" {
  description = "Uploads bucket ID"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "Uploads bucket ARN"
  value       = aws_s3_bucket.uploads.arn
}

output "backups_bucket_id" {
  description = "Backups bucket ID"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN"
  value       = aws_s3_bucket.backups.arn
}

output "thumbnails_bucket_id" {
  description = "Thumbnails bucket ID"
  value       = aws_s3_bucket.thumbnails.id
}

output "thumbnails_bucket_arn" {
  description = "Thumbnails bucket ARN"
  value       = aws_s3_bucket.thumbnails.arn
}

output "thumbnails_cdn_domain" {
  description = "CloudFront domain for thumbnails"
  value       = aws_cloudfront_distribution.thumbnails.domain_name
}

output "thumbnails_cdn_id" {
  description = "CloudFront distribution ID for thumbnails"
  value       = aws_cloudfront_distribution.thumbnails.id
}
