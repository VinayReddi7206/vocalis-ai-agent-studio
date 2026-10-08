#!/bin/bash
set -euo pipefail

APP_NAME="vocalis-agent-studio"
FUNCTION_NAME="vocalis-agent-studio"
ROLE_NAME="vocalis-agent-studio-lambda-role"
REGION="${DEPLOY_REGION:-ap-south-1}"
LAYER_ARN="arn:aws:lambda:${REGION}:753240598075:layer:LambdaAdapterLayerX86:30"

if [ ! -f runtime/server.js ]; then
  echo "Installing dependencies and building on AWS Linux..."
  if command -v corepack >/dev/null 2>&1; then
    corepack prepare pnpm@11.25.0 --activate || true
    PNPM_CMD=(corepack pnpm)
  else
    npm install --global pnpm@11.25.0
    PNPM_CMD=(pnpm)
  fi
  "${PNPM_CMD[@]}" install --frozen-lockfile
  NEXT_DIST_DIR=.next-cloudshell "${PNPM_CMD[@]}" build:aws

  mkdir -p runtime/.next-cloudshell/static
  cp -a .next-cloudshell/standalone/. runtime/
  cp -a public runtime/public
  cp -a .next-cloudshell/static/. runtime/.next-cloudshell/static/
  cp infra/cloudshell/run.sh runtime/run.sh
fi

echo "Preparing the Lambda package..."
rm -f deployment.zip
rm -rf runtime/.next-cloudshell/cache
ln -s /tmp/cache runtime/.next-cloudshell/cache
chmod +x runtime/run.sh
(
  cd runtime
  zip -qry ../deployment.zip .
)

cat > trust-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

cat > environment.json <<'JSON'
{
  "Variables": {
    "AWS_LAMBDA_EXEC_WRAPPER": "/opt/bootstrap",
    "AWS_LWA_PORT": "8000",
    "AWS_LWA_ENABLE_COMPRESSION": "true",
    "PORT": "8000",
    "NODE_ENV": "production",
    "HOSTNAME": "0.0.0.0",
    "CALLMISSED_BUDGET_USD": "20",
    "CALLMISSED_BUDGET_RESERVE_USD": "0.25"
  }
}
JSON

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Creating the Lambda execution role..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document file://trust-policy.json \
    --description "Runtime role for the Vocalis assignment" >/dev/null
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
fi

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
PACKAGE_BUCKET="vocalis-deploy-${ACCOUNT_ID}-${REGION}"
PACKAGE_KEY="releases/deployment.zip"

if ! aws s3api head-bucket --bucket "$PACKAGE_BUCKET" >/dev/null 2>&1; then
  echo "Creating a private deployment bucket..."
  aws s3api create-bucket \
    --region "$REGION" \
    --bucket "$PACKAGE_BUCKET" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
fi

aws s3api put-public-access-block \
  --region "$REGION" \
  --bucket "$PACKAGE_BUCKET" \
  --public-access-block-configuration \
    'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' >/dev/null
aws s3 cp deployment.zip "s3://${PACKAGE_BUCKET}/${PACKAGE_KEY}" --region "$REGION" --only-show-errors

if aws lambda get-function --region "$REGION" --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "Updating the existing Lambda function..."
  aws lambda update-function-code \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket "$PACKAGE_BUCKET" \
    --s3-key "$PACKAGE_KEY" >/dev/null
  aws lambda wait function-updated-v2 --region "$REGION" --function-name "$FUNCTION_NAME"
  aws lambda update-function-configuration \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs22.x \
    --handler run.sh \
    --role "$ROLE_ARN" \
    --timeout 30 \
    --memory-size 1024 \
    --layers "$LAYER_ARN" >/dev/null
else
  echo "Creating the Lambda function..."
  for attempt in 1 2 3 4 5 6; do
    if aws lambda create-function \
      --region "$REGION" \
      --function-name "$FUNCTION_NAME" \
      --description "Vocalis AI Agent Studio assignment" \
      --runtime nodejs22.x \
      --handler run.sh \
      --role "$ROLE_ARN" \
      --code "S3Bucket=${PACKAGE_BUCKET},S3Key=${PACKAGE_KEY}" \
      --timeout 30 \
      --memory-size 1024 \
      --architectures x86_64 \
      --layers "$LAYER_ARN" \
      --environment file://environment.json >/dev/null 2>&1; then
      break
    fi
    if [ "$attempt" -eq 6 ]; then
      echo "Lambda creation failed after waiting for the IAM role. Run this script once more."
      exit 1
    fi
    echo "Waiting for the new IAM role to become available..."
    sleep 10
  done
fi

aws lambda wait function-active-v2 --region "$REGION" --function-name "$FUNCTION_NAME"
aws lambda put-function-concurrency \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --reserved-concurrent-executions 2 >/dev/null 2>&1 || \
  echo "Reserved concurrency is unavailable for this account; continuing with account defaults."

if ! aws lambda get-function-url-config --region "$REGION" --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "Creating the public application URL..."
  aws lambda create-function-url-config \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --invoke-mode BUFFERED >/dev/null
fi

aws lambda add-permission \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE >/dev/null 2>&1 || true

aws lambda add-permission \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --statement-id FunctionURLInvokeAllowPublicAccess \
  --action lambda:InvokeFunction \
  --principal '*' \
  --invoked-via-function-url >/dev/null 2>&1 || true

APP_URL="$(aws lambda get-function-url-config \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --query 'FunctionUrl' \
  --output text)"

echo
echo "Deployment complete."
echo "Application URL: ${APP_URL}"
echo "Health URL: ${APP_URL}api/health"
echo
echo "The app is deployed in preview mode without a CallMissed API key."
