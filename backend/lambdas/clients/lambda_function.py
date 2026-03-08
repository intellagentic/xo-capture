"""
XO Platform - POST /clients Lambda
Creates a new client with S3 folder structure and PostgreSQL record.
"""

import json
import os
import time
import hashlib
import secrets
import boto3
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from auth_helper import require_auth, get_db_connection, CORS_HEADERS

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')
STREAMLINE_WEBHOOK_URL = os.environ.get('STREAMLINE_WEBHOOK_URL', '')
STREAMLINE_INVITE_WEBHOOK_URL = os.environ.get('STREAMLINE_INVITE_WEBHOOK_URL', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://xo.intellagentic.io')


# ── Auto-migration: add streamline_webhook_url column if missing ──
def _run_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS streamline_webhook_url VARCHAR(1000);")
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS invite_webhook_url VARCHAR(1000);")
        conn.commit()
        cur.close()
        conn.close()
        print("Migration complete: streamline_webhook_url + invite_webhook_url columns ensured")
    except Exception as e:
        print(f"Migration check (non-fatal): {e}")

_run_migrations()


# ── Auto-migration: make skills.client_id nullable + seed system skills ──
SYSTEM_SKILLS = [
    ('analysis-framework', '_system/skills/analysis-framework.md'),
    ('output-format', '_system/skills/output-format.md'),
    ('authority-boundaries', '_system/skills/authority-boundaries.md'),
    ('enrichment-process', '_system/skills/enrichment-process.md'),
    ('client-facing-summary', '_system/skills/client-facing-summary.md'),
    ('streamline-applications', '_system/skills/streamline-applications.md'),
]

def _run_skill_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Make client_id nullable
        cur.execute("ALTER TABLE skills ALTER COLUMN client_id DROP NOT NULL;")
        # Seed system skills (client_id IS NULL) if they don't exist
        for name, s3_key in SYSTEM_SKILLS:
            cur.execute(
                "SELECT id FROM skills WHERE client_id IS NULL AND name = %s",
                (name,)
            )
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO skills (client_id, name, s3_key) VALUES (NULL, %s, %s)",
                    (name, s3_key)
                )
                print(f"Seeded system skill: {name}")
        conn.commit()
        cur.close()
        conn.close()
        print("Skill migration complete: client_id nullable + system skills seeded")
    except Exception as e:
        print(f"Skill migration check (non-fatal): {e}")

_run_skill_migrations()


# ── Auto-migration: partners table + client partner_id/intellagentic_lead ──
def _run_partner_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS partners (
                id SERIAL PRIMARY KEY,
                name VARCHAR(500) NOT NULL,
                company VARCHAR(500),
                email VARCHAR(500),
                phone VARCHAR(200),
                industry VARCHAR(300),
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL;")
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS intellagentic_lead BOOLEAN DEFAULT FALSE;")
        # Partner org profile columns
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS website VARCHAR(500);")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS contacts_json TEXT;")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS addresses_json TEXT;")
        # Future plans + pain points (both clients and partners)
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS future_plans TEXT;")
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS pain_points_json TEXT;")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS description TEXT;")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS future_plans TEXT;")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS pain_points_json TEXT;")
        conn.commit()
        cur.close()
        conn.close()
        print("Partner migration complete: partners table + client columns ensured")
    except Exception as e:
        print(f"Partner migration check (non-fatal): {e}")

_run_partner_migrations()


# ── Auto-migration: invite support (source column, nullable user_id) ──
def _run_invite_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS source VARCHAR(50);")
        cur.execute("ALTER TABLE clients ALTER COLUMN user_id DROP NOT NULL;")
        conn.commit()
        cur.close()
        conn.close()
        print("Invite migration complete: source column + nullable user_id ensured")
    except Exception as e:
        print(f"Invite migration check (non-fatal): {e}")

_run_invite_migrations()


# ── Auto-migration: system_config key/value table ──
def _run_system_config_migration():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                config_key VARCHAR(255) UNIQUE NOT NULL,
                config_value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("Migration complete: system_config table ensured")
    except Exception as e:
        print(f"system_config migration check (non-fatal): {e}")

_run_system_config_migration()


def lambda_handler(event, context):
    """
    Method router for /clients:
      GET  /clients?client_id=X  -> fetch existing client data
      POST /clients              -> create new client
      PUT  /clients              -> update existing client
    """

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '')
    method = event.get('httpMethod', '')

    # Public invite endpoint — no auth required
    if path.endswith('/invite') and method == 'POST':
        return handle_invite(event)

    # Auth check
    user, err = require_auth(event)
    if err:
        return err

    # Derive role — old JWTs may have is_admin/is_partner but no role field
    role = user.get('role', 'client')
    if user.get('is_admin'):
        role = 'admin'
    elif user.get('is_partner'):
        role = 'partner'
    is_client_user = role == 'client'
    is_partner_user = role == 'partner'

    # System config routes — admin only
    if '/system-config' in path:
        if not user.get('is_admin'):
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
        if method == 'GET':
            return handle_get_system_config(event, user)
        elif method == 'PUT':
            return handle_update_system_config(event, user)

    # Partners routes — admin only (partners can read list for reference)
    if '/partners' in path:
        if is_client_user:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Access denied'})}
        if method == 'GET':
            return handle_list_partners(event, user)
        elif not user.get('is_admin'):
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
        elif method == 'POST':
            return handle_create_partner(event, user)
        elif method == 'PUT':
            return handle_update_partner(event, user)
        elif method == 'DELETE':
            return handle_delete_partner(event, user)

    # Skills routes — client users can read but not write
    if '/skills' in path:
        if method == 'GET':
            return handle_get_skills(event, user)
        elif is_client_user:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Access denied'})}
        elif method == 'POST':
            return handle_create_skill(event, user)
        elif method == 'PUT':
            return handle_update_skill(event, user)
        elif method == 'DELETE':
            return handle_delete_skill(event, user)

    if path.endswith('/clients/list') and method == 'GET':
        return handle_list_clients(event, user)
    elif method == 'GET':
        return handle_get_client(event, user)
    elif method == 'PUT':
        return handle_update_client(event, user)
    elif method == 'POST':
        if is_client_user:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Access denied'})}
        return handle_create_client(event, user)
    elif method == 'DELETE':
        if is_client_user or is_partner_user:
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Access denied'})}
        return handle_delete_client(event, user)
    else:
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Method not allowed: {method}'})
        }


def handle_get_skills(event, user):
    """GET /skills — List skills. ?client_id=X returns system+client combined. ?scope=system returns system only."""
    params = event.get('queryStringParameters') or {}
    client_id = params.get('client_id', '').strip()
    scope = params.get('scope', '').strip()

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        skills = []

        if scope == 'system':
            cur.execute("""
                SELECT id, name, content, s3_key, created_at
                FROM skills WHERE client_id IS NULL ORDER BY name
            """)
            for row in cur.fetchall():
                skills.append({
                    'id': str(row[0]), 'name': row[1], 'content': row[2] or '',
                    's3_key': row[3] or '', 'created_at': row[4].isoformat() if row[4] else None,
                    'scope': 'system'
                })
        else:
            # System skills first
            cur.execute("""
                SELECT id, name, content, s3_key, created_at
                FROM skills WHERE client_id IS NULL ORDER BY name
            """)
            for row in cur.fetchall():
                skills.append({
                    'id': str(row[0]), 'name': row[1], 'content': row[2] or '',
                    's3_key': row[3] or '', 'created_at': row[4].isoformat() if row[4] else None,
                    'scope': 'system'
                })

            # Then client skills
            if client_id:
                cur.execute("""
                    SELECT s.id, s.name, s.content, s.s3_key, s.created_at
                    FROM skills s
                    JOIN clients c ON s.client_id = c.id
                    WHERE c.s3_folder = %s
                    ORDER BY s.name
                """, (client_id,))
                for row in cur.fetchall():
                    skills.append({
                        'id': str(row[0]), 'name': row[1], 'content': row[2] or '',
                        's3_key': row[3] or '', 'created_at': row[4].isoformat() if row[4] else None,
                        'scope': 'client'
                    })

        # Load content from S3 for skills that only have s3_key
        for skill in skills:
            if not skill['content'] and skill['s3_key']:
                try:
                    obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=skill['s3_key'])
                    skill['content'] = obj['Body'].read().decode('utf-8')
                except Exception as e:
                    print(f"Failed to load skill content from S3 ({skill['s3_key']}): {e}")

        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'skills': skills})
        }
    except Exception as e:
        print(f"Error listing skills: {e}")
        cur.close()
        conn.close()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def handle_create_skill(event, user):
    """POST /skills — Create a skill. scope=system requires is_admin."""
    try:
        body = json.loads(event.get('body', '{}'))
        name = body.get('name', '').strip()
        content = body.get('content', '').strip()
        scope = body.get('scope', 'client').strip()
        client_id = body.get('client_id', '').strip()

        if not name:
            return {'statusCode': 400, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'name is required'})}

        if scope == 'system':
            if not user.get('is_admin'):
                return {'statusCode': 403, 'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Admin required for system skills'})}
            s3_key = f"_system/skills/{name}.md"
            # Write content to S3
            if content:
                s3_client.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=content, ContentType='text/markdown')
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO skills (client_id, name, content, s3_key) VALUES (NULL, %s, %s, %s) RETURNING id",
                (name, content, s3_key)
            )
            skill_id = str(cur.fetchone()[0])
            conn.commit()
            cur.close()
            conn.close()
        else:
            if not client_id:
                return {'statusCode': 400, 'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'client_id is required for client skills'})}
            conn = get_db_connection()
            cur = conn.cursor()
            # Resolve s3_folder to DB id
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                return {'statusCode': 404, 'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Client not found'})}
            db_client_id = str(row[0])
            s3_key = f"{client_id}/skills/{name}.md"
            if content:
                s3_client.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=content, ContentType='text/markdown')
            cur.execute(
                "INSERT INTO skills (client_id, name, content, s3_key) VALUES (%s, %s, %s, %s) RETURNING id",
                (db_client_id, name, content, s3_key)
            )
            skill_id = str(cur.fetchone()[0])
            conn.commit()
            cur.close()
            conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'skill_id': skill_id, 'status': 'created', 'scope': scope})
        }
    except Exception as e:
        print(f"Error creating skill: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}


def handle_update_skill(event, user):
    """PUT /skills — Update a skill. System skills require is_admin."""
    try:
        body = json.loads(event.get('body', '{}'))
        skill_id = body.get('skill_id', '').strip()
        name = body.get('name', '').strip()
        content = body.get('content', '').strip()

        if not skill_id:
            return {'statusCode': 400, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'skill_id is required'})}

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, client_id, s3_key FROM skills WHERE id = %s", (skill_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {'statusCode': 404, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Skill not found'})}

        is_system = row[1] is None
        if is_system and not user.get('is_admin'):
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Admin required for system skills'})}

        # Update DB
        updates = []
        params = []
        if name:
            updates.append("name = %s")
            params.append(name)
        if content is not None:
            updates.append("content = %s")
            params.append(content)

        if updates:
            params.append(skill_id)
            cur.execute(f"UPDATE skills SET {', '.join(updates)} WHERE id = %s", params)

        # Update S3 file
        s3_key = row[2]
        if content and s3_key:
            s3_client.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=content, ContentType='text/markdown')
        elif content and is_system and name:
            s3_key = f"_system/skills/{name}.md"
            s3_client.put_object(Bucket=BUCKET_NAME, Key=s3_key, Body=content, ContentType='text/markdown')

        conn.commit()
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'skill_id': skill_id, 'status': 'updated'})
        }
    except Exception as e:
        print(f"Error updating skill: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}


def handle_delete_skill(event, user):
    """DELETE /skills?skill_id=X — Delete a skill + S3 file. System skills require is_admin."""
    try:
        params = event.get('queryStringParameters') or {}
        skill_id = params.get('skill_id', '').strip()

        if not skill_id:
            return {'statusCode': 400, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'skill_id is required'})}

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, client_id, s3_key FROM skills WHERE id = %s", (skill_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {'statusCode': 404, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Skill not found'})}

        is_system = row[1] is None
        if is_system and not user.get('is_admin'):
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Admin required for system skills'})}

        # Delete S3 file
        s3_key = row[2]
        if s3_key:
            try:
                s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
            except Exception as e:
                print(f"Warning: failed to delete S3 skill ({s3_key}): {e}")

        cur.execute("DELETE FROM skills WHERE id = %s", (skill_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'deleted': True, 'skill_id': skill_id})
        }
    except Exception as e:
        print(f"Error deleting skill: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}


def handle_list_partners(event, user):
    """GET /partners — List all partners (admin only)."""
    if not user.get('is_admin'):
        return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, company, email, phone, industry, notes, created_at, updated_at, website, contacts_json, addresses_json, description, future_plans, pain_points_json FROM partners ORDER BY name")
        partners = []
        for row in cur.fetchall():
            contacts = []
            addresses = []
            try:
                if row[10]:
                    contacts = json.loads(row[10])
            except Exception:
                pass
            try:
                if row[11]:
                    addresses = json.loads(row[11])
            except Exception:
                pass
            pain_points = []
            try:
                if row[14]:
                    pain_points = json.loads(row[14])
            except Exception:
                pass
            partners.append({
                'id': row[0], 'name': row[1] or '', 'company': row[2] or '',
                'email': row[3] or '', 'phone': row[4] or '', 'industry': row[5] or '',
                'notes': row[6] or '',
                'created_at': row[7].isoformat() if row[7] else None,
                'updated_at': row[8].isoformat() if row[8] else None,
                'website': row[9] or '',
                'contacts': contacts,
                'addresses': addresses,
                'description': row[12] or '',
                'futurePlans': row[13] or '',
                'painPoints': pain_points
            })
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'partners': partners})}
    except Exception as e:
        print(f"Error listing partners: {e}")
        cur.close()
        conn.close()
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}


def handle_create_partner(event, user):
    """POST /partners — Create a new partner (admin only)."""
    if not user.get('is_admin'):
        return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
    body = json.loads(event.get('body', '{}'))
    name = body.get('name', '').strip()
    if not name:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'name is required'})}
    conn = get_db_connection()
    cur = conn.cursor()
    contacts = body.get('contacts')
    addresses = body.get('addresses')
    p_pain_points = body.get('painPoints', [])
    contacts_json = json.dumps(contacts) if contacts else None
    addresses_json = json.dumps(addresses) if addresses else None
    try:
        cur.execute("""
            INSERT INTO partners (name, company, email, phone, industry, notes, website, contacts_json, addresses_json, description, future_plans, pain_points_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (name, body.get('company', '').strip(), body.get('email', '').strip(),
              body.get('phone', '').strip(), body.get('industry', '').strip(), body.get('notes', '').strip(),
              body.get('website', '').strip(), contacts_json, addresses_json,
              body.get('description', '').strip(), body.get('futurePlans', '').strip(),
              json.dumps(p_pain_points) if p_pain_points else None))
        partner_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'id': partner_id, 'status': 'created'})}
    except Exception as e:
        print(f"Error creating partner: {e}")
        cur.close()
        conn.close()
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}


def handle_update_partner(event, user):
    """PUT /partners — Update an existing partner (admin only)."""
    if not user.get('is_admin'):
        return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
    body = json.loads(event.get('body', '{}'))
    partner_id = body.get('id')
    if not partner_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'id is required'})}
    conn = get_db_connection()
    cur = conn.cursor()
    contacts = body.get('contacts')
    addresses = body.get('addresses')
    u_pain_points = body.get('painPoints', [])
    contacts_json = json.dumps(contacts) if contacts else None
    addresses_json = json.dumps(addresses) if addresses else None
    try:
        cur.execute("""
            UPDATE partners SET name=%s, company=%s, email=%s, phone=%s, industry=%s, notes=%s,
                   website=%s, contacts_json=%s, addresses_json=%s,
                   description=%s, future_plans=%s, pain_points_json=%s, updated_at=NOW()
            WHERE id=%s RETURNING id
        """, (body.get('name', '').strip(), body.get('company', '').strip(), body.get('email', '').strip(),
              body.get('phone', '').strip(), body.get('industry', '').strip(), body.get('notes', '').strip(),
              body.get('website', '').strip(), contacts_json, addresses_json,
              body.get('description', '').strip(), body.get('futurePlans', '').strip(),
              json.dumps(u_pain_points) if u_pain_points else None, partner_id))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Partner not found'})}
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'id': partner_id, 'status': 'updated'})}
    except Exception as e:
        print(f"Error updating partner: {e}")
        cur.close()
        conn.close()
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}


def handle_delete_partner(event, user):
    """DELETE /partners — Delete a partner (admin only). Clients with this partner get NULL."""
    if not user.get('is_admin'):
        return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Admin access required'})}
    params = event.get('queryStringParameters') or {}
    partner_id = params.get('id')
    if not partner_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'id is required'})}
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM partners WHERE id = %s RETURNING id", (partner_id,))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not row:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Partner not found'})}
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'deleted': True})}
    except Exception as e:
        print(f"Error deleting partner: {e}")
        cur.close()
        conn.close()
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}


def handle_list_clients(event, user):
    """GET /clients/list — List all clients for the logged-in user with stats."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        base_query = """
            SELECT c.id, c.company_name, c.industry, c.s3_folder, c.status,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*) FROM uploads u WHERE u.client_id = c.id AND u.status = 'active') as source_count,
                   (SELECT e.status FROM enrichments e WHERE e.client_id = c.id ORDER BY e.started_at DESC LIMIT 1) as last_enrichment_status,
                   (SELECT e.completed_at FROM enrichments e WHERE e.client_id = c.id ORDER BY e.started_at DESC LIMIT 1) as last_enrichment_date,
                   c.icon_s3_key,
                   u.name as owner_name,
                   p.name as partner_name,
                   c.partner_id,
                   COALESCE(c.intellagentic_lead, FALSE) as intellagentic_lead
            FROM clients c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN partners p ON c.partner_id = p.id
        """
        if user.get('is_admin'):
            cur.execute(base_query + " ORDER BY c.updated_at DESC")
        elif user.get('is_partner') and user.get('partner_id'):
            cur.execute(base_query + " WHERE c.partner_id = %s ORDER BY c.updated_at DESC", (user['partner_id'],))
        elif user.get('is_client') and user.get('client_id'):
            cur.execute(base_query + " WHERE c.s3_folder = %s ORDER BY c.updated_at DESC", (user['client_id'],))
        else:
            cur.execute(base_query + " WHERE c.user_id = %s ORDER BY c.updated_at DESC", (user['user_id'],))

        rows = cur.fetchall()
        cur.close()
        conn.close()

        clients = []
        for row in rows:
            icon_s3_key = row[10]
            icon_url = None
            if icon_s3_key:
                try:
                    icon_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': BUCKET_NAME, 'Key': icon_s3_key},
                        ExpiresIn=3600
                    )
                except Exception:
                    pass

            clients.append({
                'id': str(row[0]),
                'company_name': row[1] or '',
                'industry': row[2] or '',
                'client_id': row[3] or '',
                'status': row[4] or 'active',
                'created_at': row[5].isoformat() if row[5] else None,
                'updated_at': row[6].isoformat() if row[6] else None,
                'source_count': row[7] or 0,
                'enrichment_status': row[8] or 'none',
                'enrichment_date': row[9].isoformat() if row[9] else None,
                'icon_url': icon_url,
                'owner_name': row[11] or '',
                'partner_name': row[12] or '',
                'partner_id': row[13],
                'intellagentic_lead': bool(row[14])
            })

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'clients': clients})
        }

    except Exception as e:
        print(f"Error listing clients: {str(e)}")
        cur.close()
        conn.close()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def handle_get_client(event, user):
    """GET /clients?client_id=X — Fetch existing client data."""
    params = event.get('queryStringParameters') or {}
    client_id = params.get('client_id', '').strip()

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Client-token users: force scope to their client
        if user.get('is_client') and user.get('client_id'):
            client_id = user['client_id']

        if client_id:
            # Admins, client users (own client), and partners (own clients) get unscoped query
            if user.get('is_admin') or (user.get('is_client') and user.get('client_id') == client_id):
                cur.execute("""
                    SELECT id, company_name, website_url, contact_name, contact_title,
                           contact_linkedin, industry, description, pain_point,
                           s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                           COALESCE(streamline_webhook_enabled, FALSE),
                           contact_email, contact_phone, contacts_json, addresses_json,
                           streamline_webhook_url, partner_id, COALESCE(intellagentic_lead, FALSE),
                           future_plans, pain_points_json, invite_webhook_url
                    FROM clients WHERE s3_folder = %s
                """, (client_id,))
            elif user.get('is_partner') and user.get('partner_id'):
                cur.execute("""
                    SELECT id, company_name, website_url, contact_name, contact_title,
                           contact_linkedin, industry, description, pain_point,
                           s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                           COALESCE(streamline_webhook_enabled, FALSE),
                           contact_email, contact_phone, contacts_json, addresses_json,
                           streamline_webhook_url, partner_id, COALESCE(intellagentic_lead, FALSE),
                           future_plans, pain_points_json, invite_webhook_url
                    FROM clients WHERE s3_folder = %s AND partner_id = %s
                """, (client_id, user['partner_id']))
            else:
                cur.execute("""
                    SELECT id, company_name, website_url, contact_name, contact_title,
                           contact_linkedin, industry, description, pain_point,
                           s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                           COALESCE(streamline_webhook_enabled, FALSE),
                           contact_email, contact_phone, contacts_json, addresses_json,
                           streamline_webhook_url, partner_id, COALESCE(intellagentic_lead, FALSE),
                           future_plans, pain_points_json, invite_webhook_url
                    FROM clients WHERE s3_folder = %s AND user_id = %s
                """, (client_id, user['user_id']))
        else:
            # Fetch most recent client for this user
            cur.execute("""
                SELECT id, company_name, website_url, contact_name, contact_title,
                       contact_linkedin, industry, description, pain_point,
                       s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                       COALESCE(streamline_webhook_enabled, FALSE),
                       contact_email, contact_phone, contacts_json, addresses_json,
                       streamline_webhook_url, partner_id, COALESCE(intellagentic_lead, FALSE),
                       future_plans, pain_points_json
                FROM clients WHERE user_id = %s
                ORDER BY created_at DESC LIMIT 1
            """, (user['user_id'],))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No client found'})
            }

        logo_s3_key = row[12]
        icon_s3_key = row[13]
        logo_url = None
        icon_url = None

        if logo_s3_key:
            try:
                logo_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': logo_s3_key},
                    ExpiresIn=3600
                )
            except Exception:
                pass

        if icon_s3_key:
            try:
                icon_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': icon_s3_key},
                    ExpiresIn=3600
                )
            except Exception:
                pass

        # Build contacts array: prefer contacts_json, fallback to legacy columns
        contacts_json_raw = row[17]
        if contacts_json_raw:
            try:
                contacts = json.loads(contacts_json_raw)
            except (json.JSONDecodeError, TypeError):
                contacts = []
        else:
            contacts = []

        if not contacts:
            # Construct from legacy fields — split name into firstName/lastName
            full_name = row[3] or ''
            space_idx = full_name.find(' ')
            legacy = {
                'firstName': full_name[:space_idx] if space_idx > 0 else full_name,
                'lastName': full_name[space_idx + 1:] if space_idx > 0 else '',
                'title': row[4] or '',
                'linkedin': row[5] or '',
                'email': row[15] or '',
                'phone': row[16] or ''
            }
            if any(legacy.values()):
                contacts = [legacy]

        # Migrate any contacts that still have "name" instead of firstName/lastName
        for c in contacts:
            if 'name' in c and 'firstName' not in c:
                old_name = c.pop('name', '')
                space_idx = old_name.find(' ')
                c['firstName'] = old_name[:space_idx] if space_idx > 0 else old_name
                c['lastName'] = old_name[space_idx + 1:] if space_idx > 0 else ''

        # Parse addresses_json
        addresses_json_raw = row[18]
        addresses = []
        if addresses_json_raw:
            try:
                addresses = json.loads(addresses_json_raw)
            except (json.JSONDecodeError, TypeError):
                pass

        # Legacy flat fields from contacts[0] for backward compat
        primary = contacts[0] if contacts else {}

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'id': str(row[0]),
                'company_name': row[1] or '',
                'website': row[2] or '',
                'contactName': f"{primary.get('firstName', '')} {primary.get('lastName', '')}".strip(),
                'contactTitle': primary.get('title', ''),
                'contactLinkedIn': primary.get('linkedin', ''),
                'industry': row[6] or '',
                'description': row[7] or '',
                'painPoint': row[8] or '',
                'futurePlans': row[22] or '',
                'painPoints': json.loads(row[23]) if row[23] else [],
                'client_id': row[9] or '',
                'created_at': row[10].isoformat() if row[10] else None,
                'updated_at': row[11].isoformat() if row[11] else None,
                'logo_url': logo_url,
                'icon_url': icon_url,
                'streamline_webhook_enabled': bool(row[14]),
                'contactEmail': primary.get('email', ''),
                'contactPhone': primary.get('phone', ''),
                'contacts': contacts,
                'addresses': addresses,
                'streamline_webhook_url': row[19] or '',
                'partner_id': row[20],
                'intellagentic_lead': bool(row[21]),
                'invite_webhook_url': row[24] or ''
            })
        }
    except Exception as e:
        print(f"Error fetching client: {str(e)}")
        cur.close()
        conn.close()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def handle_update_client(event, user):
    """PUT /clients — Update existing client."""
    try:
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        company_name = body.get('company_name', '').strip()
        if not company_name:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'company_name is required'})
            }

        # Build contacts array from request
        contacts = body.get('contacts', [])
        if not contacts:
            # Fallback: construct from legacy flat fields if provided
            legacy = {
                'firstName': body.get('contactName', '').strip(),
                'lastName': '',
                'title': body.get('contactTitle', '').strip(),
                'linkedin': body.get('contactLinkedIn', '').strip(),
                'email': body.get('contactEmail', '').strip(),
                'phone': body.get('contactPhone', '').strip()
            }
            if any(legacy.values()):
                contacts = [legacy]

        # Build addresses array from request
        addresses = body.get('addresses', [])

        # Sync primary contact to legacy columns
        primary = contacts[0] if contacts else {}

        conn = get_db_connection()
        cur = conn.cursor()

        # Build dynamic SET clause — streamline_webhook_enabled is optional
        set_fields = [
            "company_name = %s", "website_url = %s", "contact_name = %s",
            "contact_title = %s", "contact_linkedin = %s",
            "contact_email = %s", "contact_phone = %s",
            "contacts_json = %s", "addresses_json = %s",
            "industry = %s",
            "description = %s", "pain_point = %s",
            "future_plans = %s", "pain_points_json = %s",
            "updated_at = NOW()"
        ]
        pain_points = body.get('painPoints', [])
        params = [
            company_name,
            body.get('website', '').strip(),
            f"{primary.get('firstName', '')} {primary.get('lastName', '')}".strip(),
            primary.get('title', ''),
            primary.get('linkedin', ''),
            primary.get('email', ''),
            primary.get('phone', ''),
            json.dumps(contacts) if contacts else None,
            json.dumps(addresses) if addresses else None,
            body.get('industry', '').strip(),
            body.get('description', '').strip(),
            body.get('painPoint', '').strip(),
            body.get('futurePlans', '').strip(),
            json.dumps(pain_points) if pain_points else None,
        ]

        if 'streamline_webhook_enabled' in body:
            set_fields.append("streamline_webhook_enabled = %s")
            params.append(bool(body['streamline_webhook_enabled']))

        if 'streamline_webhook_url' in body:
            set_fields.append("streamline_webhook_url = %s")
            params.append(body['streamline_webhook_url'].strip())

        if 'invite_webhook_url' in body:
            set_fields.append("invite_webhook_url = %s")
            params.append(body['invite_webhook_url'].strip())

        if 'partner_id' in body:
            set_fields.append("partner_id = %s")
            params.append(body['partner_id'])  # int or None

        if 'intellagentic_lead' in body:
            set_fields.append("intellagentic_lead = %s")
            params.append(bool(body['intellagentic_lead']))

        if user.get('is_admin') or (user.get('is_client') and user.get('client_id') == client_id):
            params.append(client_id)
            cur.execute(f"""
                UPDATE clients SET {', '.join(set_fields)}
                WHERE s3_folder = %s
                RETURNING id
            """, params)
        elif user.get('is_partner') and user.get('partner_id'):
            params.extend([client_id, user['partner_id']])
            cur.execute(f"""
                UPDATE clients SET {', '.join(set_fields)}
                WHERE s3_folder = %s AND partner_id = %s
                RETURNING id
            """, params)
        else:
            params.extend([client_id, user['user_id']])
            cur.execute(f"""
                UPDATE clients SET {', '.join(set_fields)}
                WHERE s3_folder = %s AND user_id = %s
                RETURNING id
            """, params)

        row = cur.fetchone()
        conn.commit()

        # Regenerate client-config.md in S3
        config_md = generate_client_config(
            company_name,
            body.get('website', '').strip(),
            f"{primary.get('firstName', '')} {primary.get('lastName', '')}".strip(),
            primary.get('title', ''),
            primary.get('linkedin', ''),
            body.get('industry', '').strip(),
            body.get('description', '').strip(),
            body.get('painPoint', '').strip(),
            contact_email=primary.get('email', ''),
            contact_phone=primary.get('phone', ''),
            contacts=contacts,
            addresses=addresses,
            future_plans=body.get('futurePlans', '').strip(),
            pain_points=pain_points
        )
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=f"{client_id}/client-config.md",
            Body=config_md,
            ContentType='text/markdown'
        )

        cur.close()
        conn.close()

        if not row:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }

        print(f"Updated client: {client_id}")
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'client_id': client_id,
                'id': str(row[0]),
                'status': 'updated'
            })
        }

    except Exception as e:
        print(f"Error updating client: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def handle_delete_client(event, user):
    """DELETE /clients?client_id=X — Delete client and all associated data."""
    try:
        params = event.get('queryStringParameters') or {}
        client_id = params.get('client_id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        conn = get_db_connection()
        cur = conn.cursor()

        # Verify ownership and get DB id (admins can access any client)
        if user.get('is_admin'):
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_id,))
        else:
            cur.execute("SELECT id FROM clients WHERE s3_folder = %s AND user_id = %s", (client_id, user['user_id']))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }

        # Delete from DB (cascades to uploads, enrichments, skills)
        cur.execute("DELETE FROM clients WHERE id = %s", (row[0],))
        conn.commit()
        cur.close()
        conn.close()

        # Delete S3 folder and all contents
        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=f"{client_id}/"):
                objects = page.get('Contents', [])
                if objects:
                    s3_client.delete_objects(
                        Bucket=BUCKET_NAME,
                        Delete={'Objects': [{'Key': obj['Key']} for obj in objects]}
                    )
            print(f"Deleted S3 folder: {client_id}/")
        except Exception as e:
            print(f"Warning: failed to delete S3 folder {client_id}/: {e}")

        print(f"Deleted client: {client_id}")
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'deleted': True, 'client_id': client_id})
        }

    except Exception as e:
        print(f"Error deleting client: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def handle_get_system_config(event, user):
    """GET /system-config — Return all system config key/value pairs."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT config_key, config_value FROM system_config")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        config = {row[0]: row[1] or '' for row in rows}
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(config)
        }
    except Exception as e:
        print(f"Error fetching system config: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}


def handle_update_system_config(event, user):
    """PUT /system-config — Upsert a system config key/value pair."""
    try:
        body = json.loads(event.get('body', '{}'))
        config_key = body.get('config_key', '').strip()
        config_value = body.get('config_value', '').strip()

        if not config_key:
            return {'statusCode': 400, 'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'config_key is required'})}

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO system_config (config_key, config_value, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()
        """, (config_key, config_value))
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'status': 'saved', 'config_key': config_key})
        }
    except Exception as e:
        print(f"Error updating system config: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Internal server error', 'message': str(e)})}


def handle_invite(event):
    """POST /invite — Public invite signup (no auth). Creates client + magic link."""
    try:
        body = json.loads(event.get('body', '{}'))
        first_name = body.get('first_name', '').strip()
        last_name = body.get('last_name', '').strip()
        email = body.get('email', '').strip()
        phone = body.get('phone', '').strip()
        linkedin = body.get('linkedin', '').strip()
        company_name = body.get('company_name', '').strip()
        lead_source = body.get('lead_source', '').strip()
        contact_name = f"{first_name} {last_name}".strip()

        if not first_name or not email or not phone or not company_name:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'first_name, email, phone, and company_name are required'})
            }

        conn = get_db_connection()
        cur = conn.cursor()

        # Check for existing invite by email
        cur.execute("""
            SELECT c.id, c.s3_folder, ct.token
            FROM clients c
            LEFT JOIN client_tokens ct ON ct.client_id = c.id AND ct.expires_at > NOW()
            WHERE c.contact_email = %s AND c.source = 'invite'
            LIMIT 1
        """, (email,))
        existing = cur.fetchone()

        if existing:
            db_id, s3_folder, token = existing
            if token:
                # Look up invite webhook URL from system_config
                sys_invite_url = ''
                try:
                    cur.execute("SELECT config_value FROM system_config WHERE config_key = 'invite_webhook_url'")
                    sys_row = cur.fetchone()
                    if sys_row:
                        sys_invite_url = sys_row[0] or ''
                except Exception:
                    pass
                cur.close()
                conn.close()
                print(f"Invite signup (existing): {company_name} ({email})")
                _send_invite_webhook(company_name, first_name, last_name, email, phone, linkedin, lead_source=lead_source, webhook_url=sys_invite_url)
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': True,
                        'company_name': company_name,
                        'existing': True
                    })
                }
            # Token expired — generate new one below
            db_client_id = db_id
            client_id = s3_folder
        else:
            # Create new client
            timestamp = str(int(time.time()))
            name_hash = hashlib.md5(company_name.encode()).hexdigest()[:8]
            client_id = f"client_{timestamp}_{name_hash}"

            # S3 folders
            for folder in [f"{client_id}/uploads/", f"{client_id}/extracted/", f"{client_id}/results/"]:
                s3_client.put_object(Bucket=BUCKET_NAME, Key=folder, Body='')

            # Client config
            config_md = generate_client_config(
                company_name, '', contact_name, '', linkedin, '', '', '',
                contact_email=email, contact_phone=phone
            )
            s3_client.put_object(
                Bucket=BUCKET_NAME, Key=f"{client_id}/client-config.md",
                Body=config_md, ContentType='text/markdown'
            )

            # Default skill
            copy_default_skill(client_id)

            # Insert client with user_id=NULL, source='invite'
            cur.execute("""
                INSERT INTO clients (
                    user_id, company_name, contact_name, contact_email,
                    contact_phone, contact_linkedin, s3_folder, source
                ) VALUES (NULL, %s, %s, %s, %s, %s, %s, 'invite')
                RETURNING id
            """, (company_name, contact_name, email, phone, linkedin, client_id))
            db_client_id = cur.fetchone()[0]

            # Insert default skill into DB
            cur.execute("""
                INSERT INTO skills (client_id, name, s3_key)
                VALUES (%s, %s, %s)
            """, (str(db_client_id), 'analysis-template', f"{client_id}/skills/analysis-template.md"))

        # Generate magic link token
        new_token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        cur.execute("""
            INSERT INTO client_tokens (token, client_id, expires_at, created_by)
            VALUES (%s, %s, %s, NULL)
        """, (new_token, db_client_id, expires_at))

        conn.commit()
        cur.close()
        conn.close()

        magic_link_url = f"{FRONTEND_URL}?token={new_token}"
        print(f"Invite signup: {company_name} ({email}) -> {client_id}")

        # Look up configured invite webhook URL from system_config
        invite_url = ''
        try:
            wh_conn = get_db_connection()
            wh_cur = wh_conn.cursor()
            wh_cur.execute("SELECT config_value FROM system_config WHERE config_key = 'invite_webhook_url'")
            wh_row = wh_cur.fetchone()
            if wh_row:
                invite_url = wh_row[0] or ''
            wh_cur.close()
            wh_conn.close()
        except Exception as e:
            print(f"Failed to look up invite webhook URL from system_config (non-fatal): {e}")

        # Fire webhook (best-effort)
        _send_invite_webhook(company_name, first_name, last_name, email, phone, linkedin, lead_source=lead_source, webhook_url=invite_url)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'company_name': company_name
            })
        }

    except Exception as e:
        print(f"Invite error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }


def _send_invite_webhook(company_name, first_name, last_name, email, phone, linkedin, lead_source='', webhook_url=''):
    """Best-effort POST to Streamline invite webhook. Uses per-client URL if provided, falls back to env var."""
    url = webhook_url or STREAMLINE_INVITE_WEBHOOK_URL
    if not url:
        print("No invite webhook URL configured (no per-client URL or env var), skipping")
        return
    try:
        payload = json.dumps({
            'event': 'invite_submission',
            'source': 'himss_2026',
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'phone': phone,
            'linkedin': linkedin,
            'company_name': company_name,
            'lead_source': lead_source,
            'signup_date': datetime.now(timezone.utc).isoformat()
        }).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"Invite webhook sent for {email} to {url} (HTTP {resp.status})")
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f"Invite webhook failed (non-fatal): HTTP {e.code} - {body}")
    except Exception as e:
        print(f"Invite webhook failed (non-fatal): {e}")


def handle_create_client(event, user):
    """POST /clients — Create new client (original logic)."""
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        company_name = body.get('company_name', '').strip()
        website = body.get('website', '').strip()
        industry = body.get('industry', '').strip()
        description = body.get('description', '').strip()
        pain_point = body.get('painPoint', '').strip()
        future_plans = body.get('futurePlans', '').strip()
        pain_points = body.get('painPoints', [])

        # Build contacts array
        contacts = body.get('contacts', [])
        if not contacts:
            legacy = {
                'firstName': body.get('contactName', '').strip(),
                'lastName': '',
                'title': body.get('contactTitle', '').strip(),
                'linkedin': body.get('contactLinkedIn', '').strip(),
                'email': body.get('contactEmail', '').strip(),
                'phone': body.get('contactPhone', '').strip()
            }
            if any(legacy.values()):
                contacts = [legacy]

        # Build addresses array
        addresses = body.get('addresses', [])

        primary = contacts[0] if contacts else {}
        contact_name = f"{primary.get('firstName', '')} {primary.get('lastName', '')}".strip()
        contact_title = primary.get('title', '')
        contact_linkedin = primary.get('linkedin', '')
        contact_email = primary.get('email', '')
        contact_phone = primary.get('phone', '')

        # Validate required fields
        if not company_name:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'company_name is required'})
            }

        # Generate unique client_id (S3 folder name)
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
            s3_client.put_object(Bucket=BUCKET_NAME, Key=folder, Body='')

        # Generate client-config.md
        config_md = generate_client_config(
            company_name, website, contact_name, contact_title,
            contact_linkedin, industry, description, pain_point,
            contact_email=contact_email, contact_phone=contact_phone,
            contacts=contacts, addresses=addresses,
            future_plans=future_plans, pain_points=pain_points
        )
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=f"{client_id}/client-config.md",
            Body=config_md,
            ContentType='text/markdown'
        )

        # Copy default skill template to client's skills folder
        copy_default_skill(client_id)

        # Insert into PostgreSQL
        conn = get_db_connection()
        cur = conn.cursor()

        # Partners auto-assign their partner_id to new clients
        partner_id_val = body.get('partner_id')  # int or None
        if user.get('is_partner') and user.get('partner_id'):
            partner_id_val = user['partner_id']
        intellagentic_lead_val = bool(body.get('intellagentic_lead', False))

        cur.execute("""
            INSERT INTO clients (
                user_id, company_name, website_url, contact_name, contact_title,
                contact_linkedin, contact_email, contact_phone,
                contacts_json, addresses_json, industry, description, pain_point, s3_folder,
                partner_id, intellagentic_lead, future_plans, pain_points_json
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user['user_id'], company_name, website, contact_name, contact_title,
            contact_linkedin, contact_email, contact_phone,
            json.dumps(contacts) if contacts else None,
            json.dumps(addresses) if addresses else None,
            industry, description, pain_point, client_id,
            partner_id_val, intellagentic_lead_val,
            future_plans,
            json.dumps(pain_points) if pain_points else None
        ))

        db_id = str(cur.fetchone()[0])

        # Insert default skill into DB so it shows in Skills screen
        cur2 = conn.cursor()
        cur2.execute("""
            INSERT INTO skills (client_id, name, s3_key)
            VALUES (%s, %s, %s)
        """, (db_id, 'analysis-template', f"{client_id}/skills/analysis-template.md"))
        conn.commit()
        cur2.close()
        conn.close()

        print(f"Created client: {client_id} (db: {db_id}) for company: {company_name}")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'client_id': client_id,
                'id': db_id,
                'status': 'created'
            })
        }

    except Exception as e:
        print(f"Error creating client: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


DEFAULT_SKILL_TEMPLATE = """# Analysis Skill -- Default Template

Edit this skill to customize how Claude analyzes this client's data. Each section shapes a different aspect of the analysis.

---

## Context

Who is this client? What do they do? What stage are they at?

- Industry:
- Business model:
- Company size:
- Key stakeholders:

---

## Focus Areas

What metrics, problems, or themes should the analysis prioritize?

1. Revenue and cash flow patterns
2. Operational bottlenecks
3. Customer acquisition and retention
4. Process inefficiencies
5. Data quality and gaps

---

## Ignore List

What should the analysis skip or de-prioritize?

- Do not focus on branding or marketing aesthetics
- Do not recommend complete platform rebuilds
- Do not speculate about competitor strategies without data

---

## Output Format

How should findings be structured?

- Lead with the single biggest insight -- the thing the CEO needs to hear Monday morning
- Use ASCII diagrams for any proposed system architecture
- Present database schemas as formatted tables (name | type | description)
- Number all recommendations and tie each to specific evidence from the data
- End with a concrete bottom line: what to do first and what it will cost

---

## Authority Boundaries

What should Claude recommend directly vs. flag for human review?

### Recommend Directly
- Process improvements based on clear data patterns
- Data schema designs based on the uploaded documents
- Quick wins achievable within 30 days
- Metrics to start tracking immediately

### Flag for Human Review
- Any recommendation requiring >$10K investment
- Staffing changes or organizational restructuring
- Technology platform migrations
- Regulatory or compliance-related decisions
- Anything requiring legal review
"""


def copy_default_skill(client_id):
    """Copy the default skill template to the client's skills folder in S3."""
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=f"{client_id}/skills/analysis-template.md",
            Body=DEFAULT_SKILL_TEMPLATE.strip(),
            ContentType='text/markdown'
        )
        print(f"Copied default skill to {client_id}/skills/analysis-template.md")
    except Exception as e:
        print(f"Error copying default skill: {e}")


def generate_client_config(company_name, website, contact_name, contact_title,
                           contact_linkedin, industry, description, pain_point,
                           contact_email='', contact_phone='', contacts=None, addresses=None,
                           future_plans='', pain_points=None):
    """Generate a client-config.md structured context document."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    sections = []
    sections.append(f"# Client Configuration -- {company_name}")
    sections.append(f"\n**Created:** {today}")
    sections.append("**Purpose:** Persistent context injected into every Claude analysis for this client.")
    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## Company Profile")
    sections.append("")
    sections.append(f"- **Company Name:** {company_name}")
    if website:
        sections.append(f"- **Website:** {website}")
    if industry:
        sections.append(f"- **Industry:** {industry}")
    if description:
        sections.append(f"- **Description:** {description}")

    # Multi-contact rendering
    if contacts and len(contacts) > 0:
        sections.append("")
        sections.append("## Contacts")
        for idx, c in enumerate(contacts):
            label = "### Primary Contact" if idx == 0 else f"### Contact {idx + 1}"
            sections.append("")
            sections.append(label)
            sections.append("")
            contact_full_name = f"{c.get('firstName', '')} {c.get('lastName', '')}".strip() or c.get('name', '')
            if contact_full_name:
                sections.append(f"- **Name:** {contact_full_name}")
            if c.get('title'):
                sections.append(f"- **Title:** {c['title']}")
            if c.get('linkedin'):
                sections.append(f"- **LinkedIn:** {c['linkedin']}")
            if c.get('email'):
                sections.append(f"- **Email:** {c['email']}")
            if c.get('phone'):
                sections.append(f"- **Phone:** {c['phone']}")
    elif contact_name or contact_title or contact_linkedin or contact_email or contact_phone:
        # Legacy single-contact fallback
        sections.append("")
        sections.append("## Primary Contact")
        sections.append("")
        if contact_name:
            sections.append(f"- **Name:** {contact_name}")
        if contact_title:
            sections.append(f"- **Title:** {contact_title}")
        if contact_linkedin:
            sections.append(f"- **LinkedIn:** {contact_linkedin}")
        if contact_email:
            sections.append(f"- **Email:** {contact_email}")
        if contact_phone:
            sections.append(f"- **Phone:** {contact_phone}")

    # Multi-address rendering
    if addresses and len(addresses) > 0:
        sections.append("")
        sections.append("## Addresses")
        for idx, a in enumerate(addresses):
            label = a.get('label', '')
            heading = f"### {label}" if label else ("### Primary Address" if idx == 0 else f"### Address {idx + 1}")
            sections.append("")
            sections.append(heading)
            sections.append("")
            if a.get('address1'):
                sections.append(f"- **Address:** {a['address1']}")
            if a.get('address2'):
                sections.append(f"- **Address 2:** {a['address2']}")
            parts = []
            if a.get('city'):
                parts.append(a['city'])
            if a.get('state'):
                parts.append(a['state'])
            if a.get('postalCode'):
                parts.append(a['postalCode'])
            if parts:
                sections.append(f"- **City/State/Zip:** {', '.join(parts)}")
            if a.get('country'):
                sections.append(f"- **Country:** {a['country']}")

    if future_plans:
        sections.append("")
        sections.append("## Future Plans")
        sections.append("")
        sections.append(f"{future_plans}")

    # Pain points: prefer structured array, fall back to legacy single field
    all_pain_points = pain_points if pain_points else ([pain_point] if pain_point else [])
    all_pain_points = [p for p in all_pain_points if p and p.strip()]
    if all_pain_points:
        sections.append("")
        sections.append("## Pain Points")
        sections.append("")
        for i, pp in enumerate(all_pain_points, 1):
            sections.append(f"{i}. {pp}")
        sections.append("")
        sections.append("These are the client's priorities. Every analysis should address these pain points.")

    sections.append("")
    sections.append("---")
    sections.append("")
    sections.append("## Analysis Instructions")
    sections.append("")
    sections.append("- Treat this client as a real business engagement, not a demo")
    sections.append("- Reference their specific data, not generic industry advice")
    sections.append("- Every recommendation must tie back to evidence from their documents")
    sections.append("- Use their company name and industry context throughout the analysis")

    return "\n".join(sections) + "\n"
