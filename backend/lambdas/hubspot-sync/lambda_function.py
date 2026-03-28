"""
XO Platform - HubSpot Bi-directional Sync Lambda
Private App token auth, push/pull sync between XO Capture and HubSpot CRM.
Routes on HTTP method + path, same pattern as clients lambda.
"""

import json
import os
import time
import hashlib
import secrets
import logging
import urllib.parse
from datetime import datetime, timezone

import requests

from auth_helper import require_auth, get_db_connection, CORS_HEADERS, log_activity
try:
    from crypto_helper import (
        encrypt, decrypt, unwrap_client_key,
        client_decrypt, client_decrypt_json
    )
except ImportError:
    import json as _json
    def encrypt(x): return x
    def decrypt(x): return x
    def unwrap_client_key(x): return None
    def client_decrypt(k, x): return x
    def client_decrypt_json(k, x):
        if not x: return None
        try: return _json.loads(x)
        except: return None

logger = logging.getLogger('xo.hubspot')
logger.setLevel(logging.INFO)

# ── HubSpot Private App Config ──
HUBSPOT_PRIVATE_TOKEN = os.environ.get('HUBSPOT_PRIVATE_TOKEN', '')
HUBSPOT_API_BASE = 'https://api.hubapi.com'

# Field mapping: XO clients -> HubSpot Company standard properties
FIELD_MAP_CLIENT_TO_COMPANY = {
    'company_name': 'name',
    'website_url': 'website',
    'description': 'description',
}

# Custom properties in HubSpot (XO field -> HS property name)
CUSTOM_PROPS = {
    'industry': 'xo_industry',
    'future_plans': 'xo_future_plans',
    'status': 'xo_status',
    'source': 'xo_source',
    'nda_signed': 'xo_nda_signed',
    'nda_signed_at': 'xo_nda_signed_at',
    'intellagentic_lead': 'xo_intellagentic_lead',
    'pain_points_json': 'xo_pain_points_json',
    'addresses_json': 'xo_addresses_json',
}

# Custom property definitions to auto-create in HubSpot
CUSTOM_PROPERTY_DEFS = [
    {'name': 'xo_record_type', 'label': 'XO Record Type', 'type': 'string', 'fieldType': 'text',
     'groupName': 'companyinformation', 'description': 'XO Capture record type (client or partner)'},
    {'name': 'xo_client_id', 'label': 'XO Client ID', 'type': 'string', 'fieldType': 'text',
     'groupName': 'companyinformation', 'description': 'XO Capture UUID back-reference'},
    {'name': 'xo_industry', 'label': 'XO Industry', 'type': 'string', 'fieldType': 'text',
     'groupName': 'companyinformation', 'description': 'Industry/vertical (free text from XO Capture)'},
    {'name': 'xo_status', 'label': 'XO Status', 'type': 'string', 'fieldType': 'text',
     'groupName': 'companyinformation', 'description': 'Client status in XO Capture'},
    {'name': 'xo_source', 'label': 'XO Source', 'type': 'string', 'fieldType': 'text',
     'groupName': 'companyinformation', 'description': 'Client source (invite, manual, etc.)'},
    {'name': 'xo_nda_signed', 'label': 'XO NDA Signed', 'type': 'enumeration', 'fieldType': 'booleancheckbox',
     'groupName': 'companyinformation', 'description': 'NDA signed status',
     'options': [{'label': 'True', 'value': 'true'}, {'label': 'False', 'value': 'false'}]},
    {'name': 'xo_nda_signed_at', 'label': 'XO NDA Signed At', 'type': 'datetime', 'fieldType': 'date',
     'groupName': 'companyinformation', 'description': 'When NDA was signed'},
    {'name': 'xo_intellagentic_lead', 'label': 'XO Intellagentic Lead', 'type': 'enumeration', 'fieldType': 'booleancheckbox',
     'groupName': 'companyinformation', 'description': 'Intellagentic lead flag',
     'options': [{'label': 'True', 'value': 'true'}, {'label': 'False', 'value': 'false'}]},
    {'name': 'xo_future_plans', 'label': 'XO Future Plans', 'type': 'string', 'fieldType': 'textarea',
     'groupName': 'companyinformation', 'description': 'Client future plans'},
    {'name': 'xo_pain_points_json', 'label': 'XO Pain Points', 'type': 'string', 'fieldType': 'textarea',
     'groupName': 'companyinformation', 'description': 'JSON array of pain points'},
    {'name': 'xo_addresses_json', 'label': 'XO Addresses', 'type': 'string', 'fieldType': 'textarea',
     'groupName': 'companyinformation', 'description': 'JSON array of addresses'},
    {'name': 'xo_sync_enabled', 'label': 'Sync to XO Capture', 'type': 'enumeration', 'fieldType': 'booleancheckbox',
     'groupName': 'companyinformation', 'description': 'Enable to pull this company into XO Capture during sync',
     'options': [{'label': 'True', 'value': 'true'}, {'label': 'False', 'value': 'false'}]},
]

_properties_ensured = False

def _ensure_custom_properties(access_token):
    """Create custom HubSpot company properties if they don't exist. Runs once per container."""
    global _properties_ensured
    if _properties_ensured:
        return
    for prop_def in CUSTOM_PROPERTY_DEFS:
        try:
            _hubspot_api('POST', '/crm/v3/properties/companies', access_token, json_body=prop_def)
            logger.info("Created HubSpot property: %s", prop_def['name'])
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 409:
                pass  # Already exists
            else:
                logger.warning("Failed to create property %s: %s", prop_def['name'], e)
        except Exception as e:
            logger.warning("Failed to create property %s: %s", prop_def['name'], e)
    _properties_ensured = True


# ── Auto-migration: add HubSpot columns ──
def _run_hubspot_migrations():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Clients table
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_company_id VARCHAR(50);")
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(50);")
        cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_last_sync TIMESTAMP;")
        # Partners table
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS hubspot_company_id VARCHAR(50);")
        cur.execute("ALTER TABLE partners ADD COLUMN IF NOT EXISTS hubspot_last_sync TIMESTAMP;")
        # system_config table (should already exist from clients lambda)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                config_key VARCHAR(255) UNIQUE NOT NULL,
                config_value TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        # Sync log table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS hubspot_sync_log (
                id SERIAL PRIMARY KEY,
                record_type VARCHAR(20) NOT NULL,
                record_id UUID,
                hubspot_id VARCHAR(50),
                sync_direction VARCHAR(10) NOT NULL,
                fields_updated TEXT,
                fields_skipped TEXT,
                details TEXT,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("HubSpot migration complete: hubspot columns + sync_log ensured")
    except Exception as e:
        print(f"HubSpot migration check (non-fatal): {e}")

_run_hubspot_migrations()


# ── System Config Helpers ──

def _get_config(conn, key):
    """Read a value from system_config table."""
    cur = conn.cursor()
    cur.execute("SELECT config_value FROM system_config WHERE config_key = %s", (key,))
    row = cur.fetchone()
    cur.close()
    return row[0] if row else None


def _set_config(conn, key, value):
    """Upsert a value in system_config table."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO system_config (config_key, config_value, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()
    """, (key, value))
    conn.commit()
    cur.close()


# ── Sync Logging ──

def _log_sync(conn, record_type, record_id, hubspot_id, direction, fields_updated=None,
              fields_skipped=None, details=None):
    """Write an entry to hubspot_sync_log."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO hubspot_sync_log (record_type, record_id, hubspot_id, sync_direction,
                                      fields_updated, fields_skipped, details)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        record_type,
        str(record_id) if record_id else None,
        hubspot_id,
        direction,
        json.dumps(fields_updated) if fields_updated else None,
        json.dumps(fields_skipped) if fields_skipped else None,
        details,
    ))
    cur.close()


# Fields compared for conflict detection (XO DB column -> HubSpot property)
SYNC_COMPARE_FIELDS = {
    'company_name': 'name',
    'website_url': 'website',
    'industry': 'xo_industry',
    'description': 'description',
    'future_plans': 'xo_future_plans',
    'status': 'xo_status',
    'source': 'xo_source',
    'pain_points_json': 'xo_pain_points_json',
    'addresses_json': 'xo_addresses_json',
}


def _parse_hs_timestamp(ts_str):
    """Parse a HubSpot ISO timestamp string to a timezone-aware datetime."""
    if not ts_str:
        return None
    try:
        # HubSpot returns millisecond timestamps like "2026-03-28T10:00:00.000Z"
        ts_str = ts_str.replace('Z', '+00:00')
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


def _make_aware(dt):
    """Ensure a datetime is timezone-aware (assume UTC if naive)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _determine_sync_direction(xo_updated_at, hs_lastmodified, last_sync):
    """Determine which side wins based on timestamps.

    Returns:
        'first_sync' — hubspot_last_sync is NULL, HubSpot is authoritative
        'push'       — only XO changed since last sync
        'pull'       — only HubSpot changed since last sync
        'conflict'   — both sides changed since last sync
        'none'       — neither side changed
    """
    if last_sync is None:
        return 'first_sync'

    last_sync = _make_aware(last_sync)
    xo_updated_at = _make_aware(xo_updated_at)
    hs_lastmodified = _make_aware(hs_lastmodified)

    xo_changed = xo_updated_at and xo_updated_at > last_sync
    hs_changed = hs_lastmodified and hs_lastmodified > last_sync

    if xo_changed and hs_changed:
        return 'conflict'
    elif xo_changed:
        return 'push'
    elif hs_changed:
        return 'pull'
    else:
        return 'none'


def _detect_field_conflicts(xo_record, hs_props, client_key=None):
    """Compare XO record fields with HubSpot properties. Returns dict of {field: (xo_val, hs_val)}."""
    conflicts = {}
    for xo_field, hs_field in SYNC_COMPARE_FIELDS.items():
        xo_val = xo_record.get(xo_field, '') or ''
        if client_key and xo_val and xo_field not in ('status', 'source'):
            xo_val = _decrypt_field(client_key, xo_val)
        xo_val = str(xo_val).strip() if xo_val else ''

        hs_val = str(hs_props.get(hs_field, '') or '').strip()

        if xo_val != hs_val and (xo_val or hs_val):
            conflicts[xo_field] = (xo_val, hs_val)
    return conflicts


# ── HubSpot Token Management ──

def _get_access_token(conn=None):
    """Return the HubSpot Private App bearer token from env var."""
    return HUBSPOT_PRIVATE_TOKEN or None


def _hubspot_api(method, path, access_token, json_body=None, params=None):
    """Make an authenticated HubSpot CRM API call."""
    url = f"{HUBSPOT_API_BASE}{path}"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }
    resp = requests.request(method, url, headers=headers, json=json_body, params=params, timeout=30)
    if not resp.ok:
        error_body = resp.text[:1000] if resp.text else '(empty)'
        logger.error("HubSpot API %s %s -> %s: %s", method, path, resp.status_code, error_body)
        resp.raise_for_status()
    return resp.json() if resp.content else {}


# ── Client Key Helper ──

def _get_client_key_by_id(cur, db_client_id):
    """Look up and unwrap a client's encryption key by DB id."""
    try:
        cur.execute("SELECT encryption_key FROM clients WHERE id = %s", (db_client_id,))
        row = cur.fetchone()
        if row and row[0]:
            return unwrap_client_key(row[0])
    except Exception as e:
        print(f"Failed to get client key by id (non-fatal): {e}")
    return None


# ── Dedup Logic ──

def _normalize_domain(url):
    """Normalize a URL/domain for dedup comparison.
    Lowercase, strip protocol, www prefix, trailing slashes, and path."""
    if not url:
        return ''
    d = url.lower().strip()
    for prefix in ('https://', 'http://'):
        if d.startswith(prefix):
            d = d[len(prefix):]
            break
    if d.startswith('www.'):
        d = d[4:]
    # Strip path and trailing slashes
    d = d.split('/')[0].rstrip('.')
    return d


def _find_hubspot_company(access_token, domain=None, company_name=None):
    """Search HubSpot for existing company by domain (exact) or name (fuzzy).
    Domain is normalized before search — also searches the website property."""
    normalized = _normalize_domain(domain)

    # Try domain/website match first
    if normalized:
        # Search both 'domain' and 'website' properties
        for prop_name in ('domain', 'website'):
            try:
                resp = _hubspot_api('POST', '/crm/v3/objects/companies/search', access_token, json_body={
                    'filterGroups': [{
                        'filters': [{
                            'propertyName': prop_name,
                            'operator': 'CONTAINS_TOKEN',
                            'value': normalized,
                        }]
                    }],
                    'properties': ['name', 'domain', 'website', 'xo_client_id', 'xo_record_type'],
                    'limit': 10,
                })
                results = resp.get('results', [])
                for r in results:
                    rp = r.get('properties', {})
                    hs_domain = _normalize_domain(rp.get('domain', ''))
                    hs_website = _normalize_domain(rp.get('website', ''))
                    if normalized == hs_domain or normalized == hs_website:
                        return r
            except Exception as e:
                logger.warning("HubSpot %s search failed: %s", prop_name, e)

    # Fall back to company name fuzzy match
    if company_name:
        try:
            resp = _hubspot_api('POST', '/crm/v3/objects/companies/search', access_token, json_body={
                'filterGroups': [{
                    'filters': [{
                        'propertyName': 'name',
                        'operator': 'CONTAINS_TOKEN',
                        'value': company_name,
                    }]
                }],
                'properties': ['name', 'domain', 'website', 'xo_client_id', 'xo_record_type'],
                'limit': 5,
            })
            results = resp.get('results', [])
            if results:
                # Pick best match — exact name match preferred
                for r in results:
                    if r.get('properties', {}).get('name', '').lower() == company_name.lower():
                        return r
                return results[0]
        except Exception as e:
            logger.warning("HubSpot name search failed: %s", e)

    return None


def _find_hubspot_contact(access_token, email):
    """Search HubSpot for existing contact by email."""
    if not email:
        return None
    try:
        resp = _hubspot_api('POST', '/crm/v3/objects/contacts/search', access_token, json_body={
            'filterGroups': [{
                'filters': [{
                    'propertyName': 'email',
                    'operator': 'EQ',
                    'value': email,
                }]
            }],
            'properties': ['firstname', 'lastname', 'email', 'phone', 'jobtitle'],
            'limit': 1,
        })
        results = resp.get('results', [])
        return results[0] if results else None
    except Exception as e:
        logger.warning("HubSpot contact search failed: %s", e)
        return None


# ── Sync: XO -> HubSpot ──

def _split_name(full_name):
    """Split a full name into (first, last)."""
    if not full_name:
        return '', ''
    parts = full_name.strip().split(None, 1)
    return parts[0], parts[1] if len(parts) > 1 else ''


def _decrypt_field(client_key, value):
    """Decrypt a single field value if client_key is available."""
    if client_key and value:
        return client_decrypt(client_key, value)
    return value or ''


def _parse_json_field(client_key, raw):
    """Parse a JSON text field, decrypting first if needed."""
    if not raw:
        return None
    if client_key:
        parsed = client_decrypt_json(client_key, raw)
        if parsed:
            return parsed
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError):
        return None


def _build_company_properties(record, record_type, client_key=None):
    """Build HubSpot company properties from a DB record dict."""
    props = {'xo_record_type': record_type}

    # Standard fields
    name = record.get('company_name') or record.get('name') or ''
    name = _decrypt_field(client_key, name)
    if name:
        props['name'] = name

    website = record.get('website_url') or record.get('website') or ''
    website = _decrypt_field(client_key, website)
    if website:
        props['website'] = website

    industry = _decrypt_field(client_key, record.get('industry', ''))
    if industry:
        props['xo_industry'] = industry

    description = _decrypt_field(client_key, record.get('description', ''))
    if description:
        props['description'] = description

    # Custom properties
    future_plans = _decrypt_field(client_key, record.get('future_plans', ''))
    if future_plans:
        props['xo_future_plans'] = future_plans

    if 'status' in record and record['status']:
        props['xo_status'] = record['status']

    if 'source' in record and record['source']:
        props['xo_source'] = record['source']

    if 'nda_signed' in record and record['nda_signed'] is not None:
        props['xo_nda_signed'] = str(record['nda_signed']).lower()

    if 'nda_signed_at' in record and record['nda_signed_at']:
        nda_at = record['nda_signed_at']
        # HubSpot datetime properties expect Unix epoch milliseconds
        if hasattr(nda_at, 'timestamp'):
            props['xo_nda_signed_at'] = str(int(nda_at.timestamp() * 1000))
        else:
            try:
                from datetime import datetime as _dt
                parsed = _dt.fromisoformat(str(nda_at).replace('Z', '+00:00'))
                props['xo_nda_signed_at'] = str(int(parsed.timestamp() * 1000))
            except (ValueError, TypeError):
                pass  # Skip if unparseable

    if 'intellagentic_lead' in record and record['intellagentic_lead'] is not None:
        props['xo_intellagentic_lead'] = str(record['intellagentic_lead']).lower()

    # pain_points_json -> custom property (full JSON text)
    pain_points_raw = record.get('pain_points_json', '')
    if pain_points_raw:
        pain_points = _parse_json_field(client_key, pain_points_raw)
        if pain_points:
            props['xo_pain_points_json'] = json.dumps(pain_points)

    # addresses_json -> custom property (full JSON text) + standard address from first entry
    addresses_raw = record.get('addresses_json')
    if addresses_raw:
        addresses = _parse_json_field(client_key, addresses_raw)
        if addresses and isinstance(addresses, list):
            props['xo_addresses_json'] = json.dumps(addresses)
            if len(addresses) > 0:
                addr = addresses[0]
                if addr.get('address1'):
                    props['address'] = addr['address1']
                if addr.get('address2'):
                    props['address2'] = addr['address2']
                if addr.get('city'):
                    props['city'] = addr['city']
                if addr.get('state'):
                    props['state'] = addr['state']
                if addr.get('postalCode'):
                    props['zip'] = addr['postalCode']
                if addr.get('country'):
                    props['country'] = addr['country']

    # XO client ID for back-reference
    if record.get('id'):
        props['xo_client_id'] = str(record['id'])

    return props


def _build_contact_properties_from_obj(contact_obj, client_key=None):
    """Build HubSpot contact properties from a single contact JSON object.
    Contact object: {name, email, phone, title, linkedin}."""
    props = {}

    name = _decrypt_field(client_key, contact_obj.get('name', ''))
    first, last = _split_name(name)
    if first:
        props['firstname'] = first
    if last:
        props['lastname'] = last

    email = _decrypt_field(client_key, contact_obj.get('email', ''))
    if email:
        props['email'] = email

    phone = _decrypt_field(client_key, contact_obj.get('phone', ''))
    if phone:
        props['phone'] = phone

    title = _decrypt_field(client_key, contact_obj.get('title', ''))
    if title:
        props['jobtitle'] = title

    return props


def _push_company(access_token, record, record_type, client_key=None):
    """Push a single company record to HubSpot (create or update). Returns HubSpot company ID."""
    props = _build_company_properties(record, record_type, client_key)
    hs_id = record.get('hubspot_company_id')

    domain = props.get('website') or props.get('domain')
    name = props.get('name')

    if not hs_id:
        # Check for existing company in HubSpot (dedup)
        existing = _find_hubspot_company(access_token, domain=domain, company_name=name)
        if existing:
            hs_id = existing['id']

    if hs_id:
        # Update existing
        _hubspot_api('PATCH', f'/crm/v3/objects/companies/{hs_id}', access_token, json_body={'properties': props})
        logger.info("Updated HubSpot company %s (%s)", hs_id, name)
    else:
        # Create new
        resp = _hubspot_api('POST', '/crm/v3/objects/companies', access_token, json_body={'properties': props})
        hs_id = resp['id']
        logger.info("Created HubSpot company %s (%s)", hs_id, name)

    return hs_id


def _push_single_contact(access_token, contact_props, company_id, existing_hs_id=None):
    """Push one contact to HubSpot and associate with company. Returns HubSpot contact ID."""
    if not contact_props.get('email'):
        return None

    hs_contact_id = existing_hs_id

    if not hs_contact_id:
        existing = _find_hubspot_contact(access_token, contact_props.get('email'))
        if existing:
            hs_contact_id = existing['id']

    if hs_contact_id:
        _hubspot_api('PATCH', f'/crm/v3/objects/contacts/{hs_contact_id}', access_token, json_body={'properties': contact_props})
        logger.info("Updated HubSpot contact %s (%s)", hs_contact_id, contact_props.get('email'))
    else:
        resp = _hubspot_api('POST', '/crm/v3/objects/contacts', access_token, json_body={'properties': contact_props})
        hs_contact_id = resp['id']
        logger.info("Created HubSpot contact %s (%s)", hs_contact_id, contact_props.get('email'))

    # Associate contact with company
    if company_id:
        try:
            _hubspot_api('PUT',
                f'/crm/v3/objects/contacts/{hs_contact_id}/associations/companies/{company_id}/contact_to_company',
                access_token)
        except Exception as e:
            logger.warning("Failed to associate contact %s with company %s: %s", hs_contact_id, company_id, e)

    return hs_contact_id


def _push_contacts(access_token, record, company_id, client_key=None):
    """Push all contacts from contacts_json to HubSpot. Returns primary (first) contact ID."""
    contacts_raw = record.get('contacts_json')
    contacts = _parse_json_field(client_key, contacts_raw) if contacts_raw else None
    if not contacts or not isinstance(contacts, list):
        return None

    primary_hs_id = None
    for i, contact_obj in enumerate(contacts):
        props = _build_contact_properties_from_obj(contact_obj, client_key)
        if not props.get('email'):
            continue
        # Only the first contact uses the stored hubspot_contact_id
        existing_id = record.get('hubspot_contact_id') if i == 0 else None
        try:
            hs_id = _push_single_contact(access_token, props, company_id, existing_hs_id=existing_id)
            if i == 0:
                primary_hs_id = hs_id
        except Exception as e:
            logger.warning("Failed to push contact %s: %s", props.get('email', '?'), e)

    return primary_hs_id


def _create_company_association(access_token, from_company_id, to_company_id, label='Channel Partner'):
    """Create a company-to-company association in HubSpot."""
    try:
        _hubspot_api('PUT',
            f'/crm/v3/objects/companies/{from_company_id}/associations/companies/{to_company_id}/company_to_company',
            access_token)
        logger.info("Associated company %s -> %s (%s)", from_company_id, to_company_id, label)
    except Exception as e:
        logger.warning("Failed to create company association %s -> %s: %s", from_company_id, to_company_id, e)


def _push_enrichment_note(access_token, company_id, client_record, client_key=None):
    """Push latest enrichment summary as a Note on the HubSpot Company."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT results_s3_key FROM enrichments
            WHERE client_id = %s AND status = 'complete'
            ORDER BY completed_at DESC LIMIT 1
        """, (str(client_record['id']),))
        row = cur.fetchone()
        if not row:
            return

        # Read results from S3 — enrichment results are stored as JSON
        import boto3
        s3 = boto3.client('s3')
        bucket = os.environ.get('BUCKET_NAME', 'xo-client-data-mv')
        obj = s3.get_object(Bucket=bucket, Key=row[0])
        body = obj['Body'].read().decode('utf-8')

        try:
            results = json.loads(body)
        except json.JSONDecodeError:
            return

        summary = results.get('summary', '')
        bottom_line = results.get('bottom_line', '')
        if not summary and not bottom_line:
            return

        note_body = f"**XO Capture Enrichment Summary**\n\n"
        if bottom_line:
            note_body += f"**Bottom Line:** {bottom_line}\n\n"
        if summary:
            note_body += f"{summary}"

        # Create engagement note via v3 API
        note_props = {
            'hs_note_body': note_body,
            'hs_timestamp': datetime.now(timezone.utc).isoformat(),
        }
        resp = _hubspot_api('POST', '/crm/v3/objects/notes', access_token, json_body={
            'properties': note_props,
        })
        note_id = resp.get('id')

        if note_id and company_id:
            try:
                _hubspot_api('PUT',
                    f'/crm/v3/objects/notes/{note_id}/associations/companies/{company_id}/note_to_company',
                    access_token)
            except Exception as e:
                logger.warning("Failed to associate note with company: %s", e)

    except Exception as e:
        logger.warning("Failed to push enrichment note: %s", e)
    finally:
        cur.close()
        conn.close()


# ── Sync: HubSpot -> XO ──

def _pull_companies(access_token, conn, record_type='client'):
    """Pull companies from HubSpot with given xo_record_type into XO.
    Returns (created, updated, conflicts_list)."""
    cur = conn.cursor()
    created = 0
    updated = 0
    conflicts_list = []

    try:
        after = None
        while True:
            params = {
                'limit': 100,
                'properties': 'name,website,description,xo_industry,'
                              'xo_client_id,xo_record_type,xo_status,xo_source,'
                              'xo_nda_signed,xo_nda_signed_at,xo_intellagentic_lead,'
                              'xo_future_plans,xo_pain_points_json,xo_addresses_json,xo_sync_enabled,'
                              'address,address2,city,state,zip,country,'
                              'hs_lastmodifieddate',
            }
            if after:
                params['after'] = after

            resp = _hubspot_api('GET', '/crm/v3/objects/companies', access_token, params=params)
            results = resp.get('results', [])

            for company in results:
                props = company.get('properties', {})
                hs_record_type = props.get('xo_record_type', '')
                sync_enabled = (props.get('xo_sync_enabled', '') or '').lower() == 'true'
                xo_id = props.get('xo_client_id')

                # Process if: matches record_type, OR has xo_sync_enabled and is a client pull
                if hs_record_type == record_type:
                    pass  # explicit match — process
                elif record_type == 'client' and sync_enabled and not hs_record_type:
                    pass  # tagged for sync, no record_type yet — treat as client
                else:
                    continue

                hs_id = company['id']

                if record_type == 'client':
                    conflict = _pull_client_record(cur, conn, hs_id, xo_id, props)
                    if conflict:
                        conflicts_list.append(conflict)
                elif record_type == 'partner':
                    _pull_partner_record(cur, conn, hs_id, xo_id, props)

                if xo_id:
                    updated += 1
                else:
                    created += 1

            # Pagination
            paging = resp.get('paging', {})
            next_page = paging.get('next', {})
            after = next_page.get('after')
            if not after:
                break

        conn.commit()
    except Exception as e:
        logger.error("Failed to pull %s companies from HubSpot: %s", record_type, e)
        conn.rollback()
    finally:
        cur.close()

    return created, updated, conflicts_list


def _apply_hs_to_xo_update(cur, hs_id, xo_id, props, where_clause, where_params):
    """Apply HubSpot property values to an XO client record (pull update)."""
    name = props.get('name', '')
    website = props.get('website', '')
    industry = props.get('xo_industry', '')
    description = props.get('description', '')
    status = props.get('xo_status', '')
    source = props.get('xo_source', '')
    future_plans = props.get('xo_future_plans', '')
    nda_signed = props.get('xo_nda_signed', '')
    intellagentic_lead = props.get('xo_intellagentic_lead', '')
    pain_points = props.get('xo_pain_points_json', '')
    addresses = props.get('xo_addresses_json', '')
    nda_bool = nda_signed.lower() == 'true' if nda_signed else None
    lead_bool = intellagentic_lead.lower() == 'true' if intellagentic_lead else None

    cur.execute(f"""
        UPDATE clients SET
            company_name = COALESCE(NULLIF(%s, ''), company_name),
            website_url = COALESCE(NULLIF(%s, ''), website_url),
            industry = COALESCE(NULLIF(%s, ''), industry),
            description = COALESCE(NULLIF(%s, ''), description),
            future_plans = COALESCE(NULLIF(%s, ''), future_plans),
            status = COALESCE(NULLIF(%s, ''), status),
            source = COALESCE(NULLIF(%s, ''), source),
            nda_signed = COALESCE(%s, nda_signed),
            intellagentic_lead = COALESCE(%s, intellagentic_lead),
            pain_points_json = COALESCE(NULLIF(%s, ''), pain_points_json),
            addresses_json = COALESCE(NULLIF(%s, ''), addresses_json),
            hubspot_company_id = %s,
            hubspot_last_sync = NOW(),
            updated_at = NOW()
        WHERE {where_clause}
    """, (name, website, industry, description, future_plans,
          status, source, nda_bool, lead_bool, pain_points, addresses,
          hs_id, *where_params))

    # Return list of fields that had values
    updated_fields = []
    for label, val in [('company_name', name), ('website_url', website), ('industry', industry),
                       ('description', description), ('future_plans', future_plans),
                       ('status', status), ('source', source), ('pain_points_json', pain_points),
                       ('addresses_json', addresses)]:
        if val:
            updated_fields.append(label)
    if nda_bool is not None:
        updated_fields.append('nda_signed')
    if lead_bool is not None:
        updated_fields.append('intellagentic_lead')
    return updated_fields


def _pull_client_record(cur, conn, hs_id, xo_id, props):
    """Create or update a client record from HubSpot company data.
    Uses timestamp-based conflict resolution. Returns conflict dict if conflict detected, else None."""
    name = props.get('name', '')
    website = props.get('website', '')
    hs_lastmodified = _parse_hs_timestamp(props.get('hs_lastmodifieddate'))

    # --- New record: no xo_id and no existing link ---
    if not xo_id:
        cur.execute("SELECT id, hubspot_last_sync, updated_at FROM clients WHERE hubspot_company_id = %s", (hs_id,))
        existing = cur.fetchone()
        if existing:
            xo_id = str(existing[0])
            last_sync = existing[1]
            xo_updated_at = existing[2]
        else:
            # Only create new XO records if xo_sync_enabled is true
            sync_enabled = (props.get('xo_sync_enabled', '') or '').lower() == 'true'
            if not sync_enabled:
                return None
            # Brand new record from HubSpot — create it
            s3_folder = f"hubspot-{hs_id}-{int(time.time())}"
            status_val = props.get('xo_status', '') or 'active'
            nda_str = props.get('xo_nda_signed', '')
            nda_bool = nda_str.lower() == 'true' if nda_str else None
            lead_str = props.get('xo_intellagentic_lead', '')
            lead_bool = lead_str.lower() == 'true' if lead_str else None

            cur.execute("""
                INSERT INTO clients (company_name, website_url, industry, description,
                                     future_plans, status, source, nda_signed, intellagentic_lead,
                                     pain_points_json, addresses_json, s3_folder,
                                     hubspot_company_id, hubspot_last_sync)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (name, website, props.get('xo_industry', ''), props.get('description', ''),
                  props.get('xo_future_plans', ''), status_val, props.get('xo_source', ''),
                  nda_bool, lead_bool, props.get('xo_pain_points_json', ''),
                  props.get('xo_addresses_json', ''), s3_folder, hs_id))
            new_row = cur.fetchone()
            new_id = str(new_row[0]) if new_row else None

            all_fields = [f for f in SYNC_COMPARE_FIELDS.keys() if props.get(SYNC_COMPARE_FIELDS[f])]
            _log_sync(conn, 'client', new_id, hs_id, 'pull', fields_updated=all_fields,
                      details=f"New client created from HubSpot: {name}")
            return None
    else:
        # Existing xo_id — look up timestamps
        cur.execute("SELECT hubspot_last_sync, updated_at FROM clients WHERE id = %s", (xo_id,))
        row = cur.fetchone()
        if not row:
            return None
        last_sync = row[0]
        xo_updated_at = row[1]

    # --- Determine sync direction ---
    direction = _determine_sync_direction(xo_updated_at, hs_lastmodified, last_sync)

    if direction == 'first_sync' or direction == 'pull':
        # HubSpot wins — apply all fields
        updated = _apply_hs_to_xo_update(cur, hs_id, xo_id, props, 'id = %s', (xo_id,))
        _log_sync(conn, 'client', xo_id, hs_id, 'pull', fields_updated=updated,
                  details=f"{'First sync' if direction == 'first_sync' else 'HubSpot newer'}: {name}")
        return None

    elif direction == 'push':
        # XO wins — just update hubspot_last_sync, don't overwrite XO
        cur.execute("UPDATE clients SET hubspot_last_sync = NOW() WHERE id = %s", (xo_id,))
        _log_sync(conn, 'client', xo_id, hs_id, 'push',
                  details=f"XO newer, skipped pull: {name}")
        return None

    elif direction == 'conflict':
        # Both sides changed — detect which fields conflict
        # Read current XO record for comparison
        cur.execute("""
            SELECT company_name, website_url, industry, description, future_plans,
                   status, source, pain_points_json, addresses_json, encryption_key
            FROM clients WHERE id = %s
        """, (xo_id,))
        xo_row = cur.fetchone()
        if not xo_row:
            return None
        xo_cols = ['company_name', 'website_url', 'industry', 'description', 'future_plans',
                    'status', 'source', 'pain_points_json', 'addresses_json', 'encryption_key']
        xo_record = dict(zip(xo_cols, xo_row))
        client_key = unwrap_client_key(xo_record.pop('encryption_key', None))

        field_conflicts = _detect_field_conflicts(xo_record, props, client_key)
        if not field_conflicts:
            # No actual field differences — just update sync timestamp
            cur.execute("UPDATE clients SET hubspot_last_sync = NOW() WHERE id = %s", (xo_id,))
            return None

        conflicting_fields = list(field_conflicts.keys())
        details_parts = []
        for f, (xo_v, hs_v) in field_conflicts.items():
            xo_display = (xo_v[:80] + '...') if len(xo_v) > 80 else xo_v
            hs_display = (hs_v[:80] + '...') if len(hs_v) > 80 else hs_v
            details_parts.append(f"{f}: XO=\"{xo_display}\" vs HS=\"{hs_display}\"")

        details_text = f"Conflict on {name}: " + "; ".join(details_parts)

        _log_sync(conn, 'client', xo_id, hs_id, 'conflict',
                  fields_skipped=conflicting_fields, details=details_text)

        logger.warning("Conflict detected for client %s (%s): %s", xo_id, name, conflicting_fields)
        return {
            'record_type': 'client',
            'record_id': str(xo_id),
            'hubspot_id': hs_id,
            'company_name': name,
            'conflicting_fields': conflicting_fields,
            'details': details_text,
        }

    # direction == 'none'
    return None


def _pull_partner_record(cur, conn, hs_id, xo_id, props):
    """Create or update a partner record from HubSpot company data."""
    name = props.get('name', '')

    if xo_id:
        cur.execute("""
            UPDATE partners SET
                name = COALESCE(NULLIF(%s, ''), name),
                hubspot_company_id = %s,
                hubspot_last_sync = NOW(),
                updated_at = NOW()
            WHERE id = %s
        """, (name, hs_id, xo_id))
    else:
        cur.execute("SELECT id FROM partners WHERE hubspot_company_id = %s", (hs_id,))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE partners SET
                    name = COALESCE(NULLIF(%s, ''), name),
                    hubspot_last_sync = NOW(),
                    updated_at = NOW()
                WHERE hubspot_company_id = %s
            """, (name, hs_id))
        else:
            cur.execute("""
                INSERT INTO partners (name, hubspot_company_id, hubspot_last_sync)
                VALUES (%s, %s, NOW())
            """, (name, hs_id))


def _pull_contacts_for_company(access_token, conn, hs_company_id, xo_client_id):
    """Pull all associated contacts from HubSpot and update XO client contacts_json."""
    if not xo_client_id:
        return
    try:
        resp = _hubspot_api('GET',
            f'/crm/v3/objects/companies/{hs_company_id}/associations/contacts',
            access_token)
        assoc_results = resp.get('results', [])
        if not assoc_results:
            return

        contacts_list = []
        primary_hs_contact_id = None

        for i, assoc in enumerate(assoc_results):
            contact_id = assoc.get('id')
            if not contact_id:
                continue
            try:
                contact = _hubspot_api('GET', f'/crm/v3/objects/contacts/{contact_id}', access_token,
                                       params={'properties': 'firstname,lastname,email,phone,jobtitle'})
                props = contact.get('properties', {})
                first = props.get('firstname', '')
                last = props.get('lastname', '')
                full_name = f"{first} {last}".strip()

                contact_obj = {
                    'name': full_name,
                    'email': props.get('email', ''),
                    'phone': props.get('phone', ''),
                    'title': props.get('jobtitle', ''),
                }
                contacts_list.append(contact_obj)

                if i == 0:
                    primary_hs_contact_id = contact_id
            except Exception as e:
                logger.warning("Failed to fetch contact %s: %s", contact_id, e)

        if not contacts_list:
            return

        cur = conn.cursor()
        cur.execute("""
            UPDATE clients SET
                contacts_json = %s,
                hubspot_contact_id = COALESCE(%s, hubspot_contact_id),
                updated_at = NOW()
            WHERE id = %s
        """, (json.dumps(contacts_list), primary_hs_contact_id, xo_client_id))
        conn.commit()
        cur.close()
    except Exception as e:
        logger.warning("Failed to pull contacts for company %s: %s", hs_company_id, e)


# ── Route Handlers ──

def handle_connect(event, user):
    """POST /hubspot/connect — Private App tokens are configured server-side."""
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'status': 'private_app',
            'message': 'HubSpot integration uses a Private App token configured server-side. No OAuth flow required.',
            'connected': bool(HUBSPOT_PRIVATE_TOKEN),
        })
    }


def handle_callback(event):
    """GET /hubspot/callback — Not used with Private App auth."""
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'status': 'private_app',
            'message': 'HubSpot integration uses a Private App token. OAuth callback is not required.',
        })
    }


def handle_status(event, user):
    """GET /hubspot/status — Check connectivity with a test read against HubSpot."""
    token = _get_access_token()
    if not token:
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'connected': False,
                'last_sync': None,
                'error': 'HUBSPOT_PRIVATE_TOKEN env var not set',
            })
        }

    # Test connectivity with a lightweight read
    connected = False
    error_msg = None
    try:
        resp = _hubspot_api('GET', '/crm/v3/objects/companies', token, params={'limit': 1})
        connected = True
    except Exception as e:
        error_msg = str(e)

    conn = get_db_connection()
    try:
        last_sync = _get_config(conn, 'hubspot_last_full_sync')
        intellagentic_id = _get_config(conn, 'hubspot_intellagentic_company_id')

        result = {
            'connected': connected,
            'auth_type': 'private_app',
            'last_sync': last_sync,
            'intellagentic_company_id': intellagentic_id,
        }
        if error_msg:
            result['error'] = error_msg

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result)
        }
    finally:
        conn.close()


def handle_sync(event, user):
    """POST /hubspot/sync — Full bi-directional sync."""
    conn = get_db_connection()
    try:
        access_token = _get_access_token()
        if not access_token:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'HUBSPOT_PRIVATE_TOKEN not configured'})
            }

        # Ensure custom properties exist in HubSpot
        _ensure_custom_properties(access_token)

        intellagentic_company_id = _get_config(conn, 'hubspot_intellagentic_company_id')

        # ── Phase 1: Push XO -> HubSpot ──
        cur = conn.cursor()

        # Push partners
        cur.execute("SELECT id, name, company, email, website, hubspot_company_id, "
                    "contacts_json, addresses_json FROM partners")
        partner_rows = cur.fetchall()
        partner_cols = ['id', 'name', 'company', 'email', 'website', 'hubspot_company_id',
                        'contacts_json', 'addresses_json']
        partners_pushed = 0
        partner_hs_map = {}  # partner_id -> hubspot_company_id

        for row in partner_rows:
            record = dict(zip(partner_cols, row))
            try:
                hs_id = _push_company(access_token, record, 'partner')
                partner_hs_map[record['id']] = hs_id
                if hs_id != record.get('hubspot_company_id'):
                    cur.execute("UPDATE partners SET hubspot_company_id = %s, hubspot_last_sync = NOW() WHERE id = %s",
                                (hs_id, record['id']))
                else:
                    cur.execute("UPDATE partners SET hubspot_last_sync = NOW() WHERE id = %s", (record['id'],))
                partners_pushed += 1
            except Exception as e:
                logger.warning("Failed to push partner %s: %s", record['id'], e)

        # Push clients
        cur.execute("""
            SELECT id, company_name, website_url, industry, description,
                   future_plans, status, source, nda_signed, nda_signed_at,
                   intellagentic_lead, pain_points_json, contacts_json,
                   addresses_json, s3_folder, hubspot_company_id,
                   hubspot_contact_id, partner_id, encryption_key
            FROM clients WHERE status != 'deleted' OR status IS NULL
        """)
        client_rows = cur.fetchall()
        client_cols = ['id', 'company_name', 'website_url', 'industry', 'description',
                       'future_plans', 'status', 'source', 'nda_signed', 'nda_signed_at',
                       'intellagentic_lead', 'pain_points_json', 'contacts_json',
                       'addresses_json', 's3_folder', 'hubspot_company_id',
                       'hubspot_contact_id', 'partner_id', 'encryption_key']
        clients_pushed = 0

        for row in client_rows:
            record = dict(zip(client_cols, row))
            try:
                client_key = unwrap_client_key(record.get('encryption_key')) if record.get('encryption_key') else None

                hs_company_id = _push_company(access_token, record, 'client', client_key)
                hs_contact_id = _push_contacts(access_token, record, hs_company_id, client_key)

                # Update hubspot IDs in DB
                cur.execute("""
                    UPDATE clients SET
                        hubspot_company_id = %s,
                        hubspot_contact_id = COALESCE(%s, hubspot_contact_id),
                        hubspot_last_sync = NOW()
                    WHERE id = %s
                """, (hs_company_id, hs_contact_id, record['id']))

                # Partner-client association
                partner_id = record.get('partner_id')
                if partner_id and partner_id in partner_hs_map:
                    _create_company_association(access_token, partner_hs_map[partner_id], hs_company_id)
                elif intellagentic_company_id:
                    _create_company_association(access_token, intellagentic_company_id, hs_company_id)

                # Push enrichment note
                _push_enrichment_note(access_token, hs_company_id, record, client_key)

                clients_pushed += 1
            except Exception as e:
                logger.warning("Failed to push client %s: %s", record['id'], e)

        conn.commit()
        cur.close()

        # ── Phase 2: Pull HubSpot -> XO ──
        clients_created, clients_updated, client_conflicts = _pull_companies(access_token, conn, 'client')
        partners_created, partners_updated, _partner_conflicts = _pull_companies(access_token, conn, 'partner')

        all_conflicts = client_conflicts + _partner_conflicts

        # Update last sync timestamp
        _set_config(conn, 'hubspot_last_full_sync', datetime.now(timezone.utc).isoformat())

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'status': 'complete',
                'pushed': {
                    'partners': partners_pushed,
                    'clients': clients_pushed,
                },
                'pulled': {
                    'clients_created': clients_created,
                    'clients_updated': clients_updated,
                    'partners_created': partners_created,
                    'partners_updated': partners_updated,
                },
                'conflicts': all_conflicts,
                'last_sync': datetime.now(timezone.utc).isoformat(),
            })
        }
    except Exception as e:
        logger.error("Full sync failed: %s", e)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Sync failed: {str(e)}'})
        }
    finally:
        conn.close()


def handle_sync_push(event, user):
    """POST /hubspot/sync/push — Push a specific client to HubSpot."""
    conn = get_db_connection()
    try:
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        access_token = _get_access_token()
        if not access_token:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'HubSpot not connected'})
            }

        cur = conn.cursor()
        cur.execute("""
            SELECT id, company_name, website_url, industry, description,
                   future_plans, status, source, nda_signed, nda_signed_at,
                   intellagentic_lead, pain_points_json, contacts_json,
                   addresses_json, s3_folder, hubspot_company_id,
                   hubspot_contact_id, partner_id, encryption_key
            FROM clients WHERE id = %s
        """, (client_id,))
        row = cur.fetchone()

        if not row:
            cur.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }

        cols = ['id', 'company_name', 'website_url', 'industry', 'description',
                'future_plans', 'status', 'source', 'nda_signed', 'nda_signed_at',
                'intellagentic_lead', 'pain_points_json', 'contacts_json',
                'addresses_json', 's3_folder', 'hubspot_company_id',
                'hubspot_contact_id', 'partner_id', 'encryption_key']
        record = dict(zip(cols, row))
        client_key = unwrap_client_key(record.get('encryption_key')) if record.get('encryption_key') else None

        hs_company_id = _push_company(access_token, record, 'client', client_key)
        hs_contact_id = _push_contacts(access_token, record, hs_company_id, client_key)

        cur.execute("""
            UPDATE clients SET
                hubspot_company_id = %s,
                hubspot_contact_id = COALESCE(%s, hubspot_contact_id),
                hubspot_last_sync = NOW()
            WHERE id = %s
        """, (hs_company_id, hs_contact_id, client_id))
        conn.commit()

        # Handle partner association
        intellagentic_company_id = _get_config(conn, 'hubspot_intellagentic_company_id')
        partner_id = record.get('partner_id')
        if partner_id:
            cur2 = conn.cursor()
            cur2.execute("SELECT hubspot_company_id FROM partners WHERE id = %s", (partner_id,))
            prow = cur2.fetchone()
            cur2.close()
            if prow and prow[0]:
                _create_company_association(access_token, prow[0], hs_company_id)
        elif intellagentic_company_id:
            _create_company_association(access_token, intellagentic_company_id, hs_company_id)

        # Push enrichment note
        _push_enrichment_note(access_token, hs_company_id, record, client_key)

        cur.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'status': 'pushed',
                'hubspot_company_id': hs_company_id,
                'hubspot_contact_id': hs_contact_id,
            })
        }
    except Exception as e:
        logger.error("Push sync failed: %s", e)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Push failed: {str(e)}'})
        }
    finally:
        conn.close()


def handle_sync_pull(event, user):
    """POST /hubspot/sync/pull — Pull a specific company from HubSpot into XO."""
    conn = get_db_connection()
    try:
        body = json.loads(event.get('body', '{}'))
        hubspot_company_id = body.get('hubspot_company_id', '').strip()

        if not hubspot_company_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'hubspot_company_id is required'})
            }

        access_token = _get_access_token()
        if not access_token:
            return {
                'statusCode': 401,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'HubSpot not connected'})
            }

        # Fetch company from HubSpot
        company = _hubspot_api('GET', f'/crm/v3/objects/companies/{hubspot_company_id}', access_token,
                               params={'properties': 'name,website,description,xo_industry,'
                                                      'xo_client_id,xo_record_type,xo_status,xo_source,'
                                                      'xo_nda_signed,xo_nda_signed_at,xo_intellagentic_lead,'
                                                      'xo_future_plans,xo_pain_points_json,xo_addresses_json,xo_sync_enabled,'
                                                      'address,address2,city,state,zip,country'})
        props = company.get('properties', {})
        record_type = props.get('xo_record_type', 'client')
        xo_id = props.get('xo_client_id')

        cur = conn.cursor()
        if record_type == 'partner':
            _pull_partner_record(cur, conn, hubspot_company_id, xo_id, props)
        else:
            _pull_client_record(cur, conn, hubspot_company_id, xo_id, props)
        conn.commit()

        # Pull associated contacts
        if record_type == 'client':
            # Find the XO client ID (might have just been created)
            if not xo_id:
                cur.execute("SELECT id FROM clients WHERE hubspot_company_id = %s", (hubspot_company_id,))
                row = cur.fetchone()
                xo_id = str(row[0]) if row else None
            if xo_id:
                _pull_contacts_for_company(access_token, conn, hubspot_company_id, xo_id)

        cur.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'status': 'pulled',
                'record_type': record_type,
                'hubspot_company_id': hubspot_company_id,
                'xo_id': xo_id,
            })
        }
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response else 500
        logger.error("HubSpot API error during pull: %s", e)
        return {
            'statusCode': status,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'HubSpot API error: {str(e)}'})
        }
    except Exception as e:
        logger.error("Pull sync failed: %s", e)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Pull failed: {str(e)}'})
        }
    finally:
        conn.close()


def handle_conflicts(event, user):
    """GET /hubspot/conflicts — Return unresolved conflicts from sync log."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, record_type, record_id, hubspot_id, fields_skipped, details, synced_at
            FROM hubspot_sync_log
            WHERE sync_direction = 'conflict'
            ORDER BY synced_at DESC
            LIMIT 100
        """)
        rows = cur.fetchall()
        cur.close()

        conflicts = []
        for row in rows:
            conflicts.append({
                'log_id': row[0],
                'record_type': row[1],
                'record_id': str(row[2]) if row[2] else None,
                'hubspot_id': row[3],
                'conflicting_fields': json.loads(row[4]) if row[4] else [],
                'details': row[5],
                'synced_at': row[6].isoformat() if row[6] else None,
            })

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'conflicts': conflicts})
        }
    finally:
        conn.close()


def handle_resolve_conflict(event, user):
    """POST /hubspot/conflicts/resolve — Resolve a conflict by choosing XO or HubSpot as winner."""
    conn = get_db_connection()
    try:
        body = json.loads(event.get('body', '{}'))
        record_id = body.get('record_id', '').strip()
        winner = body.get('winner', '').strip().lower()

        if not record_id or winner not in ('xo', 'hubspot'):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'record_id and winner (xo|hubspot) are required'})
            }

        cur = conn.cursor()

        # Look up the conflict log entry
        cur.execute("""
            SELECT id, record_type, hubspot_id, fields_skipped, details
            FROM hubspot_sync_log
            WHERE sync_direction = 'conflict' AND record_id = %s
            ORDER BY synced_at DESC LIMIT 1
        """, (record_id,))
        log_row = cur.fetchone()
        if not log_row:
            cur.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No conflict found for this record'})
            }

        log_id, record_type, hubspot_id, fields_skipped_json, details = log_row
        conflicting_fields = json.loads(fields_skipped_json) if fields_skipped_json else []

        if winner == 'hubspot':
            # Fetch fresh HubSpot data and apply to XO
            access_token = _get_access_token()
            if not access_token:
                cur.close()
                return {
                    'statusCode': 401,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'HubSpot not connected'})
                }

            company = _hubspot_api('GET', f'/crm/v3/objects/companies/{hubspot_id}', access_token,
                                   params={'properties': 'name,website,description,xo_industry,'
                                                          'xo_client_id,xo_record_type,xo_status,xo_source,'
                                                          'xo_nda_signed,xo_nda_signed_at,xo_intellagentic_lead,'
                                                          'xo_future_plans,xo_pain_points_json,xo_addresses_json'})
            props = company.get('properties', {})
            updated = _apply_hs_to_xo_update(cur, hubspot_id, record_id, props, 'id = %s', (record_id,))

            _log_sync(conn, record_type, record_id, hubspot_id, 'pull',
                      fields_updated=updated,
                      details=f"Conflict resolved: HubSpot wins for fields {conflicting_fields}")

        elif winner == 'xo':
            # Push XO values to HubSpot
            access_token = _get_access_token()
            if not access_token:
                cur.close()
                return {
                    'statusCode': 401,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'HubSpot not connected'})
                }

            cur.execute("""
                SELECT id, company_name, website_url, industry, description,
                       future_plans, status, source, nda_signed, nda_signed_at,
                       intellagentic_lead, pain_points_json, contacts_json,
                       addresses_json, s3_folder, hubspot_company_id,
                       hubspot_contact_id, partner_id, encryption_key
                FROM clients WHERE id = %s
            """, (record_id,))
            row = cur.fetchone()
            if row:
                cols = ['id', 'company_name', 'website_url', 'industry', 'description',
                        'future_plans', 'status', 'source', 'nda_signed', 'nda_signed_at',
                        'intellagentic_lead', 'pain_points_json', 'contacts_json',
                        'addresses_json', 's3_folder', 'hubspot_company_id',
                        'hubspot_contact_id', 'partner_id', 'encryption_key']
                record = dict(zip(cols, row))
                client_key = unwrap_client_key(record.get('encryption_key')) if record.get('encryption_key') else None
                _push_company(access_token, record, record_type, client_key)

            cur.execute("UPDATE clients SET hubspot_last_sync = NOW() WHERE id = %s", (record_id,))

            _log_sync(conn, record_type, record_id, hubspot_id, 'push',
                      fields_updated=conflicting_fields,
                      details=f"Conflict resolved: XO wins for fields {conflicting_fields}")

        # Remove the conflict log entry
        cur.execute("DELETE FROM hubspot_sync_log WHERE id = %s", (log_id,))
        conn.commit()
        cur.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'status': 'resolved',
                'winner': winner,
                'record_id': record_id,
                'fields': conflicting_fields,
            })
        }
    except Exception as e:
        logger.error("Conflict resolution failed: %s", e)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Resolution failed: {str(e)}'})
        }
    finally:
        conn.close()


def handle_mapping(event, user):
    """GET /hubspot/mapping — Return current field mapping configuration."""
    mapping = {
        'client_to_company': {
            'company_name': 'name (HubSpot Company name)',
            'website_url': 'website (HubSpot Company website)',
            'industry': 'xo_industry (custom text, free-form)',
            'description': 'description (HubSpot Company description)',
            'future_plans': 'xo_future_plans (custom text)',
            'status': 'xo_status (custom)',
            'source': 'xo_source (custom)',
            'nda_signed': 'xo_nda_signed (custom boolean)',
            'nda_signed_at': 'xo_nda_signed_at (custom datetime)',
            'intellagentic_lead': 'xo_intellagentic_lead (custom boolean)',
            'pain_points_json': 'xo_pain_points_json (custom text, JSON array)',
            'contacts_json': 'Multiple HubSpot Contacts associated to Company (name, email, phone, title, linkedin)',
            'addresses_json': 'xo_addresses_json (custom text, JSON array) + HubSpot standard address from first entry',
            'partner_id': 'Company-to-Company association with partner HubSpot Company',
        },
        'custom_properties': {
            'xo_record_type': 'partner | client',
            'xo_client_id': 'XO Capture UUID back-reference',
            'xo_status': 'Client status in XO',
            'xo_source': 'Client source (e.g. invite, manual)',
            'xo_nda_signed': 'Boolean - NDA signed status',
            'xo_nda_signed_at': 'Datetime - when NDA was signed',
            'xo_intellagentic_lead': 'Boolean - Intellagentic lead flag',
            'xo_future_plans': 'Text - client future plans',
            'xo_pain_points_json': 'Text - JSON array of pain points',
            'xo_addresses_json': 'Text - JSON array of addresses',
            'xo_sync_enabled': 'Boolean - set true on HubSpot company to pull into XO Capture',
        },
        'associations': {
            'contact_to_company': 'All contacts from contacts_json linked to Company',
            'company_to_company': 'Partner Company -> Client Company (Channel Partner)',
            'note_to_company': 'Enrichment summary notes on Company',
        },
        'dedup_strategy': {
            'primary': 'Match on website/domain (normalized, case-insensitive)',
            'fallback': 'Match on company name (fuzzy/contains)',
            'tracking': 'hubspot_company_id stored in clients/partners table',
        },
        'pull_behavior': {
            'existing_records': 'Companies pushed from XO (have xo_client_id) sync normally regardless of xo_sync_enabled',
            'new_records': 'Only HubSpot companies with xo_sync_enabled=true are pulled into XO Capture as new clients',
            'how_to_enable': 'Set "Sync to XO Capture" checkbox to true on the HubSpot Company record',
        },
    }

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(mapping)
    }


# ── Lambda Handler (router) ──

def lambda_handler(event, context):
    """
    Method router for /hubspot/* endpoints.
    """

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '')
    method = event.get('httpMethod', '')

    # OAuth callback — no auth required (HubSpot redirects here)
    if '/hubspot/callback' in path and method == 'GET':
        response = handle_callback(event)
        log_activity(event, response)
        return response

    # All other routes require auth
    user, err = require_auth(event)
    if err:
        log_activity(event, err)
        return err

    response = _route_hubspot(event, user, path, method)
    log_activity(event, response, user)
    return response


def _route_hubspot(event, user, path, method):
    """Route authenticated HubSpot requests."""

    if '/hubspot/connect' in path and method == 'POST':
        return handle_connect(event, user)

    if '/hubspot/status' in path and method == 'GET':
        return handle_status(event, user)

    if '/hubspot/conflicts/resolve' in path and method == 'POST':
        return handle_resolve_conflict(event, user)

    if '/hubspot/conflicts' in path and method == 'GET':
        return handle_conflicts(event, user)

    if '/hubspot/sync/push' in path and method == 'POST':
        return handle_sync_push(event, user)

    if '/hubspot/sync/pull' in path and method == 'POST':
        return handle_sync_pull(event, user)

    if '/hubspot/sync' in path and method == 'POST':
        return handle_sync(event, user)

    if '/hubspot/mapping' in path and method == 'GET':
        return handle_mapping(event, user)

    return {
        'statusCode': 404,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': f'Not found: {method} {path}'})
    }
