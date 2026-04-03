"""
XO Platform - Shared Auth Helper
JWT verification and database connection for all Lambdas.
Copy this file into each Lambda's deploy package.
"""

import os
import json
import logging
import jwt
import psycopg2

logger = logging.getLogger('xo')
logger.setLevel(logging.INFO)

JWT_SECRET = os.environ.get('JWT_SECRET', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}


def get_db_connection():
    """Create and return a psycopg2 database connection."""
    return psycopg2.connect(DATABASE_URL)


def verify_token(event):
    """
    Extract and verify JWT Bearer token from Authorization header.
    Returns decoded user dict on success, None on failure.
    """
    headers = event.get('headers', {}) or {}

    # API Gateway may lowercase header names
    auth_header = headers.get('Authorization') or headers.get('authorization', '')

    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header[7:]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return {
            'user_id': payload['user_id'],
            'email': payload['email'],
            'name': payload.get('name', ''),
            'role': payload.get('role', 'client'),
            'is_admin': payload.get('is_admin', False),
            'is_account': payload.get('is_account', False),
            'is_client': payload.get('is_client', False),
            'client_id': payload.get('client_id', None),
            'account_role': payload.get('account_role', None),
            'account_id': payload.get('account_id', None),
        }
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(event):
    """
    Verify auth and return (user, error_response) tuple.
    If auth succeeds: (user_dict, None)
    If auth fails: (None, error_response_dict)
    """
    user = verify_token(event)

    if user is None:
        error_response = {
            'statusCode': 401,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Unauthorized'})
        }
        return None, error_response

    return user, None


def log_activity(event, response, user=None):
    """Log API activity: user, path, method, status code, result summary.
    Call this at the end of lambda_handler before returning."""
    method = event.get('httpMethod', 'UNKNOWN')
    path = event.get('path', event.get('resource', 'UNKNOWN'))
    status = response.get('statusCode', 0) if isinstance(response, dict) else 0

    # Extract user email
    email = 'anonymous'
    if user:
        email = user.get('email', 'unknown')
    else:
        # Try to extract from auth header without failing
        try:
            headers = event.get('headers', {}) or {}
            auth_header = headers.get('Authorization') or headers.get('authorization', '')
            if auth_header.startswith('Bearer '):
                payload = jwt.decode(auth_header[7:], JWT_SECRET, algorithms=['HS256'])
                email = payload.get('email', 'unknown')
        except Exception:
            pass

    # Extract result summary from body
    result_summary = ''
    try:
        body = response.get('body', '') if isinstance(response, dict) else ''
        if body and isinstance(body, str):
            body_json = json.loads(body)
            if 'error' in body_json:
                result_summary = f"error={body_json['error']}"
            elif 'status' in body_json:
                result_summary = f"status={body_json['status']}"
            else:
                # Summarize top-level keys
                keys = list(body_json.keys())[:4]
                result_summary = f"keys={keys}"
    except (json.JSONDecodeError, TypeError):
        result_summary = 'non-json'

    logger.info(
        "API %s %s | user=%s | status=%s | %s",
        method, path, email, status, result_summary
    )
