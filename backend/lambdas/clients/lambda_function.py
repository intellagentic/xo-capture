"""
XO Platform - POST /clients Lambda
Creates a new client with S3 folder structure and PostgreSQL record.
"""

import json
import os
import time
import hashlib
import boto3
from datetime import datetime, timezone
from auth_helper import require_auth, get_db_connection, CORS_HEADERS

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')


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

    # Auth check
    user, err = require_auth(event)
    if err:
        return err

    method = event.get('httpMethod', '')
    path = event.get('path', '')

    if path.endswith('/clients/list') and method == 'GET':
        return handle_list_clients(event, user)
    elif method == 'GET':
        return handle_get_client(event, user)
    elif method == 'PUT':
        return handle_update_client(event, user)
    elif method == 'POST':
        return handle_create_client(event, user)
    elif method == 'DELETE':
        return handle_delete_client(event, user)
    else:
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Method not allowed: {method}'})
        }


def handle_list_clients(event, user):
    """GET /clients/list — List all clients for the logged-in user with stats."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT c.id, c.company_name, c.industry, c.s3_folder, c.status,
                   c.created_at, c.updated_at,
                   (SELECT COUNT(*) FROM uploads u WHERE u.client_id = c.id AND u.status = 'active') as source_count,
                   (SELECT e.status FROM enrichments e WHERE e.client_id = c.id ORDER BY e.started_at DESC LIMIT 1) as last_enrichment_status,
                   (SELECT e.completed_at FROM enrichments e WHERE e.client_id = c.id ORDER BY e.started_at DESC LIMIT 1) as last_enrichment_date,
                   c.icon_s3_key
            FROM clients c WHERE c.user_id = %s ORDER BY c.updated_at DESC
        """, (user['user_id'],))

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
                'icon_url': icon_url
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
        if client_id:
            # Fetch specific client by s3_folder
            cur.execute("""
                SELECT id, company_name, website_url, contact_name, contact_title,
                       contact_linkedin, industry, description, pain_point,
                       s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                       COALESCE(streamline_webhook_enabled, FALSE),
                       contact_email, contact_phone
                FROM clients WHERE s3_folder = %s AND user_id = %s
            """, (client_id, user['user_id']))
        else:
            # Fetch most recent client for this user
            cur.execute("""
                SELECT id, company_name, website_url, contact_name, contact_title,
                       contact_linkedin, industry, description, pain_point,
                       s3_folder, created_at, updated_at, logo_s3_key, icon_s3_key,
                       COALESCE(streamline_webhook_enabled, FALSE),
                       contact_email, contact_phone
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

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'id': str(row[0]),
                'company_name': row[1] or '',
                'website': row[2] or '',
                'contactName': row[3] or '',
                'contactTitle': row[4] or '',
                'contactLinkedIn': row[5] or '',
                'industry': row[6] or '',
                'description': row[7] or '',
                'painPoint': row[8] or '',
                'client_id': row[9] or '',
                'created_at': row[10].isoformat() if row[10] else None,
                'updated_at': row[11].isoformat() if row[11] else None,
                'logo_url': logo_url,
                'icon_url': icon_url,
                'streamline_webhook_enabled': bool(row[14]),
                'contactEmail': row[15] or '',
                'contactPhone': row[16] or ''
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

        conn = get_db_connection()
        cur = conn.cursor()

        # Build dynamic SET clause — streamline_webhook_enabled is optional
        set_fields = [
            "company_name = %s", "website_url = %s", "contact_name = %s",
            "contact_title = %s", "contact_linkedin = %s",
            "contact_email = %s", "contact_phone = %s",
            "industry = %s",
            "description = %s", "pain_point = %s", "updated_at = NOW()"
        ]
        params = [
            company_name,
            body.get('website', '').strip(),
            body.get('contactName', '').strip(),
            body.get('contactTitle', '').strip(),
            body.get('contactLinkedIn', '').strip(),
            body.get('contactEmail', '').strip(),
            body.get('contactPhone', '').strip(),
            body.get('industry', '').strip(),
            body.get('description', '').strip(),
            body.get('painPoint', '').strip(),
        ]

        if 'streamline_webhook_enabled' in body:
            set_fields.append("streamline_webhook_enabled = %s")
            params.append(bool(body['streamline_webhook_enabled']))

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
            body.get('contactName', '').strip(),
            body.get('contactTitle', '').strip(),
            body.get('contactLinkedIn', '').strip(),
            body.get('industry', '').strip(),
            body.get('description', '').strip(),
            body.get('painPoint', '').strip(),
            contact_email=body.get('contactEmail', '').strip(),
            contact_phone=body.get('contactPhone', '').strip()
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

        # Verify ownership and get DB id
        cur.execute("""
            SELECT id FROM clients WHERE s3_folder = %s AND user_id = %s
        """, (client_id, user['user_id']))
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


def handle_create_client(event, user):
    """POST /clients — Create new client (original logic)."""
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        company_name = body.get('company_name', '').strip()
        website = body.get('website', '').strip()
        contact_name = body.get('contactName', '').strip()
        contact_title = body.get('contactTitle', '').strip()
        contact_linkedin = body.get('contactLinkedIn', '').strip()
        contact_email = body.get('contactEmail', '').strip()
        contact_phone = body.get('contactPhone', '').strip()
        industry = body.get('industry', '').strip()
        description = body.get('description', '').strip()
        pain_point = body.get('painPoint', '').strip()

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
            contact_email=contact_email, contact_phone=contact_phone
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

        cur.execute("""
            INSERT INTO clients (
                user_id, company_name, website_url, contact_name, contact_title,
                contact_linkedin, contact_email, contact_phone,
                industry, description, pain_point, s3_folder
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user['user_id'], company_name, website, contact_name, contact_title,
            contact_linkedin, contact_email, contact_phone,
            industry, description, pain_point, client_id
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
                           contact_email='', contact_phone=''):
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

    if contact_name or contact_title or contact_linkedin or contact_email or contact_phone:
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

    if pain_point:
        sections.append("")
        sections.append("## Immediate Pain Point")
        sections.append("")
        sections.append(f"{pain_point}")
        sections.append("")
        sections.append("This is the client's #1 priority. Every analysis should lead with this.")

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
