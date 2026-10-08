variable "aws_region" {
  description = "AWS region for the demo deployment."
  type        = string
  default     = "ap-south-1"
}

variable "image_uri" {
  description = "Immutable ECR image URI including its tag or digest."
  type        = string
}

variable "billing_alert_email" {
  description = "Optional email for a small monthly AWS budget alert."
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost alert threshold."
  type        = number
  default     = 2
}
