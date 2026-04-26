"""Step B: dump uploads rows and S3 listing, diff the two sets."""
import os
import psycopg2
import boto3
from collections import Counter

DB_URL = os.environ['DATABASE_URL']
BUCKET = 'xo-client-data-mv'

CLIENTS = [
    {'name': 'FC Dynamics',          'db_id': '51f49469-6328-4afe-a492-7c2f36274907', 's3_folder': 'client_1772616693_8b881fe7'},
    {'name': 'MFP Trading Limited',  'db_id': '58420e26-fd85-4da7-a638-e8729b55725f', 's3_folder': 'client_1776011770_6aff114c'},
]

session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
s3 = session.client('s3', region_name='us-west-1')

conn = psycopg2.connect(DB_URL)

# First, discover the actual columns of the uploads table
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'uploads'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()
cur.close()
print("=== uploads table schema ===")
for c in cols:
    print(f"  {c[0]:30}  {c[1]}")

col_names = [c[0] for c in cols]
# Pick a timestamp column if present
ts_col = next((c for c in ('uploaded_at','created_at','inserted_at','timestamp','upload_time') if c in col_names), None)
size_col = next((c for c in ('file_size','size','byte_size') if c in col_names), None)

select_cols = ['id', 's3_key', 'status']
if 'filename' in col_names: select_cols.append('filename')
if ts_col: select_cols.append(ts_col)
if size_col: select_cols.append(size_col)

for c in CLIENTS:
    print(f"\n{'='*80}\nCLIENT: {c['name']}  (db_id={c['db_id']}, s3_folder={c['s3_folder']})\n{'='*80}")

    cur = conn.cursor()
    sql = f"SELECT {', '.join(select_cols)} FROM uploads WHERE client_id = %s"
    if ts_col:
        sql += f" ORDER BY {ts_col}"
    cur.execute(sql, (c['db_id'],))
    db_rows = cur.fetchall()
    cur.close()

    print(f"\n--- DB uploads rows: {len(db_rows)} ---")
    print(f"    columns: {select_cols}")
    db_s3_keys = []
    for r in db_rows:
        print(f"  {r}")
        # s3_key is index 1
        db_s3_keys.append(r[1])

    # S3 listing (with pagination loop)
    s3_keys = []
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f"{c['s3_folder']}/uploads/"):
        for obj in page.get('Contents', []):
            s3_keys.append(obj['Key'])

    print(f"\n--- S3 list_objects_v2 (with pagination): {len(s3_keys)} keys ---")
    for k in s3_keys:
        print(f"  {k!r}")

    # Set diff
    db_set = set(db_s3_keys)
    s3_set = set(s3_keys)

    in_db_not_s3 = db_set - s3_set
    in_s3_not_db = s3_set - db_set
    in_both = db_set & s3_set

    print(f"\n--- DIFF ---")
    print(f"  in both (intersection): {len(in_both)}")
    print(f"  in DB but NOT S3:       {len(in_db_not_s3)}")
    for k in sorted(in_db_not_s3):
        print(f"    {k!r}")
    print(f"  in S3 but NOT DB:       {len(in_s3_not_db)}")
    for k in sorted(in_s3_not_db):
        print(f"    {k!r}")

    # Status histogram
    status_idx = select_cols.index('status')
    status_counts = Counter(r[status_idx] for r in db_rows)
    print(f"\n--- DB status histogram: {dict(status_counts)}")

    active_count = sum(1 for r in db_rows if r[status_idx] == 'active')
    null_count = sum(1 for r in db_rows if r[status_idx] is None)
    print(f"--- source_count predicate (status='active' only): {active_count}")
    print(f"--- enrich predicate     (status='active' OR NULL): {active_count + null_count}")

    # Subtle string mismatches
    print(f"\n--- subtle-mismatch check ---")
    issues = []
    for k in db_s3_keys:
        if k is None:
            issues.append(f"NULL s3_key in DB row")
            continue
        if k != k.strip():
            issues.append(f"whitespace: {k!r}")
        if k.startswith('/'):
            issues.append(f"leading-slash: {k!r}")
        if '//' in k:
            issues.append(f"double-slash: {k!r}")
        if '%' in k:
            issues.append(f"contains-percent (URL-encoded?): {k!r}")
    for k in s3_keys:
        if k.startswith('/'):
            issues.append(f"S3-leading-slash: {k!r}")
    if issues:
        for i in issues:
            print(f"  {i}")
    else:
        print("  (no obvious encoding/whitespace issues)")

conn.close()
print("\nDone.")
