"""Step D v2 — citation-depth verification with new sources[] schema.

Each input file is COVERED if EITHER:
  (a) >= 1 of its 3 unique signatures appears in the analysis blob, OR
  (b) sources[] has an entry whose `filename` matches AND `consolidated_with`
      is non-empty AND `unique_angle` is non-empty (legitimate consolidation,
      explicitly explained).

PASS: every input file is COVERED. Used post-deploy to prove the Stage 1 +
Stage 2 changes restored citation depth on FC Dynamics + MFP Trading.

Run after re-enriching the two clients with the new pipeline. Reads the
latest `complete` enrichment for each client by default; pass an explicit
enrichment_id via env DIAG_ENRICHMENT_FC / DIAG_ENRICHMENT_MFP to override.
"""
import os
import sys
import json
import psycopg2
import boto3
from collections import Counter

sys.path.insert(0, '/Users/ken_macair_2025/xo-capture/backend/lambdas/enrich')
if 'AES_MASTER_KEY' not in os.environ:
    raise SystemExit("AES_MASTER_KEY must be set in env")

from crypto_helper import unwrap_client_key, decrypt_s3_body  # noqa: E402

DB_URL = os.environ['DATABASE_URL']
BUCKET = 'xo-client-data-mv'

session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
s3 = session.client('s3', region_name='us-west-1')


# Reuse the same signature picks as v1 — they're tied to source-text content,
# not the analysis JSON shape.
FC_DYNAMICS = {
    'name': 'FC Dynamics',
    'db_id': '51f49469-6328-4afe-a492-7c2f36274907',
    'env_override': 'DIAG_ENRICHMENT_FC',
    'files': [
        ('1-2 BARRIER ROAD, CHATHAM, KENT FIRE STRATEGY -DRAFT COPY .pdf',
         ['Edem Brampah', '1-2 BARRIER ROAD, CHATHAM', '18.03.2025']),
        ('250704 Issue Detail of Fire Stopping-1-2 Barrier Road, Chatham.pdf',
         ['Total items 18', 'Autodesk', 'Fire Stopping Inspection']),
        ('FC Dynamics - regulation research.docx',
         ['BS 5839-1', 'Approved Document B', 'BSI']),
        ('Fire Strategy.pdf',
         ['Tringham House', 'University Hospitals Dorset', 'Bennington Green']),
        ('Intellagentic Mail - Re_ FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
         ['Approved Document M', 'BS 9999', 'Edem Brampah']),
        ('Intro Call Edem and Alan Transcript.txt',
         ['Southern Housing', 'Crewe', "AWAB's law"]),
        ('no. 2 Intellagentic Mail - Re_ FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
         ['120 key UK standards', 'Tier-1 consultancies', 'FDS, CFAST']),
        ('Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf',
         ['Sittingbourne', 'FB SURVEYING', 'Central Ave']),
    ],
}

MFP_TRADING = {
    'name': 'MFP Trading',
    'db_id': '58420e26-fd85-4da7-a638-e8729b55725f',
    'env_override': 'DIAG_ENRICHMENT_MFP',
    'files': [
        ('FW_ Starting Out - Focusing your Attention - alan.moore@intellagentic.io.pdf',
         ['Lisa Murphy', 'June 13, 2022', 'Trader Tools']),
        ('File Note_ Enriched  MFP Trading XO Discovery & Deep-Dive Call feb 24 2026.docx',
         ['Thomas Dudbridge', 'Data Checker', 'Zach Pine']),
        ('IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf',
         ['Minerva', '5 exception types', 'CreditAlertEngine']),
        ('MFP Notes for AP Chat Bot.docx',
         ['Dealing Pad', 'DSU', 'fxpb1@natwest']),
        ('MFP Trading FX Credit Policy 2026.docx',
         ['Credit Console', 'TTWL', 'ANOP']),
        ('SlackChatforChatBot.docx',
         ['Wells Fargo', 'VBAN', 'Soc Gen Paris']),
        ('forexventures_briefing.docx',
         ['Forex Ventures', 'Michael Nembrini', '$5.7 billion']),
        ('initial_call_1776012184056.txt',
         ['Thomas Dudbridge', 'Lenders Bank Berlin', 'Fujitsu quantum']),
        ('mfp_briefing (1).docx',
         ['Becket House', 'Old Jewry', 'Mabrouka Abuhmida']),
        ('mfp_briefing.docx',
         ['Becket House', 'Old Jewry', 'Mabrouka Abuhmida']),
    ],
}


def latest_enrichment(cur, db_id):
    cur.execute("""
        SELECT e.id, e.results_s3_key, c.encryption_key
        FROM enrichments e JOIN clients c ON c.id = e.client_id
        WHERE e.client_id = %s AND e.status = 'complete'
        ORDER BY e.completed_at DESC NULLS LAST
        LIMIT 1
    """, (db_id,))
    return cur.fetchone()


def by_id(cur, enrichment_id):
    cur.execute("""
        SELECT e.id, e.results_s3_key, c.encryption_key
        FROM enrichments e JOIN clients c ON c.id = e.client_id
        WHERE e.id = %s
    """, (enrichment_id,))
    return cur.fetchone()


def build_blob(analysis):
    parts = [
        analysis.get('summary', '') or '',
        analysis.get('bottom_line', '') or '',
        analysis.get('client_summary', '') or '',
        analysis.get('streamline_applications', '') or '',
        analysis.get('architecture_diagram', '') or '',
    ]
    for p in analysis.get('problems', []) or []:
        for k in ('title', 'evidence', 'recommendation'):
            parts.append(p.get(k, '') or '')
    for ph in analysis.get('plan', []) or []:
        parts.extend(ph.get('actions', []) or [])
        parts.append(ph.get('phase', '') or '')
    for s_ in analysis.get('sources', []) or []:
        # New schema: distinctive_fact + filename + unique_angle
        parts.append(s_.get('distinctive_fact', '') or '')
        parts.append(s_.get('filename', '') or '')
        parts.append(s_.get('unique_angle', '') or '')
        # Legacy schema: reference
        parts.append(s_.get('reference', '') or '')
    cm = analysis.get('component_mapping', {}) or {}
    for k_ in ('fits', 'extends', 'new_components'):
        for c in cm.get(k_, []) or []:
            parts.extend(str(v) for v in c.values())
    parts.append(cm.get('summary_line', '') or '')
    for app in analysis.get('xo_applications', []) or []:
        for k in ('title', 'problem', 'capability', 'integrations', 'outcome'):
            parts.append(app.get(k, '') or '')
    for table in (analysis.get('schema', {}) or {}).get('tables', []) or []:
        parts.append(table.get('name', '') or '')
        parts.append(table.get('purpose', '') or '')
        for col in table.get('columns', []) or []:
            parts.append(col.get('description', '') or '')
    return '\n'.join(parts)


def covered_via_consolidation(analysis, filename):
    """Pass condition (b): sources[] entry with consolidated_with + unique_angle."""
    for s_ in analysis.get('sources', []) or []:
        if not isinstance(s_, dict):
            continue
        if (s_.get('filename') or '') == filename:
            cw = s_.get('consolidated_with') or []
            ua = (s_.get('unique_angle') or '').strip()
            if cw and ua:
                return True
    return False


def has_filename_in_sources(analysis, filename):
    for s_ in analysis.get('sources', []) or []:
        if (s_.get('filename') or '') == filename:
            return True
    return False


def run_client(client):
    print(f"\n{'='*100}\n{client['name']}\n{'='*100}")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    override = os.environ.get(client['env_override'])
    row = by_id(cur, override) if override else latest_enrichment(cur, client['db_id'])
    if not row:
        print("  NO complete enrichment found")
        cur.close(); conn.close()
        return False

    enrich_id, results_key, enc_key_b64 = row
    print(f"  enrichment_id={enrich_id}\n  results_s3_key={results_key}")
    cur.close(); conn.close()

    ck = unwrap_client_key(enc_key_b64) if enc_key_b64 else None
    raw = s3.get_object(Bucket=BUCKET, Key=results_key)['Body'].read()
    decrypted = decrypt_s3_body(ck, raw)
    if isinstance(decrypted, bytes):
        decrypted = decrypted.decode('utf-8', errors='replace')
    analysis = json.loads(decrypted)
    blob = build_blob(analysis)
    blob_lower = blob.lower()

    print(f"\n  {'filename':70} {'sigs':>5}  {'in sources[]':>13}  verdict")
    print(f"  {'-'*70} {'-'*5}  {'-'*13}  {'-'*30}")

    rows = []
    for filename, sigs in client['files']:
        hits = [s for s in sigs if s.lower() in blob_lower]
        cited = len(hits)
        in_sources = has_filename_in_sources(analysis, filename)
        consolidated = covered_via_consolidation(analysis, filename)

        if cited >= 1:
            verdict = f'COVERED (signatures: {cited}/3)'
        elif consolidated:
            verdict = 'COVERED (consolidated_with + unique_angle)'
        else:
            verdict = 'FAIL — not covered'

        print(f"  {filename[:70]:70} {cited:>2}/3  {'yes' if in_sources else 'NO':>13}  {verdict}")
        rows.append((filename, cited, in_sources, consolidated, verdict, hits))

    cov = Counter('FAIL' if r[4].startswith('FAIL') else 'PASS' for r in rows)
    print(f"\n  Covered: {cov['PASS']}/{len(rows)}    Failing: {cov['FAIL']}")
    return cov['FAIL'] == 0


if __name__ == '__main__':
    fc_pass = run_client(FC_DYNAMICS)
    mfp_pass = run_client(MFP_TRADING)
    print(f"\n{'='*100}")
    if fc_pass and mfp_pass:
        print("OVERALL: PASS — every input file covered for both clients")
        sys.exit(0)
    print("OVERALL: FAIL — see per-client breakdown above")
    sys.exit(1)
