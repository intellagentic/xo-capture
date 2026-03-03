"""
XO Capture - Database Seed Script
Creates admin user and default buttons.

Usage:
    DATABASE_URL=postgresql://xo_admin:PASSWORD@HOST:5432/xo_quickstart python seed.py
"""

import os
import sys
import bcrypt
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is required")
    print("Usage: DATABASE_URL=postgresql://xo_admin:PASS@HOST:5432/xo_quickstart python seed.py")
    sys.exit(1)

# Admin user credentials
ADMIN_EMAIL = "ken.scott@intellagentic.io"
ADMIN_PASSWORD = "XOquickstart2026!"
ADMIN_NAME = "XO Admin"

# Default buttons
DEFAULT_BUTTONS = [
    {"name": "Enrich",  "icon": "Sparkles", "color": "#22c55e", "url": "/enrich",  "sort_order": 0},
    {"name": "Skills",  "icon": "Database", "color": "#334155", "url": "/skills",  "sort_order": 1},
]


def seed():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Hash password
        password_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Insert admin user (skip if exists)
        cur.execute("""
            INSERT INTO users (email, password_hash, name)
            VALUES (%s, %s, %s)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                name = EXCLUDED.name
            RETURNING id
        """, (ADMIN_EMAIL, password_hash, ADMIN_NAME))

        user_id = cur.fetchone()[0]
        print(f"Admin user created/updated: {ADMIN_EMAIL} (id: {user_id})")

        # Delete existing buttons for this user, then insert defaults
        cur.execute("DELETE FROM buttons WHERE user_id = %s", (user_id,))

        for btn in DEFAULT_BUTTONS:
            cur.execute("""
                INSERT INTO buttons (user_id, name, icon, color, url, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (user_id, btn["name"], btn["icon"], btn["color"], btn["url"], btn["sort_order"]))

        print(f"Inserted {len(DEFAULT_BUTTONS)} default buttons")

        conn.commit()
        print("Seed complete.")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed()
