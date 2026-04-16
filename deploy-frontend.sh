#!/bin/bash
set -e

# XO Capture — Frontend-only deploy (build + S3 sync + CloudFront invalidation)
# Usage: ./deploy-frontend.sh

cd "$(dirname "$0")"

echo "Building..."
npm run build

echo "Syncing to S3..."
aws s3 sync dist/ s3://xo-prototype-frontend-mv --delete --profile intellagentic

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E7PWZX8BT02CE --paths "/*" --profile intellagentic --query 'Invalidation.Id' --output text

echo "Deployed and cache invalidated."
