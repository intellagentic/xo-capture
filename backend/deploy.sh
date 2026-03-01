#!/bin/bash

# XO Platform - Quick Deploy Script
# Deploys Lambda functions to AWS

set -e

REGION="us-west-1"
BUCKET_NAME="xo-client-data"

echo "🚀 XO Platform - Lambda Deployment"
echo "=================================="

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $ACCOUNT_ID"
echo "Region: $REGION"
echo ""

# Deploy /clients Lambda
echo "📦 Deploying /clients Lambda..."
cd lambdas/clients
zip -q -r function.zip lambda_function.py

# Check if Lambda exists
if aws lambda get-function --function-name xo-clients --region $REGION 2>/dev/null; then
    echo "   Updating existing function..."
    aws lambda update-function-code \
        --function-name xo-clients \
        --zip-file fileb://function.zip \
        --region $REGION \
        --output text > /dev/null
else
    echo "   Creating new function..."
    aws lambda create-function \
        --function-name xo-clients \
        --runtime python3.11 \
        --role arn:aws:iam::${ACCOUNT_ID}:role/xo-lambda-role \
        --handler lambda_function.lambda_handler \
        --zip-file fileb://function.zip \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables="{BUCKET_NAME=$BUCKET_NAME}" \
        --region $REGION \
        --output text > /dev/null
fi

rm function.zip
cd ../..
echo "   ✅ /clients Lambda deployed"

# Deploy /upload Lambda
echo "📦 Deploying /upload Lambda..."
cd lambdas/upload
zip -q -r function.zip lambda_function.py

# Check if Lambda exists
if aws lambda get-function --function-name xo-upload --region $REGION 2>/dev/null; then
    echo "   Updating existing function..."
    aws lambda update-function-code \
        --function-name xo-upload \
        --zip-file fileb://function.zip \
        --region $REGION \
        --output text > /dev/null
else
    echo "   Creating new function..."
    aws lambda create-function \
        --function-name xo-upload \
        --runtime python3.11 \
        --role arn:aws:iam::${ACCOUNT_ID}:role/xo-lambda-role \
        --handler lambda_function.lambda_handler \
        --zip-file fileb://function.zip \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables="{BUCKET_NAME=$BUCKET_NAME}" \
        --region $REGION \
        --output text > /dev/null
fi

rm function.zip
cd ../..
echo "   ✅ /upload Lambda deployed"

echo ""
echo "✨ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Create API Gateway endpoints (see DEPLOY.md)"
echo "2. Test with: ./test-api.sh"
