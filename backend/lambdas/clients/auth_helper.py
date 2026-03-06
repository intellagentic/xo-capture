"""
XO Platform - Shared Auth Helper
JWT verification and database connection for all Lambdas.
Copy this file into each Lambda's deploy package.
"""

import os
import json
import jwt
import psycopg2

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
            'is_partner': payload.get('is_partner', False),
            'is_client': payload.get('is_client', False),
            'partner_id': payload.get('partner_id', None),
            'client_id': payload.get('client_id', None)
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
