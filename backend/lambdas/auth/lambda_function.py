"""
XO Platform - Auth Lambda
Routes: POST /auth/login, POST /auth/register, POST /auth/reset-password, POST /auth/google,
        PUT /auth/preferences, POST /auth/token, POST/GET/DELETE /auth/magic-link

Login auto-creates accounts: if the email doesn't exist, a new user is created.
Google OAuth login restricted to allowed admin emails + client contact emails.
Magic links provide token-based client access.
"""

import json
import os
import secrets
import bcrypt
import jwt
import urllib.request
from datetime import datetime, timedelta, timezone
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', '')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://d36la414u58rw5.cloudfront.net')

ALLOWED_EMAILS = [
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


# ── Auto-migration: create client_tokens table ──
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


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '')
    method = event.get('httpMethod', '')

    if path.endswith('/auth/token') and method == 'POST':
        return handle_validate_token(event)
    elif path.endswith('/auth/magic-link'):
        if method == 'POST':
            return handle_create_magic_link(event)
        elif method == 'GET':
            return handle_get_magic_link(event)
        elif method == 'DELETE':
            return handle_delete_magic_link(event)
    elif path.endswith('/auth/google'):
        return handle_google_login(event)
    elif path.endswith('/auth/preferences'):
        return handle_preferences(event)
    elif path.endswith('/auth/reset-password'):
        return handle_reset_password(event)
    elif path.endswith('/auth/register'):
        return handle_register(event)
    else:
        return handle_login(event)


def _make_token(user_id, email, name, is_admin=False, is_client=False, client_id=None):
    payload = {
        'user_id': str(user_id),
        'email': email,
        'name': name,
        'is_admin': is_admin,
        'is_client': is_client,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }
    if client_id:
        payload['client_id'] = client_id
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _success_response(user_id, email, name, preferred_model='claude-sonnet-4-5-20250929', status=200, is_admin=False, is_client=False, client_id=None):
    token = _make_token(user_id, email, name, is_admin=is_admin, is_client=is_client, client_id=client_id)
    user_data = {
        'id': str(user_id), 'email': email, 'name': name,
        'preferred_model': preferred_model, 'is_admin': is_admin,
        'is_client': is_client
    }
    if client_id:
        user_data['client_id'] = client_id
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps({'token': token, 'user': user_data})
    }


def _upsert_client_user(conn, cur, email, name):
    """Upsert a user record for a client login. Returns user_id."""
    cur.execute(
        "SELECT id FROM users WHERE email = %s", (email,)
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
        (email, 'client-token-no-password', name)
    )
    user_id = cur.fetchone()[0]
    conn.commit()
    return user_id


def _verify_admin_jwt(event):
    """Verify JWT from Authorization header and ensure is_admin. Returns payload or None."""
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if not payload.get('is_admin'):
            return None
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

        user_id = _upsert_client_user(conn, cur, client_email, client_name)

        cur.close()
        conn.close()

        print(f"Magic link login for client: {s3_folder}")
        return _success_response(
            user_id, client_email, client_name,
            is_client=True, client_id=s3_folder
        )

    except Exception as e:
        print(f"Token validation error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


# ============================================================
# POST /auth/magic-link — Generate magic link (admin only)
# ============================================================
def handle_create_magic_link(event):
    """POST /auth/magic-link - Generate a magic link for a client."""
    admin = _verify_admin_jwt(event)
    if not admin:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}

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

        # Look up client DB id from s3_folder
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
        """, (new_token, db_client_id, expires_at, admin['user_id']))

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
# GET /auth/magic-link?client_id=X — Get existing link (admin only)
# ============================================================
def handle_get_magic_link(event):
    """GET /auth/magic-link - Get existing magic link for a client."""
    admin = _verify_admin_jwt(event)
    if not admin:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}

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
# DELETE /auth/magic-link?client_id=X — Revoke link (admin only)
# ============================================================
def handle_delete_magic_link(event):
    """DELETE /auth/magic-link - Revoke all magic links for a client."""
    admin = _verify_admin_jwt(event)
    if not admin:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}

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
# POST /auth/google — Google OAuth login (admin + client contacts)
# ============================================================
def handle_google_login(event):
    """POST /auth/google - Verify Google ID token and login/create user."""
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

        # Check admin allowed list first
        if email in ALLOWED_EMAILS:
            # Upsert admin user in database
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()

            cur.execute(
                "SELECT id, email, name, COALESCE(preferred_model, 'claude-sonnet-4-5-20250929') FROM users WHERE email = %s",
                (email,)
            )
            row = cur.fetchone()

            if row:
                user_id, user_email, user_name, preferred_model = row
                cur.close()
                conn.close()
                print(f"Google login successful (admin): {user_email}")
                return _success_response(user_id, user_email, user_name, preferred_model, is_admin=True)
            else:
                cur.execute(
                    "INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
                    (email, 'google-oauth-no-password', name)
                )
                user_id = cur.fetchone()[0]
                conn.commit()
                cur.close()
                conn.close()
                print(f"New Google OAuth admin account created: {email}")
                return _success_response(user_id, email, name, status=201, is_admin=True)

        # Not an admin — check if email matches any client contact
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT id, s3_folder, contacts_json, company_name FROM clients WHERE contacts_json IS NOT NULL")
        rows = cur.fetchall()

        for row in rows:
            db_client_id, s3_folder, contacts_raw, company_name = row
            try:
                contacts = json.loads(contacts_raw)
            except (json.JSONDecodeError, TypeError):
                continue
            for contact in contacts:
                contact_email = (contact.get('email') or '').lower().strip()
                if contact_email and contact_email == email:
                    # Match found — upsert user and return client JWT
                    user_id = _upsert_client_user(conn, cur, email, name)
                    cur.close()
                    conn.close()
                    print(f"Google login successful (client contact): {email} -> {s3_folder}")
                    return _success_response(
                        user_id, email, name,
                        is_client=True, client_id=s3_folder
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
            "SELECT id, email, password_hash, name, COALESCE(preferred_model, 'claude-sonnet-4-5-20250929') FROM users WHERE email = %s",
            (email,)
        )
        row = cur.fetchone()

        if row:
            # Existing user — verify password
            cur.close()
            conn.close()
            user_id, user_email, password_hash, user_name, preferred_model = row

            if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                return {
                    'statusCode': 401,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Invalid password'})
                }

            print(f"Login successful: {user_email}")
            return _success_response(user_id, user_email, user_name, preferred_model)

        else:
            # New user — create account
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
                "INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
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
            "INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
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
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No account found with that email'})
            }

        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, email))
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
    # Verify JWT
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
        preferred_model = body.get('preferred_model', '')

        allowed_models = ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001']
        if preferred_model not in allowed_models:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': f'Invalid model. Allowed: {", ".join(allowed_models)}'})
            }

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("UPDATE users SET preferred_model = %s WHERE id = %s", (preferred_model, user_id))
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'preferred_model': preferred_model})
        }

    except Exception as e:
        print(f"Preferences error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }
