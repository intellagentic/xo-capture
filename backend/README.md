# XO Platform Backend

AWS serverless backend for domain partner onboarding.

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  API Gateway    │
│  (REST API)     │
└────────┬────────┘
         │
         ├──► POST /clients  ──► Lambda: xo-clients  ──► S3: Create folders
         │
         ├──► POST /upload   ──► Lambda: xo-upload   ──► S3: Presigned URLs
         │
         ├──► POST /enrich   ──► Lambda: xo-enrich   ──► Claude API + S3
         │
         └──► GET /results/:id ─► Lambda: xo-results ──► S3: Read results
```

## Infrastructure

- **S3 Bucket**: `xo-client-data` (us-west-1)
  - Folder structure per client:
    - `{client_id}/uploads/` - Original files
    - `{client_id}/extracted/` - Extracted text
    - `{client_id}/results/` - Analysis results
    - `{client_id}/metadata.json` - Client info

- **Lambdas**:
  - `xo-clients` - Create new client ✅
  - `xo-upload` - Generate presigned URLs ✅
  - `xo-enrich` - AI enrichment pipeline ✅
  - `xo-results` - Return analysis results ✅

- **API Gateway**: REST API with CORS enabled

## Deployment

### One-Time Setup

1. **Create S3 bucket and IAM role** (see DEPLOY.md):
   ```bash
   aws s3 mb s3://xo-client-data --region us-west-1
   # Follow DEPLOY.md for IAM role creation
   ```

2. **Set your AWS Account ID**:
   ```bash
   export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   ```

### Deploy Lambdas

```bash
cd backend
./deploy.sh
```

This deploys:
- ✅ `xo-clients` Lambda
- ✅ `xo-upload` Lambda

### Create API Gateway

Follow the API Gateway setup in `DEPLOY.md`, or use the AWS Console:

1. Create REST API named `xo-api`
2. Create resources: `/clients`, `/upload`
3. Add POST methods with Lambda proxy integration
4. Enable CORS on all methods
5. Deploy to stage `prod`
6. Note your API endpoint URL

### Set Anthropic API Key

```bash
./set-api-key.sh YOUR_ANTHROPIC_API_KEY
```

Get your API key from: https://console.anthropic.com/settings/keys

### Update Frontend

The frontend is already configured with:

```javascript
const API_BASE = 'https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod'
```

## Testing

```bash
# Test the API endpoints
./test-api.sh https://YOUR_API_ID.execute-api.us-west-1.amazonaws.com/prod
```

## API Endpoints

### POST /clients

Create a new client and S3 folder structure.

**Request:**
```json
{
  "company_name": "Acme Waste Management",
  "description": "Regional waste collection service"
}
```

**Response:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "status": "created"
}
```

### POST /upload

Get presigned URLs for direct S3 uploads.

**Request:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "files": [
    {"name": "customers.csv", "type": "text/csv"},
    {"name": "recording.mp3", "type": "audio/mpeg"}
  ]
}
```

**Response:**
```json
{
  "upload_urls": [
    "https://xo-client-data.s3.amazonaws.com/...",
    "https://xo-client-data.s3.amazonaws.com/..."
  ]
}
```

## Lambda Functions

### xo-clients

**File**: `lambdas/clients/lambda_function.py`
- Creates client folder structure in S3
- Generates unique client_id using timestamp + hash
- Stores metadata.json in S3

### xo-upload

**File**: `lambdas/upload/lambda_function.py`
- Validates client_id exists
- Generates presigned PUT URLs (1 hour expiry)
- Supports all file types (CSV, PDF, Excel, Audio)

### POST /enrich

Trigger AI analysis of uploaded documents.

**Request:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4"
}
```

**Response:**
```json
{
  "job_id": "client_1709251234_a1b2c3d4",
  "status": "complete"
}
```

### GET /results/:id

Get analysis results for a client.

**Path:** `/results/client_1709251234_a1b2c3d4`

**Response:**
```json
{
  "status": "complete",
  "summary": "Executive summary...",
  "problems": [
    {
      "title": "Route Optimization Inefficiency",
      "severity": "high",
      "evidence": "Evidence from data...",
      "recommendation": "Implement route optimization..."
    }
  ],
  "schema": {
    "tables": [
      {
        "name": "customers",
        "purpose": "Commercial client master data",
        "columns": [...]
      }
    ]
  },
  "plan": [
    {
      "phase": "30-day",
      "actions": ["action 1", "action 2"]
    }
  ],
  "sources": [...]
}
```

## TODO

### Enhancements (Future)

- [ ] Audio transcription integration (Whisper API)
- [ ] Web enrichment logic (company research)
- [ ] Async job processing with SQS
- [ ] Progress tracking in DynamoDB
- [ ] Email notifications on completion

## File Structure

```
backend/
├── README.md           # This file
├── DEPLOY.md          # Detailed deployment guide
├── deploy.sh          # Quick deploy script
├── test-api.sh        # API testing script
└── lambdas/
    ├── clients/
    │   └── lambda_function.py
    ├── upload/
    │   └── lambda_function.py
    ├── enrich/        # TODO
    └── results/       # TODO
```

## Environment Variables

All Lambdas use:
- `BUCKET_NAME` - S3 bucket name (default: `xo-client-data`)

Future Lambdas will need:
- `ANTHROPIC_API_KEY` - For Claude API calls
- `OPENAI_API_KEY` - For Whisper transcription (optional)

## Costs

Estimated monthly costs (assuming 100 clients/month):

- S3 Storage: ~$5/month (5GB average)
- Lambda invocations: ~$2/month
- API Gateway: ~$3.50/month
- Claude API: Variable ($10-50 depending on usage)

**Total**: ~$20-60/month for prototype usage
