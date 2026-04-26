"""Step C v2: use the actual crypto_helper to decrypt analysis JSON."""
import os
import sys
import json
import boto3
import psycopg2

# Reuse the real crypto_helper from the lambda package
sys.path.insert(0, '/Users/ken_macair_2025/xo-capture/backend/lambdas/enrich')
# AES_MASTER_KEY must be set in the environment before running this script.
# Pull it from the xo-enrich Lambda config:
#   aws lambda get-function-configuration --function-name xo-enrich \
#     --region eu-west-2 --profile intellagentic \
#     --query 'Environment.Variables.AES_MASTER_KEY' --output text
if 'AES_MASTER_KEY' not in os.environ:
    raise SystemExit("AES_MASTER_KEY must be set in env before running this script")

from crypto_helper import unwrap_client_key, decrypt_s3_body  # noqa: E402

DB_URL = os.environ['DATABASE_URL']
BUCKET = 'xo-client-data-mv'

session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
s3 = session.client('s3', region_name='us-west-1')

RUNS = [
    {
        'name': 'FC Dynamics',
        'enrichment_id': '12e46d43-2ab5-4c4e-a7a1-1c161a027d41',
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

conn = psycopg2.connect(DB_URL)
report_lines = []

for run in RUNS:
    header = f"\n{'='*80}\n{run['name']}  enrichment_id={run['enrichment_id']}\n{'='*80}"
    print(header); report_lines.append(header)

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
        line = "  NO ENRICHMENT ROW FOUND"
        print(line); report_lines.append(line); continue
    results_key, status, stage, completed_at, enc_key_b64 = row
    line = f"  status={status}  stage={stage}  completed_at={completed_at}\n  results_s3_key={results_key}"
    print(line); report_lines.append(line)

    obj = s3.get_object(Bucket=BUCKET, Key=results_key)
    raw = obj['Body'].read()

    client_key = unwrap_client_key(enc_key_b64) if enc_key_b64 else None
    decrypted = decrypt_s3_body(client_key, raw)
    if isinstance(decrypted, bytes):
        decrypted = decrypted.decode('utf-8', errors='replace')

    try:
        analysis = json.loads(decrypted)
    except json.JSONDecodeError as e:
        line = f"  ANALYSIS JSON PARSE ERROR: {e}\n  first 500 chars: {decrypted[:500]!r}"
        print(line); report_lines.append(line); continue

    analyzed_files = analysis.get('analyzed_files', [])
    line = f"\n  analyzed_files ({len(analyzed_files)}):"
    print(line); report_lines.append(line)
    for f in analyzed_files:
        l = f"    {f!r}"
        print(l); report_lines.append(l)

    sources = analysis.get('sources', [])
    line = f"\n  sources ({len(sources)}):"
    print(line); report_lines.append(line)
    for s_ in sources:
        l = f"    {s_}"
        print(l); report_lines.append(l)

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

    line = f"\n  per-file coverage:"
    print(line); report_lines.append(line)
    missing_af = []
    missing_narr = []
    for fname in run['expected_files']:
        in_af = fname in analyzed_files
        stem = fname.rsplit('.', 1)[0]
        in_narrative = (fname in blob) or (stem in blob)
        flag_af = '✓' if in_af else '✗'
        flag_n = '✓' if in_narrative else '✗'
        l = f"    af={flag_af} narr={flag_n}  {fname!r}"
        print(l); report_lines.append(l)
        if not in_af:
            missing_af.append(fname)
        if not in_narrative:
            missing_narr.append(fname)

    summary = (
        f"\n  SUMMARY for {run['name']}:\n"
        f"    expected count:               {len(run['expected_files'])}\n"
        f"    analyzed_files count:         {len(analyzed_files)}\n"
        f"    missing from analyzed_files:  {len(missing_af)}\n" +
        ''.join(f"        {f!r}\n" for f in missing_af) +
        f"    missing from narrative text:  {len(missing_narr)}\n" +
        ''.join(f"        {f!r}\n" for f in missing_narr) +
        f"    must-include {run['must_include']!r}: in analyzed_files = {run['must_include'] in analyzed_files}, "
        f"in narrative = {(run['must_include'] in blob) or (run['must_include'].rsplit('.',1)[0] in blob)}\n"
        f"    analysis status field: {analysis.get('status')!r}"
    )
    print(summary); report_lines.append(summary)

conn.close()

# Persist
with open('/Users/ken_macair_2025/xo-capture/audits/diag_step_c_output.txt', 'w') as f:
    f.write('\n'.join(report_lines))
print("\nSaved to audits/diag_step_c_output.txt")
