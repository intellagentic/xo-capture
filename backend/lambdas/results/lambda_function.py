"""
XO Platform - GET /results/:id Lambda
Returns analysis results for a client.
Checks enrichment status in DB, then reads from S3.
"""

import json
import os
import boto3
from auth_helper import require_auth, get_db_connection, CORS_HEADERS, log_activity
try:
    from crypto_helper import unwrap_client_key, decrypt_s3_body
except ImportError:
    def unwrap_client_key(x): return None
    def decrypt_s3_body(k, b): return b if isinstance(b, str) else b.decode('utf-8', errors='replace') if b else ''

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data-mv')


def lambda_handler(event, context):
    """
    Get analysis results for a client.

    Path parameter: client_id (s3_folder)

    Returns analysis JSON or processing status.
    """

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Auth check
    user, err = require_auth(event)
    if err:
        log_activity(event, err)
        return err

    response = _handle_results(event, user)
    log_activity(event, response, user)
    return response


def _handle_results(event, user):
    try:
        path_params = event.get('pathParameters', {})
        client_id = path_params.get('id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        # Check enrichment status in DB
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT e.status, e.results_s3_key, e.stage, c.encryption_key
            FROM enrichments e
            JOIN clients c ON e.client_id = c.id
            WHERE c.s3_folder = %s AND c.user_id = %s
            ORDER BY e.started_at DESC
            LIMIT 1
        """, (client_id, user['user_id']))

        row = cur.fetchone()
        cur.close()
        conn.close()

        # Get client encryption key
        ck = unwrap_client_key(row[3]) if row and row[3] else None

        if row:
            enrichment_status, results_s3_key, enrichment_stage = row[0], row[1], row[2]

            if enrichment_status == 'processing':
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'status': 'processing',
                        'stage': enrichment_stage or 'extracting',
                        'message': 'Analysis in progress'
                    })
                }

            if enrichment_status == 'error':
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'status': 'error',
                        'message': 'Enrichment failed'
                    })
                }

            # Status is complete — read from S3
            s3_key = results_s3_key or f"{client_id}/results/analysis.json"
        else:
            # No enrichment record — fall back to direct S3 check
            s3_key = f"{client_id}/results/analysis.json"

        try:
            s3_response = s3_client.get_object(
                Bucket=BUCKET_NAME,
                Key=s3_key
            )
            raw = s3_response['Body'].read()
            decrypted = decrypt_s3_body(ck, raw)
            results = json.loads(decrypted)

            # Guarantee status field exists for frontend polling
            results['status'] = 'complete'

            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps(results)
            }

        except s3_client.exceptions.NoSuchKey:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'status': 'processing',
                    'message': 'Analysis in progress'
                })
            }

    except Exception as e:
        print(f"Error retrieving results: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
