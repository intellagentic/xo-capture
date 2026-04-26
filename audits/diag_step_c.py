"""Step C: pull the analysis JSON for the two known runs and verify every
input file is referenced in the output (analyzed_files, sources, problems,
summary, plan, bottom_line, client_summary)."""
import os
import json
import boto3
import psycopg2

DB_URL = os.environ['DATABASE_URL']
BUCKET = 'xo-client-data-mv'

session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
s3 = session.client('s3', region_name='us-west-1')

# Map enrichment_id -> (client_name, expected_files, must_include_filename)
RUNS = [
    {
        'name': 'FC Dynamics',
        'enrichment_id': '12e46d43-2ab5-4c4e-a7a1-1c161a027d41',
        's3_folder': 'client_1772616693_8b881fe7',
        'must_include': 'Fire Strategy.pdf',
        'expected_files': [
            '1-2 BARRIER ROAD, CHATHAM, KENT FIRE STRATEGY -DRAFT COPY .pdf',
            '250704 Issue Detail of Fire Stopping-1-2 Barrier Road, Chatham.pdf',
            'FC Dynamics - regulation research.docx',
            'Fire Strategy.pdf',
            'Intellagentic Mail - Re_ \U0001f5d3 FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
            'Intro Call Edem and Alan Transcript.txt',
            'Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf',
            'no. 2 Intellagentic Mail - Re_ \U0001f5d3 FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
        ],
    },
    {
        'name': 'MFP Trading',
        'enrichment_id': '6c81490f-491a-4708-ab8c-3ebd4e93f45c',
        's3_folder': 'client_1776011770_6aff114c',
        'must_include': 'IntellagenticXO \xb7 MFP Trading — XO Deployment Deep Dive.pdf',
        'expected_files': [
            'FW_ Starting Out - Focusing your Attention - alan.moore@intellagentic.io.pdf',
            'File Note_ Enriched  MFP Trading XO Discovery & Deep-Dive Call feb 24 2026.docx',
            'IntellagenticXO \xb7 MFP Trading — XO Deployment Deep Dive.pdf',
            'MFP Notes for AP Chat Bot.docx',
            'MFP Trading FX Credit Policy 2026.docx',
            'SlackChatforChatBot.docx',
            'forexventures_briefing.docx',
            'initial_call_1776012184056.txt',
            'mfp_briefing (1).docx',
            'mfp_briefing.docx',
        ],
    },
]

# Decryption support (mirrors crypto_helper minimally if needed)
import base64
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    AES_OK = True
except Exception:
    AES_OK = False

AES_MASTER_KEY_B64 = os.environ['AES_MASTER_KEY']


def maybe_decrypt(client_key_bytes, body_bytes):
    """Mirror crypto_helper.maybe_decrypt_s3_body / _bytes minimally.
    If body starts with 'ENC:' (str) or b'ENCB:' it's encrypted with client key.
    Otherwise return as-is (utf-8 decoded).
    """
    if isinstance(body_bytes, bytes):
        if body_bytes.startswith(b'ENCB:'):
            if not (AES_OK and client_key_bytes):
                return None  # cannot decrypt
            payload = base64.b64decode(body_bytes[5:])
            nonce, ct = payload[:12], payload[12:]
            aes = AESGCM(client_key_bytes)
            return aes.decrypt(nonce, ct, None)
        if body_bytes.startswith(b'ENC:'):
            if not (AES_OK and client_key_bytes):
                return None
            payload = base64.b64decode(body_bytes[4:])
            nonce, ct = payload[:12], payload[12:]
            aes = AESGCM(client_key_bytes)
            return aes.decrypt(nonce, ct, None).decode('utf-8', errors='replace')
        # Plain
        try:
            return body_bytes.decode('utf-8')
        except Exception:
            return body_bytes
    return body_bytes


def unwrap_client_key(wrapped_b64):
    """Mirror crypto_helper.unwrap_client_key: AES-GCM decrypt with master key."""
    if not wrapped_b64 or not AES_OK:
        return None
    master = base64.b64decode(AES_MASTER_KEY_B64)
    payload = base64.b64decode(wrapped_b64)
    nonce, ct = payload[:12], payload[12:]
    aes = AESGCM(master)
    return aes.decrypt(nonce, ct, None)


# Fetch results_s3_key per enrichment, plus the encryption_key for the client
conn = psycopg2.connect(DB_URL)

for run in RUNS:
    print(f"\n{'='*80}\n{run['name']}  enrichment_id={run['enrichment_id']}\n{'='*80}")
    cur = conn.cursor()
    cur.execute("""
        SELECT e.results_s3_key, e.status, e.stage, e.completed_at,
               c.encryption_key
        FROM enrichments e
        JOIN clients c ON c.id = e.client_id
        WHERE e.id = %s
    """, (run['enrichment_id'],))
    row = cur.fetchone()
    cur.close()
    if not row:
        print(f"  NO ENRICHMENT ROW FOUND")
        continue
    results_key, status, stage, completed_at, enc_key_b64 = row
    print(f"  status={status}  stage={stage}  completed_at={completed_at}")
    print(f"  results_s3_key={results_key}")
    if not results_key:
        print(f"  NO results_s3_key — analysis was never written to S3")
        continue

    obj = s3.get_object(Bucket=BUCKET, Key=results_key)
    raw = obj['Body'].read()

    client_key = unwrap_client_key(enc_key_b64) if enc_key_b64 else None
    decrypted = maybe_decrypt(client_key, raw)
    if isinstance(decrypted, bytes):
        decrypted = decrypted.decode('utf-8', errors='replace')
    if decrypted is None:
        print(f"  COULD NOT DECRYPT — analysis is encrypted but no client key")
        continue

    try:
        analysis = json.loads(decrypted)
    except json.JSONDecodeError as e:
        print(f"  ANALYSIS NOT VALID JSON: {e}")
        print(f"  first 500 chars: {decrypted[:500]!r}")
        continue

    analyzed_files = analysis.get('analyzed_files', [])
    print(f"\n  analyzed_files ({len(analyzed_files)}):")
    for f in analyzed_files:
        print(f"    {f!r}")

    sources = analysis.get('sources', [])
    print(f"\n  sources ({len(sources)}):")
    for s_ in sources:
        print(f"    {s_}")

    # Build a single text blob of all narrative fields to substring-search
    blob_parts = [
        analysis.get('summary', '') or '',
        analysis.get('bottom_line', '') or '',
        analysis.get('client_summary', '') or '',
        analysis.get('streamline_applications', '') or '',
    ]
    for p in analysis.get('problems', []) or []:
        for k in ('title', 'evidence', 'recommendation'):
            blob_parts.append(p.get(k, '') or '')
    for ph in analysis.get('plan', []) or []:
        blob_parts.extend(ph.get('actions', []) or [])
        blob_parts.append(ph.get('phase', '') or '')
    blob = '\n'.join(blob_parts)

    # Coverage check
    print(f"\n  per-file coverage:")
    missing_from_analyzed_files = []
    missing_from_narrative = []
    must_inc = run['must_include']
    for fname in run['expected_files']:
        in_af = fname in analyzed_files
        # Substring of stem (filename without extension) — narrative may
        # paraphrase the title rather than quote the filename.
        stem = fname.rsplit('.', 1)[0]
        in_narrative = (fname in blob) or (stem in blob)
        flag = '✓' if in_af else '✗'
        flag2 = '✓' if in_narrative else '✗'
        print(f"    af={flag} narr={flag2}  {fname!r}")
        if not in_af:
            missing_from_analyzed_files.append(fname)
        if not in_narrative:
            missing_from_narrative.append(fname)

    print(f"\n  SUMMARY for {run['name']}:")
    print(f"    expected:                  {len(run['expected_files'])}")
    print(f"    analyzed_files count:      {len(analyzed_files)}")
    print(f"    missing from analyzed_files: {len(missing_from_analyzed_files)}")
    for f in missing_from_analyzed_files:
        print(f"        {f!r}")
    print(f"    missing from narrative text: {len(missing_from_narrative)}")
    for f in missing_from_narrative:
        print(f"        {f!r}")
    print(f"    must-include {must_inc!r}: "
          f"in analyzed_files = {must_inc in analyzed_files}, "
          f"in narrative = {(must_inc in blob) or (must_inc.rsplit('.',1)[0] in blob)}")

    # Status / stop_reason hints from analysis
    print(f"\n  analysis status field: {analysis.get('status')!r}")

conn.close()
print("\nDone.")
