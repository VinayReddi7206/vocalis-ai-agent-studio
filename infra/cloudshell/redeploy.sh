#!/bin/bash
set -euo pipefail

FUNCTION_NAME="vocalis-agent-studio"
REGION="${DEPLOY_REGION:-ap-south-1}"

if command -v corepack >/dev/null 2>&1; then
  PNPM_CMD=(corepack pnpm)
else
  echo "Corepack is required to build Vocalis in CloudShell."
  exit 1
fi

echo "Building the refreshed Vocalis interface..."
rm -rf .next-cloudshell runtime deployment.zip
NEXT_DIST_DIR=.next-cloudshell "${PNPM_CMD[@]}" build:aws

echo "Preparing the Lambda package..."
mkdir -p runtime/.next-cloudshell/static
cp -a .next-cloudshell/standalone/. runtime/
cp -a public runtime/public
cp -a .next-cloudshell/static/. runtime/.next-cloudshell/static/
cp infra/cloudshell/run.sh runtime/run.sh
rm -rf runtime/.next-cloudshell/cache
ln -s /tmp/cache runtime/.next-cloudshell/cache
chmod +x runtime/run.sh
(
  cd runtime
  zip -qry ../deployment.zip .
)

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
PACKAGE_BUCKET="vocalis-deploy-${ACCOUNT_ID}-${REGION}"
PACKAGE_KEY="releases/deployment.zip"

echo "Uploading the refreshed application..."
aws s3 cp deployment.zip "s3://${PACKAGE_BUCKET}/${PACKAGE_KEY}" \
  --region "$REGION" \
  --only-show-errors
aws lambda update-function-code \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --s3-bucket "$PACKAGE_BUCKET" \
  --s3-key "$PACKAGE_KEY" >/dev/null
aws lambda wait function-updated-v2 \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME"

APP_URL="$(aws lambda get-function-url-config \
  --region "$REGION" \
  --function-name "$FUNCTION_NAME" \
  --query 'FunctionUrl' \
  --output text)"

echo
echo "Vocalis redesign deployed successfully."
echo "Application URL: ${APP_URL}"
