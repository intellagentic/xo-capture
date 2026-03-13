"""
XO Platform - Buttons Lambda
GET /buttons                          -- return buttons (system + client, or by scope)
PUT /buttons/sync                     -- full replace of buttons for a scope
DELETE /buttons?button_id=X           -- delete a single button

Query params for GET:
  ?scope=system       -- system buttons only (client_id IS NULL)
  ?scope=client&client_id=X  -- client buttons only
  ?client_id=X        -- combined: system + client buttons (for Welcome screen)
  (no params)         -- legacy: user's buttons

Query params for PUT body:
  { "scope": "system", "buttons": [...] }           -- sync system buttons (admin only)
  { "client_id": "X", "buttons": [...] }            -- sync client buttons
  { "buttons": [...] }                               -- legacy: sync user buttons
"""

import json
from auth_helper import require_auth, get_db_connection, CORS_HEADERS


# ── Auto-migration: add client_id column, make user_id nullable ──
def _run_button_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Add client_id column if missing
        cur.execute("""
            ALTER TABLE buttons
            ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE
        """)
        # Make user_id nullable (system buttons have no user)
        cur.execute("ALTER TABLE buttons ALTER COLUMN user_id DROP NOT NULL;")
        # Index for client_id lookups
        cur.execute("CREATE INDEX IF NOT EXISTS idx_buttons_client_id ON buttons(client_id);")
        conn.commit()
        cur.close()
        conn.close()
        print("Button migration complete: client_id added, user_id nullable")
    except Exception as e:
        print(f"Button migration check (non-fatal): {e}")

_run_button_migrations()


def lambda_handler(event, context):
    """Route to GET, PUT, or DELETE handler based on HTTP method."""

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Auth check
    user, err = require_auth(event)
    if err:
        return err

    method = event.get('httpMethod', '')

    if method == 'GET':
        return handle_get(event, user)
    elif method == 'PUT':
        return handle_sync(event, user)
    elif method == 'DELETE':
        return handle_delete(event, user)
    else:
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Method not allowed'})
        }


def handle_get(event, user):
    """Return buttons based on scope query params."""
    try:
        params = event.get('queryStringParameters') or {}
        scope = params.get('scope', '')
        client_id = params.get('client_id', '')

        conn = get_db_connection()
        cur = conn.cursor()

        if scope == 'system':
            # System buttons only (user_id IS NULL + client_id IS NULL)
            cur.execute("""
                SELECT id, name, icon, color, url, sort_order, client_id
                FROM buttons
                WHERE client_id IS NULL AND user_id IS NULL
                ORDER BY sort_order ASC
            """)
        elif scope == 'client' and client_id:
            # Client-specific buttons only
            cur.execute("""
                SELECT id, name, icon, color, url, sort_order, client_id
                FROM buttons
                WHERE client_id = %s
                ORDER BY sort_order ASC
            """, (client_id,))
        elif client_id:
            # Combined: system buttons first, then client buttons (for Welcome screen)
            cur.execute("""
                (SELECT id, name, icon, color, url, sort_order, client_id
                 FROM buttons WHERE client_id IS NULL AND user_id IS NULL ORDER BY sort_order ASC)
                UNION ALL
                (SELECT id, name, icon, color, url, sort_order, client_id
                 FROM buttons WHERE client_id = %s ORDER BY sort_order ASC)
            """, (client_id,))
        else:
            # Legacy: user's own buttons
            cur.execute("""
                SELECT id, name, icon, color, url, sort_order, client_id
                FROM buttons
                WHERE user_id = %s
                ORDER BY sort_order ASC
            """, (user['user_id'],))

        buttons = []
        for row in cur.fetchall():
            buttons.append({
                'id': str(row[0]),
                'label': row[1],
                'icon': row[2],
                'color': row[3],
                'url': row[4] or '',
                'sort_order': row[5],
                'scope': 'system' if row[6] is None else 'client'
            })

        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'buttons': buttons})
        }

    except Exception as e:
        print(f"Error fetching buttons: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_sync(event, user):
    """Full replace of buttons for a given scope."""
    try:
        body = json.loads(event.get('body', '{}'))
        buttons = body.get('buttons', [])
        scope = body.get('scope', '')
        client_id = body.get('client_id', '')

        conn = get_db_connection()
        cur = conn.cursor()

        if scope == 'system':
            # Admin only
            if not user.get('is_admin'):
                return {
                    'statusCode': 403,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Admin required for system buttons'})
                }
            # Delete existing system buttons (user_id IS NULL distinguishes from legacy user buttons)
            cur.execute("DELETE FROM buttons WHERE client_id IS NULL AND user_id IS NULL")
            # Insert new system buttons
            for i, btn in enumerate(buttons):
                cur.execute("""
                    INSERT INTO buttons (user_id, client_id, name, icon, color, url, sort_order)
                    VALUES (NULL, NULL, %s, %s, %s, %s, %s)
                """, (
                    btn.get('label', btn.get('name', 'Button')),
                    btn.get('icon', 'Zap'),
                    btn.get('color', '#3b82f6'),
                    btn.get('url', ''),
                    btn.get('sort_order', i)
                ))
            print(f"Synced {len(buttons)} system buttons by {user['email']}")

        elif client_id:
            # Client-specific buttons
            cur.execute("DELETE FROM buttons WHERE client_id = %s", (client_id,))
            for i, btn in enumerate(buttons):
                cur.execute("""
                    INSERT INTO buttons (user_id, client_id, name, icon, color, url, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    user['user_id'],
                    client_id,
                    btn.get('label', btn.get('name', 'Button')),
                    btn.get('icon', 'Zap'),
                    btn.get('color', '#3b82f6'),
                    btn.get('url', ''),
                    btn.get('sort_order', i)
                ))
            print(f"Synced {len(buttons)} client buttons for {client_id} by {user['email']}")

        else:
            # Legacy: user-level buttons (only delete user's own, not system buttons)
            cur.execute("DELETE FROM buttons WHERE user_id = %s", (user['user_id'],))
            for i, btn in enumerate(buttons):
                cur.execute("""
                    INSERT INTO buttons (user_id, client_id, name, icon, color, url, sort_order)
                    VALUES (%s, NULL, %s, %s, %s, %s, %s)
                """, (
                    user['user_id'],
                    btn.get('label', btn.get('name', 'Button')),
                    btn.get('icon', 'Zap'),
                    btn.get('color', '#3b82f6'),
                    btn.get('url', ''),
                    btn.get('sort_order', i)
                ))
            print(f"Synced {len(buttons)} buttons for user {user['email']}")

        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'status': 'synced', 'count': len(buttons)})
        }

    except Exception as e:
        print(f"Error syncing buttons: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_delete(event, user):
    """Delete a single button by ID."""
    try:
        params = event.get('queryStringParameters') or {}
        button_id = params.get('button_id', '')

        if not button_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'button_id required'})
            }

        conn = get_db_connection()
        cur = conn.cursor()

        # Check if it's a system button (admin required)
        cur.execute("SELECT client_id FROM buttons WHERE id = %s", (button_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Button not found'})
            }

        if row[0] is None and not user.get('is_admin'):
            cur.close()
            conn.close()
            return {
                'statusCode': 403,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Admin required for system buttons'})
            }

        cur.execute("DELETE FROM buttons WHERE id = %s", (button_id,))
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'status': 'deleted'})
        }

    except Exception as e:
        print(f"Error deleting button: {e}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }
