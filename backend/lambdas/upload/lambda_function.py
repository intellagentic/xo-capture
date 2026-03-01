"""
XO Platform - POST /upload Lambda
Generates presigned URLs for direct S3 uploads
"""

import json
import os
import boto3
from datetime import datetime

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')
URL_EXPIRATION = 3600  # 1 hour

def lambda_handler(event, context):
    """
    Generate presigned URLs for file uploads

    Expected input:
    {
        "client_id": "client_1234567890_abcd",
        "files": [
            {"name": "data.csv", "type": "text/csv"},
            {"name": "report.pdf", "type": "application/pdf"}
        ]
    }

    Returns:
    {
        "upload_urls": [
            "https://xo-client-data.s3.amazonaws.com/...",
            "https://xo-client-data.s3.amazonaws.com/..."
        ]
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
        client_id = body.get('client_id', '').strip()
        files = body.get('files', [])

        # Validate required fields
        if not client_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'client_id is required'
                })
            }

        if not files or not isinstance(files, list):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'files array is required'
                })
            }

        # Verify client exists (check for metadata.json)
        try:
            s3_client.head_object(
                Bucket=BUCKET_NAME,
                Key=f"{client_id}/metadata.json"
            )
        except:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Client not found'
                })
            }

        # Generate presigned URLs for each file
        upload_urls = []
        for file_info in files:
            file_name = file_info.get('name', '')
            file_type = file_info.get('type', 'application/octet-stream')

            if not file_name:
                continue

            # S3 key in uploads folder
            s3_key = f"{client_id}/uploads/{file_name}"

            # Generate presigned URL for PUT
            presigned_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': s3_key,
                    'ContentType': file_type
                },
                ExpiresIn=URL_EXPIRATION
            )

            upload_urls.append(presigned_url)

        print(f"Generated {len(upload_urls)} presigned URLs for client: {client_id}")

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'upload_urls': upload_urls
            })
        }

    except Exception as e:
        print(f"Error generating presigned URLs: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
