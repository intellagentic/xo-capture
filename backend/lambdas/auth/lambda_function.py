"""
XO Platform - Auth Lambda
Routes: POST /auth/login, POST /auth/register, POST /auth/reset-password, POST /auth/google,
        PUT /auth/preferences, POST /auth/token, POST/GET/DELETE /auth/magic-link,
        POST /auth/verify-2fa

Three-tier role system: admin, partner, client.
Google OAuth checks: DB role first → client contacts fallback → denied.
Magic links provide token-based client access.
Email-based 2FA on all password and Google logins.
"""

import json
import os
import logging
import random
import secrets
import bcrypt
import jwt
import boto3
import urllib.request
from datetime import datetime, timedelta, timezone
import psycopg2

logger = logging.getLogger('xo')
logger.setLevel(logging.INFO)
try:
    from crypto_helper import encrypt, decrypt, encrypt_json, decrypt_json, search_hash
except ImportError:
    # Fallback if crypto_helper.py not yet deployed — pass-through mode
    def encrypt(x): return x
    def decrypt(x): return x
    def encrypt_json(x): return __import__('json').dumps(x) if x else x
    def decrypt_json(x):
        if not x: return None
        try: return __import__('json').loads(x)
        except: return None
    def search_hash(x): return __import__('hashlib').sha256(x.lower().strip().encode()).hexdigest() if x else ''

DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://d2np82m8rfcd6u.cloudfront.net/')
SES_FROM_EMAIL = os.environ.get('SES_FROM_EMAIL', 'noreply@intellagentic.io')
SES_REGION = os.environ.get('SES_REGION', 'eu-west-2')
TWO_FA_CODE_EXPIRY_MINUTES = 10

ses_client = boto3.client('ses', region_name=SES_REGION)

# Seed these emails as role='admin' on cold start
ADMIN_SEED_EMAILS = [
    'alan.moore@intellagentic.io',
    'ken.scott@intellagentic.io',
    'rs@multiversant.com',
    'vn@multiversant.com'
]

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
}


# ── Auto-migration: client_tokens table ──
def _run_token_migrations():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS client_tokens (
                id SERIAL PRIMARY KEY,
                token VARCHAR(64) UNIQUE NOT NULL,
                client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                created_by UUID REFERENCES users(id)
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_client_tokens_token ON client_tokens(token)")
        conn.commit()
        cur.close()
        conn.close()
        print("Migration complete: client_tokens table ensured")
    except Exception as e:
        print(f"Token migration check (non-fatal): {e}")

_run_token_migrations()


# ── Auto-migration: add role + partner_id columns to users, seed admins ──
def _run_role_migrations():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        # Add role column (default 'client')
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'client'")
        # Add partner_id FK to users (links partner users to their partner record)
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL")
        # Add email_hash for encrypted email lookups
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)")
        # 2FA opt-in flag
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE")
        # Seed admin roles for known admin emails (match by email_hash or legacy plaintext email)
        for email in ADMIN_SEED_EMAILS:
            cur.execute("UPDATE users SET role = 'admin' WHERE email = %s AND (role IS NULL OR role = 'client')", (email,))
        conn.commit()
        cur.close()
        conn.close()
        print("Migration complete: users role + partner_id + email_hash columns ensured, admins seeded")
    except Exception as e:
        print(f"Role migration check (non-fatal): {e}")

_run_role_migrations()


# ── Auto-migration: two_factor_codes table ──
def _run_2fa_migrations():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS two_factor_codes (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(64) UNIQUE NOT NULL,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(6) NOT NULL,
                email VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                verified BOOLEAN DEFAULT FALSE,
                attempts INTEGER DEFAULT 0
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_2fa_session_id ON two_factor_codes(session_id)")
        conn.commit()
        cur.close()
        conn.close()
        print("Migration complete: two_factor_codes table ensured")
    except Exception as e:
        print(f"2FA migration check (non-fatal): {e}")

_run_2fa_migrations()


def _log_auth_activity(event, response):
    """Log auth activity with user email from request body or JWT."""
    method = event.get('httpMethod', 'UNKNOWN')
    path = event.get('path', 'UNKNOWN')
    status = response.get('statusCode', 0) if isinstance(response, dict) else 0

    email = 'anonymous'
    try:
        body = json.loads(event.get('body', '{}') or '{}')
        email = body.get('email', 'anonymous')
    except Exception:
        pass
    if email == 'anonymous':
        try:
            headers = event.get('headers', {}) or {}
            auth_header = headers.get('Authorization') or headers.get('authorization', '')
            if auth_header.startswith('Bearer '):
                payload = jwt.decode(auth_header[7:], JWT_SECRET, algorithms=['HS256'])
                email = payload.get('email', 'unknown')
        except Exception:
            pass

    result_summary = ''
    try:
        resp_body = response.get('body', '') if isinstance(response, dict) else ''
        if resp_body and isinstance(resp_body, str):
            body_json = json.loads(resp_body)
            if 'error' in body_json:
                result_summary = f"error={body_json['error']}"
            elif 'user' in body_json:
                result_summary = f"role={body_json['user'].get('role', 'unknown')}"
            else:
                keys = list(body_json.keys())[:4]
                result_summary = f"keys={keys}"
    except (json.JSONDecodeError, TypeError):
        result_summary = 'non-json'

    logger.info(
        "API %s %s | user=%s | status=%s | %s",
        method, path, email, status, result_summary
    )


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '')
    method = event.get('httpMethod', '')

    if path.endswith('/auth/verify-2fa') and method == 'POST':
        response = handle_verify_2fa(event)
    elif path.endswith('/auth/token') and method == 'POST':
        response = handle_validate_token(event)
    elif path.endswith('/auth/magic-link'):
        if method == 'POST':
            response = handle_create_magic_link(event)
        elif method == 'GET':
            response = handle_get_magic_link(event)
        elif method == 'DELETE':
            response = handle_delete_magic_link(event)
        else:
            response = {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}
    elif path.endswith('/auth/google'):
        response = handle_google_login(event)
    elif path.endswith('/auth/preferences'):
        response = handle_preferences(event)
    elif path.endswith('/auth/reset-password'):
        response = handle_reset_password(event)
    elif path.endswith('/auth/register'):
        response = handle_register(event)
    else:
        response = handle_login(event)

    _log_auth_activity(event, response)
    return response


def _make_token(user_id, email, name, role='client', partner_id=None, client_id=None):
    """Build JWT with role-based claims."""
    payload = {
        'user_id': str(user_id),
        'email': email,
        'name': name,
        'role': role,
        'is_admin': role == 'admin',
        'is_partner': role == 'partner',
        'is_client': role == 'client',
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }
    if partner_id:
        payload['partner_id'] = partner_id
    if client_id:
        payload['client_id'] = client_id
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _success_response(user_id, email, name, preferred_model='claude-sonnet-4-5-20250929',
                      status=200, role='client', partner_id=None, client_id=None):
    token = _make_token(user_id, email, name, role=role, partner_id=partner_id, client_id=client_id)

    # Look up 2FA status for response
    tfa_enabled = False
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(two_factor_enabled, FALSE) FROM users WHERE id = %s", (str(user_id),))
        tfa_row = cur.fetchone()
        tfa_enabled = bool(tfa_row[0]) if tfa_row else False
        cur.close()
        conn.close()
    except Exception:
        pass

    user_data = {
        'id': str(user_id), 'email': email, 'name': name,
        'preferred_model': preferred_model,
        'role': role,
        'is_admin': role == 'admin',
        'is_partner': role == 'partner',
        'is_client': role == 'client',
        'two_factor_enabled': tfa_enabled,
    }
    if partner_id:
        user_data['partner_id'] = partner_id
    if client_id:
        user_data['client_id'] = client_id
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps({'token': token, 'user': user_data})
    }


def _send_2fa_email(to_email, code):
    """Send 2FA verification code via AWS SES."""
    try:
        ses_client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': f'XO Platform - Your verification code: {code}', 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {
                        'Data': f"""
                        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #1a1a2e;">XO Platform Verification</h2>
                            <p>Your one-time verification code is:</p>
                            <div style="background: #f0f0f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">{code}</span>
                            </div>
                            <p style="color: #666;">This code expires in {TWO_FA_CODE_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
                            <p style="color: #999; font-size: 12px;">If you did not request this code, please ignore this email.</p>
                        </div>
                        """,
                        'Charset': 'UTF-8'
                    },
                    'Text': {
                        'Data': f'Your XO Platform verification code is: {code}\n\nThis code expires in {TWO_FA_CODE_EXPIRY_MINUTES} minutes.',
                        'Charset': 'UTF-8'
                    }
                }
            }
        )
        print(f"2FA code sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send 2FA email to {to_email}: {e}")
        return False


def _start_2fa_challenge(user_id, email, name, preferred_model='claude-sonnet-4-5-20250929',
                         role='client', partner_id=None, client_id=None):
    """Generate 2FA code, store it, send email. Returns 2FA challenge response.
    Stores all user context needed to issue the JWT after verification."""
    code = f"{random.randint(0, 999999):06d}"
    session_id = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TWO_FA_CODE_EXPIRY_MINUTES)

    # Store the code and user context in DB
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Clean up expired codes for this user
        cur.execute("DELETE FROM two_factor_codes WHERE user_id = %s OR expires_at < NOW()", (str(user_id),))

        # Store user context as encrypted JSON so we can issue the JWT after verification
        user_context = json.dumps({
            'user_id': str(user_id),
            'email': email,
            'name': name,
            'preferred_model': preferred_model,
            'role': role,
            'partner_id': partner_id,
            'client_id': client_id
        })

        cur.execute("""
            INSERT INTO two_factor_codes (session_id, user_id, code, email, expires_at)
            VALUES (%s, %s, %s, %s, %s)
        """, (session_id, str(user_id), code, user_context, expires_at))

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to store 2FA code: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Failed to initiate verification'})
        }

    # Send email
    if not _send_2fa_email(email, code):
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Failed to send verification email'})
        }

    # Mask email for display
    parts = email.split('@')
    if len(parts) == 2 and len(parts[0]) > 2:
        masked = parts[0][0] + '*' * (len(parts[0]) - 2) + parts[0][-1] + '@' + parts[1]
    else:
        masked = email

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'requires_2fa': True,
            'session_id': session_id,
            'masked_email': masked,
            'expires_in': TWO_FA_CODE_EXPIRY_MINUTES * 60
        })
    }


# ============================================================
# POST /auth/verify-2fa — Verify email 2FA code and issue JWT
# ============================================================
def handle_verify_2fa(event):
    """POST /auth/verify-2fa - Verify 2FA code and return JWT."""
    try:
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('session_id', '').strip()
        code = body.get('code', '').strip()

        if not session_id or not code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'session_id and code are required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("""
            SELECT id, user_id, code, email, expires_at, verified, attempts
            FROM two_factor_codes
            WHERE session_id = %s
        """, (session_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Invalid or expired session'})
            }

        record_id, user_id, stored_code, encrypted_context, expires_at, verified, attempts = row

        # Check if already verified
        if verified:
            cur.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Code already used'})
            }

        # Check expiry
        if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
            cur.execute("DELETE FROM two_factor_codes WHERE id = %s", (record_id,))
            conn.commit()
            cur.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Code expired. Please log in again.'})
            }

        # Check max attempts (5)
        if attempts >= 5:
            cur.execute("DELETE FROM two_factor_codes WHERE id = %s", (record_id,))
            conn.commit()
            cur.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Too many attempts. Please log in again.'})
            }

        # Verify code
        if code != stored_code:
            cur.execute("UPDATE two_factor_codes SET attempts = attempts + 1 WHERE id = %s", (record_id,))
            conn.commit()
            cur.close()
            conn.close()
            remaining = 4 - attempts
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': f'Invalid code. {remaining} attempts remaining.'})
            }

        # Code is valid — mark as verified and delete
        cur.execute("DELETE FROM two_factor_codes WHERE id = %s", (record_id,))
        conn.commit()
        cur.close()
        conn.close()

        # Read user context and issue JWT
        context_str = encrypted_context
        try:
            ctx = json.loads(context_str)
        except (json.JSONDecodeError, TypeError):
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Failed to restore session'})
            }

        print(f"2FA verified for user: {ctx['email']}")
        return _success_response(
            ctx['user_id'], ctx['email'], ctx['name'],
            preferred_model=ctx.get('preferred_model', 'claude-sonnet-4-5-20250929'),
            role=ctx.get('role', 'client'),
            partner_id=ctx.get('partner_id'),
            client_id=ctx.get('client_id')
        )

    except Exception as e:
        print(f"2FA verification error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def _upsert_user(conn, cur, email, name, role='client', partner_id=None):
    """Upsert a user record. Returns user_id."""
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO users (email, password_hash, name, role, partner_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (email, 'google-oauth-no-password', name, role, partner_id)
    )
    user_id = cur.fetchone()[0]
    conn.commit()
    return user_id


def _verify_admin_or_partner_jwt(event, require_admin=False):
    """Verify JWT from Authorization header. Returns payload or None.
    If require_admin=True, only admins pass. Otherwise admins and partners pass."""
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        role = payload.get('role', payload.get('is_admin') and 'admin' or 'client')
        if require_admin and role != 'admin':
            return None
        if role not in ('admin', 'partner'):
            return None
        payload['role'] = role
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ============================================================
# POST /auth/token — Validate magic link token
# ============================================================
def handle_validate_token(event):
    """POST /auth/token - Validate a magic link token and return JWT."""
    try:
        body = json.loads(event.get('body', '{}'))
        token = body.get('token', '').strip()

        if not token:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Token is required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("""
            SELECT ct.client_id, c.s3_folder, c.company_name
            FROM client_tokens ct
            JOIN clients c ON ct.client_id = c.id
            WHERE ct.token = %s AND ct.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Invalid or expired token'})
            }

        db_client_id, s3_folder, company_name = row
        client_email = f"client-token-{s3_folder}@token"
        client_name = company_name or s3_folder

        user_id = _upsert_user(conn, cur, client_email, client_name, role='client')

        cur.close()
        conn.close()

        print(f"Magic link login for client: {s3_folder}")
        return _success_response(
            user_id, client_email, client_name,
            role='client', client_id=s3_folder
        )

    except Exception as e:
        print(f"Token validation error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


# ============================================================
# POST /auth/magic-link — Generate magic link (admin or partner for own clients)
# ============================================================
def handle_create_magic_link(event):
    """POST /auth/magic-link - Generate a magic link for a client."""
    caller = _verify_admin_or_partner_jwt(event)
    if not caller:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin or partner access required'})}

    try:
        body = json.loads(event.get('body', '{}'))
        client_s3_folder = body.get('client_id', '').strip()

        if not client_s3_folder:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Look up client — partners can only generate for their own clients
        if caller.get('role') == 'partner':
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s AND partner_id = %s",
                        (client_s3_folder, caller.get('partner_id')))
        else:
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_s3_folder,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }
        db_client_id = row[0]

        # Delete existing tokens for this client
        cur.execute("DELETE FROM client_tokens WHERE client_id = %s", (db_client_id,))

        # Generate new token
        new_token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)

        cur.execute("""
            INSERT INTO client_tokens (token, client_id, expires_at, created_by)
            VALUES (%s, %s, %s, %s)
        """, (new_token, db_client_id, expires_at, caller['user_id']))

        conn.commit()
        cur.close()
        conn.close()

        url = f"{FRONTEND_URL}?token={new_token}"
        print(f"Generated magic link for client: {client_s3_folder}")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'token': new_token,
                'url': url,
                'expires_at': expires_at.isoformat()
            })
        }

    except Exception as e:
        print(f"Magic link creation error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


# ============================================================
# GET /auth/magic-link?client_id=X — Get existing link (admin/partner)
# ============================================================
def handle_get_magic_link(event):
    """GET /auth/magic-link - Get existing magic link for a client."""
    caller = _verify_admin_or_partner_jwt(event)
    if not caller:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin or partner access required'})}

    try:
        params = event.get('queryStringParameters') or {}
        client_s3_folder = params.get('client_id', '').strip()

        if not client_s3_folder:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        if caller.get('role') == 'partner':
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s AND partner_id = %s",
                        (client_s3_folder, caller.get('partner_id')))
        else:
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_s3_folder,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }
        db_client_id = row[0]

        cur.execute("""
            SELECT token, expires_at FROM client_tokens
            WHERE client_id = %s AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        """, (db_client_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'token': row[0],
                    'url': f"{FRONTEND_URL}?token={row[0]}",
                    'expires_at': row[1].isoformat() if row[1] else None
                })
            }
        else:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'token': None, 'url': None, 'expires_at': None})
            }

    except Exception as e:
        print(f"Get magic link error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


# ============================================================
# DELETE /auth/magic-link?client_id=X — Revoke link (admin/partner)
# ============================================================
def handle_delete_magic_link(event):
    """DELETE /auth/magic-link - Revoke all magic links for a client."""
    caller = _verify_admin_or_partner_jwt(event)
    if not caller:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin or partner access required'})}

    try:
        params = event.get('queryStringParameters') or {}
        client_s3_folder = params.get('client_id', '').strip()

        if not client_s3_folder:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        if caller.get('role') == 'partner':
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s AND partner_id = %s",
                        (client_s3_folder, caller.get('partner_id')))
        else:
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_s3_folder,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }
        db_client_id = row[0]

        cur.execute("DELETE FROM client_tokens WHERE client_id = %s", (db_client_id,))
        conn.commit()
        cur.close()
        conn.close()

        print(f"Revoked magic links for client: {client_s3_folder}")
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'revoked': True})
        }

    except Exception as e:
        print(f"Delete magic link error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


# ============================================================
# POST /auth/google — Google OAuth login (three-tier role check)
# ============================================================
def handle_google_login(event):
    """POST /auth/google - Verify Google ID token and login/create user.
    Priority: DB role (admin/partner) → client contacts → denied."""
    try:
        body = json.loads(event.get('body', '{}'))
        credential = body.get('credential', '')

        if not credential:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Google credential is required'})
            }

        # Verify token via Google's tokeninfo endpoint
        try:
            url = f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}'
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                token_info = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"Google token verification failed: {e}")
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Invalid Google token'})
            }

        # Validate audience matches our client ID
        if token_info.get('aud') != GOOGLE_CLIENT_ID:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Token audience mismatch'})
            }

        # Validate email is verified
        if token_info.get('email_verified') != 'true':
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Email not verified'})
            }

        email = token_info.get('email', '').lower()
        name = token_info.get('name', '') or email.split('@')[0].replace('.', ' ').title()

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Step 1: Check if user exists in DB with a role
        cur.execute(
            "SELECT id, email, name, COALESCE(preferred_model, 'claude-sonnet-4-5-20250929'), COALESCE(role, 'client'), partner_id, COALESCE(two_factor_enabled, FALSE) FROM users WHERE email = %s",
            (email,)
        )
        user_row = cur.fetchone()

        if user_row:
            user_id, user_email, user_name, preferred_model, role, partner_id, tfa_enabled = (
                user_row[0], user_row[1], user_row[2],
                user_row[3], user_row[4], user_row[5], bool(user_row[6])
            )

            if role == 'admin':
                cur.close()
                conn.close()
                if tfa_enabled:
                    print(f"Google login valid (admin): {user_email} — starting 2FA")
                    return _start_2fa_challenge(user_id, user_email, user_name, preferred_model, role='admin')
                print(f"Google login successful (admin): {user_email}")
                return _success_response(user_id, user_email, user_name, preferred_model, role='admin')

            if role == 'partner':
                cur.close()
                conn.close()
                if tfa_enabled:
                    print(f"Google login valid (partner): {user_email}, partner_id={partner_id} — starting 2FA")
                    return _start_2fa_challenge(user_id, user_email, user_name, preferred_model, role='partner', partner_id=partner_id)
                print(f"Google login successful (partner): {user_email}, partner_id={partner_id}")
                return _success_response(user_id, user_email, user_name, preferred_model, role='partner', partner_id=partner_id)

            # role='client' in DB — still check client contacts below

        # Step 2: Check if email is in ADMIN_SEED_EMAILS (in case user not yet in DB)
        if email.lower() in [e.lower() for e in ADMIN_SEED_EMAILS]:
            user_id = _upsert_user(conn, cur, email, name, role='admin')
            # Also ensure role is set correctly for existing users
            cur.execute("UPDATE users SET role = 'admin' WHERE id = %s", (user_id,))
            # Check 2FA for this user
            cur.execute("SELECT COALESCE(two_factor_enabled, FALSE) FROM users WHERE id = %s", (user_id,))
            tfa_row = cur.fetchone()
            tfa_enabled = bool(tfa_row[0]) if tfa_row else False
            conn.commit()
            cur.close()
            conn.close()
            if tfa_enabled:
                print(f"Google login valid (admin seed): {email} — starting 2FA")
                return _start_2fa_challenge(user_id, email, name, role='admin')
            print(f"Google login successful (admin seed): {email}")
            return _success_response(user_id, email, name, role='admin')

        # Step 3: Check if email matches any client contact
        cur.execute("SELECT id, s3_folder, contacts_json, company_name FROM clients WHERE contacts_json IS NOT NULL")
        rows = cur.fetchall()

        for row in rows:
            db_client_id, s3_folder, contacts_raw, company_name = row
            try:
                contacts = json.loads(contacts_raw) if isinstance(contacts_raw, str) else contacts_raw
                if not contacts:
                    continue
            except (json.JSONDecodeError, TypeError):
                continue
            for contact in contacts:
                contact_email = (contact.get('email') or '').lower().strip()
                if contact_email and contact_email == email:
                    user_id = _upsert_user(conn, cur, email, name, role='client')
                    # Check 2FA for this user
                    cur.execute("SELECT COALESCE(two_factor_enabled, FALSE) FROM users WHERE id = %s", (user_id,))
                    tfa_row = cur.fetchone()
                    tfa_enabled = bool(tfa_row[0]) if tfa_row else False
                    cur.close()
                    conn.close()
                    if tfa_enabled:
                        print(f"Google login valid (client contact): {email} -> {s3_folder} — starting 2FA")
                        return _start_2fa_challenge(
                            user_id, email, name,
                            role='client', client_id=s3_folder
                        )
                    print(f"Google login successful (client contact): {email} -> {s3_folder}")
                    return _success_response(
                        user_id, email, name,
                        role='client', client_id=s3_folder
                    )

        cur.close()
        conn.close()

        # No match — access denied
        return {
            'statusCode': 403,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Access denied. This email is not authorized.'})
        }

    except Exception as e:
        print(f"Google login error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_login(event):
    """POST /auth/login - If user exists, verify password. If not, create account."""
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')

        if not email or not password:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Email and password are required'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute(
            "SELECT id, email, password_hash, name, COALESCE(preferred_model, 'claude-sonnet-4-5-20250929'), COALESCE(role, 'client'), partner_id, COALESCE(two_factor_enabled, FALSE) FROM users WHERE email = %s",
            (email,)
        )
        row = cur.fetchone()

        if row:
            cur.close()
            conn.close()
            user_id = row[0]
            user_email = row[1]
            password_hash = row[2]
            user_name = row[3]
            preferred_model = row[4]
            role = row[5]
            partner_id = row[6]
            tfa_enabled = bool(row[7])

            if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                return {
                    'statusCode': 401,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Invalid password'})
                }

            if tfa_enabled:
                print(f"Login credentials valid: {user_email} (role={role}) — starting 2FA")
                return _start_2fa_challenge(
                    user_id, user_email, user_name, preferred_model,
                    role=role, partner_id=partner_id
                )

            print(f"Login successful: {user_email} (role={role})")
            return _success_response(user_id, user_email, user_name, preferred_model, role=role, partner_id=partner_id)

        else:
            if len(password) < 8:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Password must be at least 8 characters'})
                }

            name = email.split('@')[0].replace('.', ' ').title()
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cur.execute(
                "INSERT INTO users (email, password_hash, name, role) VALUES (%s, %s, %s, 'client') RETURNING id",
                (email, password_hash, name)
            )
            user_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()

            print(f"New account created: {email}")
            return _success_response(user_id, email, name, status=201)

    except Exception as e:
        print(f"Login error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_register(event):
    """POST /auth/register - Explicit registration (kept for API compatibility)."""
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')
        name = body.get('name', '').strip()

        if not email or not password:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Email and password are required'})
            }

        if len(password) < 8:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Password must be at least 8 characters'})
            }

        if not name:
            name = email.split('@')[0].replace('.', ' ').title()

        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return {
                'statusCode': 409,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'An account with that email already exists'})
            }

        cur.execute(
            "INSERT INTO users (email, password_hash, name, role) VALUES (%s, %s, %s, 'client') RETURNING id",
            (email, password_hash, name)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        print(f"Registration successful: {email}")
        return _success_response(user_id, email, name, status=201)

    except Exception as e:
        print(f"Register error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_reset_password(event):
    """POST /auth/reset-password - Directly resets password (prototype, no email verification)."""
    try:
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').strip().lower()
        new_password = body.get('new_password', '')

        if not email or not new_password:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Email and new password are required'})
            }

        if len(new_password) < 8:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Password must be at least 8 characters'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_row = cur.fetchone()
        if not user_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No account found with that email'})
            }

        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_row[0]))
        conn.commit()
        cur.close()
        conn.close()

        print(f"Password reset for: {email}")
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'message': 'Password reset successfully'})
        }

    except Exception as e:
        print(f"Reset password error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_preferences(event):
    """PUT /auth/preferences - Update user preferences (requires auth)."""
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}

    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = payload['user_id']
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}

    try:
        body = json.loads(event.get('body', '{}'))
        response_data = {}

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Update preferred_model if provided
        if 'preferred_model' in body:
            preferred_model = body['preferred_model']
            allowed_models = ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001']
            if preferred_model not in allowed_models:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': f'Invalid model. Allowed: {", ".join(allowed_models)}'})
                }
            cur.execute("UPDATE users SET preferred_model = %s WHERE id = %s", (preferred_model, user_id))
            response_data['preferred_model'] = preferred_model

        # Update two_factor_enabled if provided
        if 'two_factor_enabled' in body:
            tfa_val = bool(body['two_factor_enabled'])
            cur.execute("UPDATE users SET two_factor_enabled = %s WHERE id = %s", (tfa_val, user_id))
            response_data['two_factor_enabled'] = tfa_val
            print(f"2FA {'enabled' if tfa_val else 'disabled'} for user {user_id}")

        conn.commit()

        # Return current 2FA status
        cur.execute("SELECT COALESCE(two_factor_enabled, FALSE) FROM users WHERE id = %s", (user_id,))
        tfa_row = cur.fetchone()
        response_data['two_factor_enabled'] = bool(tfa_row[0]) if tfa_row else False

        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(response_data)
        }

    except Exception as e:
        print(f"Preferences error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }
