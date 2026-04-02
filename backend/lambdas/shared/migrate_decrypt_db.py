"""
One-time migration script to DECRYPT all DB fields back to plaintext.

Reverses the encryption applied by migrate_encrypt.py.
Leaves S3 encryption untouched (controlled by s3_encryption_enabled toggle).

Usage:
  export DB_HOST="xo-quickstart-db.xxxxx.eu-west-2.rds.amazonaws.com"
  export DB_PORT="5432"
  export DB_NAME="xo_quickstart"
  export DB_USER="xo_admin"
  export DB_PASSWORD="your-password"
  export AES_MASTER_KEY="<base64-encoded-32-byte-key>"
  python migrate_decrypt_db.py

Idempotent — decrypt() returns the original value if data is already plaintext.
"""

import os
import sys
import json
import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crypto_helper import (
    decrypt, decrypt_json,
    unwrap_client_key, client_decrypt, client_decrypt_json,
    _encryption_available
)

DB_HOST = os.environ.get('DB_HOST', 'xo-quickstart-db.c9g8ymsccljy.eu-west-2.rds.amazonaws.com')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'xo_quickstart')
DB_USER = os.environ.get('DB_USER', 'xo_admin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')

if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
    print("ERROR: DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD env vars are required")
    print("  export DB_HOST=your-rds-host")
    print("  export DB_PORT=5432")
    print("  export DB_NAME=xo_quickstart")
    print("  export DB_USER=xo_admin")
    print("  export DB_PASSWORD=your-password")
    sys.exit(1)

if not _encryption_available():
    print("ERROR: AES_MASTER_KEY env var is required and cryptography package must be installed")
    sys.exit(1)


def get_connection():
    """Create a database connection using individual parameters."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def decrypt_users(conn):
    """Decrypt users.email, users.name, users.google_drive_refresh_token to plaintext."""
    cur = conn.cursor()
    cur.execute("SELECT id, email, name, google_drive_refresh_token FROM users")
    rows = cur.fetchall()
    count = 0
    for user_id, email, name, refresh_token in rows:
        dec_email = decrypt(email) if email else email
        dec_name = decrypt(name) if name else name
        dec_token = decrypt(refresh_token) if refresh_token else refresh_token
        # Only update if something changed
        if dec_email != email or dec_name != name or dec_token != refresh_token:
            cur.execute("""
                UPDATE users SET email = %s, name = %s, google_drive_refresh_token = %s
                WHERE id = %s
            """, (dec_email, dec_name, dec_token, user_id))
            count += 1
    conn.commit()
    cur.close()
    print(f"  users: decrypted {count} rows")


def decrypt_partners(conn):
    """Decrypt partner PII to plaintext."""
    cur = conn.cursor()
    cur.execute("SELECT id, email, phone, contacts_json, addresses_json FROM partners")
    rows = cur.fetchall()
    count = 0
    for pid, email, phone, contacts_raw, addresses_raw in rows:
        dec_email = decrypt(email) if email else email
        dec_phone = decrypt(phone) if phone else phone
        dec_contacts = None
        if contacts_raw:
            result = decrypt_json(contacts_raw)
            dec_contacts = json.dumps(result) if result else contacts_raw
        dec_addresses = None
        if addresses_raw:
            result = decrypt_json(addresses_raw)
            dec_addresses = json.dumps(result) if result else addresses_raw
        if dec_email != email or dec_phone != phone or dec_contacts != contacts_raw or dec_addresses != addresses_raw:
            cur.execute("""
                UPDATE partners SET email = %s, phone = %s, contacts_json = %s, addresses_json = %s
                WHERE id = %s
            """, (dec_email, dec_phone, dec_contacts, dec_addresses, pid))
            count += 1
    conn.commit()
    cur.close()
    print(f"  partners: decrypted {count} rows")


def decrypt_clients(conn):
    """Decrypt client PII fields using per-client keys."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id, encryption_key,
               contact_name, contact_title, contact_linkedin,
               contact_email, contact_phone, contacts_json, addresses_json,
               streamline_webhook_url, invite_webhook_url
        FROM clients
    """)
    rows = cur.fetchall()
    count = 0
    for row in rows:
        cid = row[0]
        enc_key = row[1]
        ck = unwrap_client_key(enc_key) if enc_key else None

        if not ck:
            continue

        contact_name = client_decrypt(ck, row[2]) if row[2] else row[2]
        contact_title = client_decrypt(ck, row[3]) if row[3] else row[3]
        contact_linkedin = client_decrypt(ck, row[4]) if row[4] else row[4]
        contact_email = client_decrypt(ck, row[5]) if row[5] else row[5]
        contact_phone = client_decrypt(ck, row[6]) if row[6] else row[6]

        dec_contacts = None
        if row[7]:
            result = client_decrypt_json(ck, row[7])
            dec_contacts = json.dumps(result) if result else row[7]

        dec_addresses = None
        if row[8]:
            result = client_decrypt_json(ck, row[8])
            dec_addresses = json.dumps(result) if result else row[8]

        webhook_url = client_decrypt(ck, row[9]) if row[9] else row[9]
        invite_url = client_decrypt(ck, row[10]) if row[10] else row[10]

        changed = (
            contact_name != row[2] or contact_title != row[3] or contact_linkedin != row[4] or
            contact_email != row[5] or contact_phone != row[6] or
            dec_contacts != row[7] or dec_addresses != row[8] or
            webhook_url != row[9] or invite_url != row[10]
        )
        if changed:
            cur.execute("""
                UPDATE clients SET
                    contact_name = %s, contact_title = %s, contact_linkedin = %s,
                    contact_email = %s, contact_phone = %s,
                    contacts_json = %s, addresses_json = %s,
                    streamline_webhook_url = %s, invite_webhook_url = %s
                WHERE id = %s
            """, (
                contact_name, contact_title, contact_linkedin,
                contact_email, contact_phone,
                dec_contacts, dec_addresses,
                webhook_url, invite_url, cid
            ))
            count += 1
    conn.commit()
    cur.close()
    print(f"  clients: decrypted {count} rows")


def decrypt_engagements(conn):
    """Decrypt engagements.contacts_json using parent client keys."""
    cur = conn.cursor()
    cur.execute("""
        SELECT e.id, e.client_id, e.contacts_json, c.encryption_key
        FROM engagements e
        JOIN clients c ON c.id = e.client_id
        WHERE e.contacts_json IS NOT NULL
    """)
    rows = cur.fetchall()
    count = 0
    for eid, cid, contacts_raw, enc_key in rows:
        ck = unwrap_client_key(enc_key) if enc_key else None
        if not ck:
            continue
        result = client_decrypt_json(ck, contacts_raw)
        dec_contacts = json.dumps(result) if result else contacts_raw
        if dec_contacts != contacts_raw:
            cur.execute("UPDATE engagements SET contacts_json = %s WHERE id = %s", (dec_contacts, eid))
            count += 1
    conn.commit()
    cur.close()
    print(f"  engagements: decrypted {count} rows")


def decrypt_buttons(conn):
    """Decrypt button URLs to plaintext."""
    cur = conn.cursor()
    cur.execute("SELECT id, url FROM buttons WHERE url IS NOT NULL AND url != ''")
    rows = cur.fetchall()
    count = 0
    for bid, url in rows:
        dec_url = decrypt(url)
        if dec_url != url:
            cur.execute("UPDATE buttons SET url = %s WHERE id = %s", (dec_url, bid))
            count += 1
    conn.commit()
    cur.close()
    print(f"  buttons: decrypted {count} rows")


def decrypt_two_factor_codes(conn):
    """Decrypt two_factor_codes.email (stored user context) to plaintext."""
    cur = conn.cursor()
    cur.execute("SELECT id, email FROM two_factor_codes WHERE email IS NOT NULL")
    rows = cur.fetchall()
    count = 0
    for tid, email_ctx in rows:
        dec = decrypt(email_ctx)
        if dec != email_ctx:
            cur.execute("UPDATE two_factor_codes SET email = %s WHERE id = %s", (dec, tid))
            count += 1
    conn.commit()
    cur.close()
    print(f"  two_factor_codes: decrypted {count} rows")


def main():
    print("Starting DB decryption migration (reversing DB-level encryption)...")
    print(f"  Host: {DB_HOST}:{DB_PORT}  DB: {DB_NAME}  User: {DB_USER}")
    print("  NOTE: S3 encryption is NOT affected by this migration.")
    conn = get_connection()

    try:
        decrypt_users(conn)
        decrypt_partners(conn)
        decrypt_clients(conn)
        decrypt_engagements(conn)
        decrypt_buttons(conn)
        decrypt_two_factor_codes(conn)
        print("DB decryption migration complete!")
    except Exception as e:
        conn.rollback()
        print(f"Migration FAILED: {e}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
