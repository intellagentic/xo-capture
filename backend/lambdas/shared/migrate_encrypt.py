"""
One-time migration script to encrypt existing plaintext data.

Two-tier encryption:
  - Master key (AES_MASTER_KEY env var): encrypts users, accounts, and client encryption keys
  - Per-client keys (generated per client, stored encrypted in clients.encryption_key):
    encrypts client PII fields and S3 files

Usage:
  export DATABASE_URL="postgresql://..."
  export AES_MASTER_KEY="<base64-encoded-32-byte-key>"
  python migrate_encrypt.py

Idempotent — skips already-encrypted data.
"""

import os
import sys
import json
import base64
import psycopg2
import boto3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crypto_helper import (
    encrypt, encrypt_json, search_hash,
    generate_client_key, unwrap_client_key,
    client_encrypt, client_encrypt_json,
    encrypt_s3_body, encrypt_s3_bytes,
    _encryption_available
)

DATABASE_URL = os.environ.get('DATABASE_URL', '')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data-mv')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL env var is required")
    sys.exit(1)

if not _encryption_available():
    print("ERROR: AES_MASTER_KEY env var is required and cryptography package must be installed")
    sys.exit(1)

s3 = boto3.client('s3')


def _is_already_encrypted(value):
    """Heuristic: check if value looks like base64-encoded AES ciphertext."""
    if not value:
        return False
    try:
        raw = base64.b64decode(value)
        if len(raw) >= 28:  # nonce(12) + min ciphertext(16)
            return True
    except Exception:
        pass
    return False


def migrate_users(conn):
    """Encrypt users.email, users.name, users.google_drive_refresh_token with master key."""
    cur = conn.cursor()
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)")
    conn.commit()

    cur.execute("SELECT id, email, name, google_drive_refresh_token FROM users")
    rows = cur.fetchall()
    count = 0
    for row in rows:
        user_id, email, name, refresh_token = row
        if not email or _is_already_encrypted(email):
            continue
        cur.execute("""
            UPDATE users SET email = %s, email_hash = %s, name = %s,
                   google_drive_refresh_token = %s
            WHERE id = %s
        """, (
            encrypt(email), search_hash(email),
            encrypt(name) if name else name,
            encrypt(refresh_token) if refresh_token else refresh_token,
            user_id
        ))
        count += 1
    conn.commit()
    cur.close()
    print(f"  users: encrypted {count} rows")


def migrate_accounts(conn):
    """Encrypt account PII with master key."""
    cur = conn.cursor()
    cur.execute("SELECT id, email, phone, contacts_json, addresses_json FROM accounts")
    rows = cur.fetchall()
    count = 0
    for row in rows:
        pid, email, phone, contacts_raw, addresses_raw = row
        if email and _is_already_encrypted(email):
            continue
        enc_contacts = None
        if contacts_raw:
            try:
                enc_contacts = encrypt_json(json.loads(contacts_raw))
            except Exception:
                enc_contacts = contacts_raw
        enc_addresses = None
        if addresses_raw:
            try:
                enc_addresses = encrypt_json(json.loads(addresses_raw))
            except Exception:
                enc_addresses = addresses_raw
        cur.execute("""
            UPDATE accounts SET email = %s, phone = %s,
                   contacts_json = %s, addresses_json = %s
            WHERE id = %s
        """, (
            encrypt(email) if email else email,
            encrypt(phone) if phone else phone,
            enc_contacts, enc_addresses, pid
        ))
        count += 1
    conn.commit()
    cur.close()
    print(f"  accounts: encrypted {count} rows")


def migrate_clients(conn):
    """Generate per-client keys and encrypt client PII + S3 files."""
    cur = conn.cursor()
    cur.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS encryption_key TEXT")
    conn.commit()

    cur.execute("""
        SELECT id, s3_folder, encryption_key,
               contact_name, contact_title, contact_linkedin,
               contact_email, contact_phone, contacts_json, addresses_json,
               streamline_webhook_url, invite_webhook_url
        FROM clients
    """)
    rows = cur.fetchall()
    count = 0
    for row in rows:
        cid, s3_folder = row[0], row[1]
        existing_key = row[2]

        # Generate client key if not already set
        if existing_key:
            encrypted_client_key = existing_key
            ck = unwrap_client_key(existing_key)
        else:
            encrypted_client_key = generate_client_key()
            ck = unwrap_client_key(encrypted_client_key)

        contact_email = row[6]
        # Skip if already encrypted with client key
        if contact_email and _is_already_encrypted(contact_email) and existing_key:
            continue

        # Encrypt DB fields with client key
        enc_contacts = None
        if row[8]:
            try:
                enc_contacts = client_encrypt_json(ck, json.loads(row[8]))
            except Exception:
                enc_contacts = row[8]
        enc_addresses = None
        if row[9]:
            try:
                enc_addresses = client_encrypt_json(ck, json.loads(row[9]))
            except Exception:
                enc_addresses = row[9]

        cur.execute("""
            UPDATE clients SET
                encryption_key = %s,
                contact_name = %s, contact_title = %s, contact_linkedin = %s,
                contact_email = %s, contact_phone = %s,
                contacts_json = %s, addresses_json = %s,
                streamline_webhook_url = %s, invite_webhook_url = %s
            WHERE id = %s
        """, (
            encrypted_client_key,
            client_encrypt(ck, row[3]) if row[3] else row[3],
            client_encrypt(ck, row[4]) if row[4] else row[4],
            client_encrypt(ck, row[5]) if row[5] else row[5],
            client_encrypt(ck, row[6]) if row[6] else row[6],
            client_encrypt(ck, row[7]) if row[7] else row[7],
            enc_contacts, enc_addresses,
            client_encrypt(ck, row[10]) if row[10] else row[10],
            client_encrypt(ck, row[11]) if row[11] else row[11],
            cid
        ))
        count += 1

        # Encrypt S3 files for this client
        if s3_folder:
            _encrypt_client_s3(s3_folder, ck)

    conn.commit()
    cur.close()
    print(f"  clients: encrypted {count} rows + S3 files")


def _encrypt_client_s3(s3_folder, ck):
    """Encrypt all text-based S3 files for a client."""
    text_prefixes = [
        f"{s3_folder}/client-config.md",
        f"{s3_folder}/skills/",
        f"{s3_folder}/results/",
        f"{s3_folder}/extracted/",
    ]
    for prefix in text_prefixes:
        try:
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=prefix):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    if key.endswith('/'):
                        continue
                    try:
                        resp = s3.get_object(Bucket=BUCKET_NAME, Key=key)
                        body = resp['Body'].read()
                        # Skip if already encrypted
                        if body.startswith(b'ENC:') or body.startswith(b'ENCB:'):
                            continue
                        # Text files: use encrypt_s3_body
                        encrypted = encrypt_s3_body(ck, body.decode('utf-8', errors='replace'))
                        s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=encrypted, ContentType='application/octet-stream')
                        print(f"    Encrypted S3: {key}")
                    except Exception as e:
                        print(f"    Warning: failed to encrypt {key}: {e}")
        except Exception as e:
            print(f"    Warning: failed to list {prefix}: {e}")

    # Binary files (uploads) — encrypt with encrypt_s3_bytes
    try:
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET_NAME, Prefix=f"{s3_folder}/uploads/"):
            for obj in page.get('Contents', []):
                key = obj['Key']
                if key.endswith('/'):
                    continue
                try:
                    resp = s3.get_object(Bucket=BUCKET_NAME, Key=key)
                    body = resp['Body'].read()
                    if body.startswith(b'ENCB:') or body.startswith(b'ENC:'):
                        continue
                    encrypted = encrypt_s3_bytes(ck, body)
                    s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=encrypted, ContentType='application/octet-stream')
                    print(f"    Encrypted S3 (binary): {key}")
                except Exception as e:
                    print(f"    Warning: failed to encrypt {key}: {e}")
    except Exception as e:
        print(f"    Warning: failed to list uploads: {e}")


def migrate_buttons(conn):
    """Encrypt button URLs with master key."""
    cur = conn.cursor()
    cur.execute("SELECT id, url FROM buttons WHERE url IS NOT NULL AND url != ''")
    rows = cur.fetchall()
    count = 0
    for row in rows:
        bid, url = row
        if _is_already_encrypted(url):
            continue
        cur.execute("UPDATE buttons SET url = %s WHERE id = %s", (encrypt(url), bid))
        count += 1
    conn.commit()
    cur.close()
    print(f"  buttons: encrypted {count} rows")


def main():
    print("Starting two-tier encryption migration...")
    print(f"  Bucket: {BUCKET_NAME}")
    conn = psycopg2.connect(DATABASE_URL)

    try:
        migrate_users(conn)
        migrate_accounts(conn)
        migrate_clients(conn)
        migrate_buttons(conn)
        print("Migration complete!")
    except Exception as e:
        conn.rollback()
        print(f"Migration FAILED: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
