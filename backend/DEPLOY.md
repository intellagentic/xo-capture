# XO Backend Deployment Guide

## Prerequisites
- AWS CLI configured with credentials
- AWS region: us-west-1 (or modify as needed)
- Python 3.11 runtime for Lambdas

## Step 1: Create S3 Bucket for Client Data

```bash
# Create the S3 bucket
aws s3 mb s3://xo-client-data --region us-west-1

# Enable versioning (optional but recommended)
aws s3api put-bucket-versioning \
  --bucket xo-client-data \
  --versioning-configuration Status=Enabled \
  --region us-west-1

# Block public access
aws s3api put-public-access-block \
  --bucket xo-client-data \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region us-west-1

# Add CORS configuration for presigned URLs
cat > /tmp/cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket xo-client-data \
  --cors-configuration file:///tmp/cors.json \
  --region us-west-1
```

## Step 2: Create IAM Role for Lambda

```bash
# Create trust policy
cat > /tmp/lambda-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name xo-lambda-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name xo-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for S3 access
cat > /tmp/lambda-s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::xo-client-data",
        "arn:aws:s3:::xo-client-data/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name xo-lambda-role \
  --policy-name xo-s3-access \
  --policy-document file:///tmp/lambda-s3-policy.json
```

## Step 3: Deploy Lambda Functions

### Deploy /clients Lambda

```bash
cd backend/lambdas/clients
zip -r function.zip lambda_function.py
aws lambda create-function \
  --function-name xo-clients \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/xo-lambda-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{BUCKET_NAME=xo-client-data}" \
  --region us-west-1
```

To update after changes:
```bash
cd backend/lambdas/clients
zip -r function.zip lambda_function.py
aws lambda update-function-code \
  --function-name xo-clients \
  --zip-file fileb://function.zip \
  --region us-west-1
```

## Step 4: Create API Gateway

```bash
# Create REST API
aws apigateway create-rest-api \
  --name xo-api \
  --description "XO Platform API" \
  --region us-west-1

# Get the API ID (save this)
export API_ID=$(aws apigateway get-rest-apis --region us-west-1 --query "items[?name=='xo-api'].id" --output text)

# Get root resource ID
export ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region us-west-1 --query 'items[0].id' --output text)

# Create /clients resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part clients \
  --region us-west-1

# Get clients resource ID
export CLIENTS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region us-west-1 --query "items[?path=='/clients'].id" --output text)

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $CLIENTS_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-west-1

# Enable CORS for POST
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $CLIENTS_ID \
  --http-method POST \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin": true}' \
  --region us-west-1

# Integrate with Lambda
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export LAMBDA_ARN="arn:aws:lambda:us-west-1:${ACCOUNT_ID}:function:xo-clients"

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $CLIENTS_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-west-1:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region us-west-1

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name xo-clients \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-west-1:${ACCOUNT_ID}:${API_ID}/*/*" \
  --region us-west-1

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-west-1

# Your API endpoint will be:
echo "https://${API_ID}.execute-api.us-west-1.amazonaws.com/prod"
```

## Step 5: Test the Endpoint

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-west-1.amazonaws.com/prod/clients \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Company",
    "description": "A test company"
  }'
```

Expected response:
```json
{
  "client_id": "client_1234567890_abcd",
  "status": "created"
}
```

## Update Frontend API URL

After deployment, update the API_BASE constant in `src/App.jsx`:

```javascript
const API_BASE = 'https://YOUR_API_ID.execute-api.us-west-1.amazonaws.com/prod'
```
