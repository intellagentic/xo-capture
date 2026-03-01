"""
XO Platform - GET /results/:id Lambda
Returns analysis results for a client
"""

import json
import os
import boto3

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')

def lambda_handler(event, context):
    """
    Get analysis results for a client

    Path parameter: client_id

    Returns:
    {
        "status": "complete",
        "summary": "...",
        "problems": [...],
        "schema": {...},
        "plan": [...],
        "sources": [...]
    }
    """

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Get client_id from path parameter
        path_params = event.get('pathParameters', {})
        client_id = path_params.get('id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'client_id is required'})
            }

        # Check if results exist
        results_key = f"{client_id}/results/analysis.json"

        try:
            response = s3_client.get_object(
                Bucket=BUCKET_NAME,
                Key=results_key
            )
            results = json.loads(response['Body'].read().decode('utf-8'))

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(results)
            }

        except s3_client.exceptions.NoSuchKey:
            # Results not ready yet
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'processing',
                    'message': 'Analysis in progress'
                })
            }

    except Exception as e:
        print(f"Error retrieving results: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
