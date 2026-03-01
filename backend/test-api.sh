#!/bin/bash

# XO Platform - API Test Script
# Tests deployed Lambda functions via API Gateway

set -e

# Update this with your API Gateway endpoint after deployment
API_BASE="${1:-https://YOUR_API_ID.execute-api.us-west-1.amazonaws.com/prod}"

echo "🧪 Testing XO Platform API"
echo "=========================="
echo "API Base: $API_BASE"
echo ""

# Test 1: Create a client
echo "Test 1: POST /clients"
echo "----------------------"
CLIENT_RESPONSE=$(curl -s -X POST "${API_BASE}/clients" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Waste Management Co",
    "description": "A test company for API validation"
  }')

echo "Response: $CLIENT_RESPONSE"
CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
    echo "❌ Failed to create client"
    exit 1
fi

echo "✅ Client created: $CLIENT_ID"
echo ""

# Test 2: Request presigned URLs
echo "Test 2: POST /upload"
echo "--------------------"
UPLOAD_RESPONSE=$(curl -s -X POST "${API_BASE}/upload" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"files\": [
      {\"name\": \"customers.csv\", \"type\": \"text/csv\"},
      {\"name\": \"report.pdf\", \"type\": \"application/pdf\"}
    ]
  }")

echo "Response (truncated):"
echo $UPLOAD_RESPONSE | head -c 200
echo "..."

URL_COUNT=$(echo $UPLOAD_RESPONSE | grep -o '"upload_urls"' | wc -l)

if [ "$URL_COUNT" -eq "0" ]; then
    echo "❌ Failed to get presigned URLs"
    exit 1
fi

echo "✅ Received presigned URLs"
echo ""

# Test 3: Upload a test file
echo "Test 3: Upload test file to S3"
echo "------------------------------"
PRESIGNED_URL=$(echo $UPLOAD_RESPONSE | grep -o 'https://[^"]*' | head -1)

echo "Test CSV content" > /tmp/test.csv
UPLOAD_STATUS=$(curl -s -w "%{http_code}" -X PUT "$PRESIGNED_URL" \
  -H "Content-Type: text/csv" \
  --data-binary @/tmp/test.csv \
  -o /dev/null)

if [ "$UPLOAD_STATUS" = "200" ]; then
    echo "✅ File uploaded successfully (HTTP $UPLOAD_STATUS)"
else
    echo "❌ Upload failed (HTTP $UPLOAD_STATUS)"
fi

rm /tmp/test.csv
echo ""

echo "✨ All tests completed!"
echo ""
echo "Client ID for further testing: $CLIENT_ID"
