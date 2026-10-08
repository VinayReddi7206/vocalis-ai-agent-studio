# AWS deployment

The AWS target is a container-image Lambda behind a public HTTPS Function URL. This keeps idle cost low and lets the browser connect directly to CallMissed's WebRTC media server.

## Deployment order

1. Authenticate the AWS CLI with a restricted IAM identity; never use root access keys.
2. Create an ECR repository named `vocalis-agent-studio`.
3. Build `Dockerfile.aws`, tag the image, and push it to ECR.
4. Copy `terraform.tfvars.example` to `terraform.tfvars` and set the immutable ECR image URI and budget-alert email.
5. Run `terraform init`, `terraform plan`, and `terraform apply` from this directory.
6. Add `CALLMISSED_API_KEY` to the Lambda environment using the AWS console or an approved secret-management workflow. It is intentionally excluded from Terraform so it never enters Terraform state.
7. Open the `application_url` output and verify `/api/health`, chat, image generation, and voice.

## Cost controls

- Lambda reserved concurrency is limited to two.
- CloudWatch logs are retained for seven days.
- The default AWS monthly budget alert is $2.
- The application independently stops paid CallMissed requests near its $20 limit.

The Lambda Function URL is public for recruiter testing. Application rate limits and the CallMissed budget guard reduce abuse risk; remove the function after evaluation.
