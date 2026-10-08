output "application_url" {
  description = "Public HTTPS URL for the Vocalis demo."
  value       = aws_lambda_function_url.app.function_url
}

output "lambda_function_name" {
  value = aws_lambda_function.app.function_name
}
