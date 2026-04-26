"""Find FC Dynamics + MFP Trading client_ids and s3_folders."""
import os
import psycopg2

DB_URL = os.environ['DATABASE_URL']

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("""
    SELECT id, s3_folder, company_name, created_at
    FROM clients
    WHERE company_name ILIKE %s OR company_name ILIKE %s
    ORDER BY company_name, created_at DESC
""", ('%FC Dynamics%', '%MFP Trading%'))

rows = cur.fetchall()
print(f"Found {len(rows)} matching client rows:\n")
for r in rows:
    print(f"  id={r[0]}  s3_folder={r[1]}  name={r[2]!r}  created_at={r[3]}")

cur.close()
conn.close()
