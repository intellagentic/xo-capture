"""
XO Platform - POST /clients Lambda
Creates a new client folder structure in S3 and returns client_id
"""

import json
import os
import time
import hashlib
import boto3
from datetime import datetime

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')

def lambda_handler(event, context):
    """
    Create a new client entry with S3 folder structure

    Expected input:
    {
        "company_name": "Company Name",
        "website": "https://example.com",
        "contactName": "John Doe",
        "contactTitle": "CEO",
        "contactLinkedIn": "https://linkedin.com/in/...",
        "industry": "Waste Management",
        "description": "Optional description"
    }

    Returns:
    {
        "client_id": "client_1234567890_abcd",
        "status": "created"
    }
    """

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        company_name = body.get('company_name', '').strip()
        website = body.get('website', '').strip()
        contact_name = body.get('contactName', '').strip()
        contact_title = body.get('contactTitle', '').strip()
        contact_linkedin = body.get('contactLinkedIn', '').strip()
        industry = body.get('industry', '').strip()
        description = body.get('description', '').strip()

        # Validate required fields
        if not company_name:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'company_name is required'
                })
            }

        # Generate unique client_id
        timestamp = str(int(time.time()))
        name_hash = hashlib.md5(company_name.encode()).hexdigest()[:8]
        client_id = f"client_{timestamp}_{name_hash}"

        # Create folder structure in S3
        folders = [
            f"{client_id}/uploads/",
            f"{client_id}/extracted/",
            f"{client_id}/results/"
        ]

        for folder in folders:
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=folder,
                Body=''
            )

        # Store metadata in S3 (using JSON file instead of DynamoDB for simplicity)
        metadata = {
            'client_id': client_id,
            'company_name': company_name,
            'website': website,
            'contact_name': contact_name,
            'contact_title': contact_title,
            'contact_linkedin': contact_linkedin,
            'industry': industry,
            'description': description,
            'created_at': datetime.utcnow().isoformat(),
            'status': 'active'
        }

        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=f"{client_id}/metadata.json",
            Body=json.dumps(metadata, indent=2),
            ContentType='application/json'
        )

        print(f"Created client: {client_id} for company: {company_name}")

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'client_id': client_id,
                'status': 'created'
            })
        }

    except Exception as e:
        print(f"Error creating client: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
