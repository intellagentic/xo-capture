"""Step D part 2: for each input file, pick 2-3 unique content signatures from
the source text (from the FIRST 5000 chars only — that's what Claude actually
saw given the text[:5000] truncation). Search the analysis JSON's substantive
fields for them. Score per-file."""
import os
import sys
import json
import psycopg2
import boto3

sys.path.insert(0, '/Users/ken_macair_2025/xo-capture/backend/lambdas/enrich')
if 'AES_MASTER_KEY' not in os.environ:
    raise SystemExit("AES_MASTER_KEY must be set in env")

from crypto_helper import unwrap_client_key, decrypt_s3_body  # noqa

DB_URL = os.environ['DATABASE_URL']
BUCKET = 'xo-client-data-mv'
session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
s3 = session.client('s3', region_name='us-west-1')

# ────────────────────────────────────────────────────────────────────────
# Per-file signatures: 3 distinctive strings from each file's FIRST 5000
# chars (what Claude saw). Each signature is something only THAT document
# would plausibly cite. Searched as case-sensitive substrings.
# ────────────────────────────────────────────────────────────────────────

FC_DYNAMICS = {
    'enrichment_id': '12e46d43-2ab5-4c4e-a7a1-1c161a027d41',
    'name': 'FC Dynamics',
    'files': [
        {
            'filename': '1-2 BARRIER ROAD, CHATHAM, KENT FIRE STRATEGY -DRAFT COPY .pdf',
            'uploaded': '2026-03-05 09:37',
            'total_chars': 15121,
            'signatures': [
                # First 5000 chars are mostly cover + ToC, almost no body content.
                'Edem Brampah',
                '1-2 BARRIER ROAD, CHATHAM',
                '18.03.2025',     # Issue 01 STAGE 4 DRAFT date
            ],
        },
        {
            'filename': '250704 Issue Detail of Fire Stopping-1-2 Barrier Road, Chatham.pdf',
            'uploaded': '2026-03-05 09:37',
            'total_chars': 8624,
            'signatures': [
                'Total items 18',
                'Autodesk',                          # Construction Cloud
                'Fire Stopping Inspection',          # specific issue type heading
            ],
        },
        {
            'filename': 'FC Dynamics - regulation research.docx',
            'uploaded': '2026-03-05 17:53',
            'total_chars': 4518,
            'signatures': [
                'BS 5839-1',                         # specific BS standard
                'Approved Document B',
                'BSI',                               # British Standards Institution
            ],
        },
        {
            'filename': 'Fire Strategy.pdf',
            'uploaded': '2026-04-04 14:05',
            'total_chars': 13463,
            'signatures': [
                'Tringham House',                    # named building, only in this doc
                'University Hospitals Dorset',       # client of THIS report only
                'Bennington Green',                  # report author firm
            ],
        },
        {
            'filename': 'Intellagentic Mail - Re_ FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
            'uploaded': '2026-04-04 14:05',
            'total_chars': 6866,
            'signatures': [
                'Approved Document M',               # the email lists ADM, F, K, L specifically
                'Tier-1',                            # actually that's in #2 — let me change
                # actually first email has "Sections: B1 ... B5", "Tables 2.1, 2.3"
                'BS 9999',                           # this email specifically lists BS 9999:2017/2024
            ],
        },
        {
            'filename': 'Intro Call Edem and Alan Transcript.txt',
            'uploaded': '2026-03-05 09:34',
            'total_chars': 40184,
            'signatures': [
                'Southern Housing',                  # first 5000 chars
                'Crewe',                             # social housing forum location
                "AWAB's law",                        # mentioned in first 5000 chars
            ],
        },
        {
            'filename': 'no. 2 Intellagentic Mail - Re_ FC Dynamics and XO on March 20, 2026 _ Read Meeting Report.pdf',
            'uploaded': '2026-04-04 14:05',
            'total_chars': 4000,
            'signatures': [
                '120 key UK standards',              # only in #2 email
                'Tier-1 consultancies',              # only in #2 email
                'FDS, CFAST',                        # modelling refs, only in #2
            ],
        },
        {
            'filename': 'Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf',
            'uploaded': '2026-03-05 09:37',
            'total_chars': 15790,
            'signatures': [
                'Sittingbourne',
                'FB SURVEYING',                      # client of this report only
                'Central Ave',                       # ME10 4AH address
            ],
        },
    ],
}

MFP_TRADING = {
    'enrichment_id': '6c81490f-491a-4708-ab8c-3ebd4e93f45c',
    'name': 'MFP Trading',
    'files': [
        {
            'filename': 'FW_ Starting Out - Focusing your Attention - alan.moore@intellagentic.io.pdf',
            'uploaded': '2026-04-12 16:42',
            'total_chars': 3353,
            'signatures': [
                'Lisa Murphy',                       # author
                'June 13, 2022',                    # original send date
                'Trader Tools',                     # specific platform
            ],
        },
        {
            'filename': 'File Note_ Enriched  MFP Trading XO Discovery & Deep-Dive Call feb 24 2026.docx',
            'uploaded': '2026-04-21 16:33',
            'total_chars': 7063,
            'signatures': [
                'Thomas Dudbridge',                 # facilitator named only here
                'Data Checker',                     # different deal mentioned in pre-meeting
                'Zach Pine',                        # Intellistack Head of Partners
            ],
        },
        {
            'filename': 'IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf',
            'uploaded': '2026-04-21 17:04',
            'total_chars': 15835,
            'signatures': [
                'Minerva',                          # MFP's proprietary platform — ONLY in this doc
                '5 exception types',                # the correction "5, not 6"
                'CreditAlertEngine',                # specific engine name from Lisa's questions
            ],
        },
        {
            'filename': 'MFP Notes for AP Chat Bot.docx',
            'uploaded': '2026-04-12 16:42',
            'total_chars': 8044,
            'signatures': [
                'Dealing Pad',                      # specific system
                'DSU',                              # Deal Status Unknown abbreviation
                'fxpb1@natwest',                    # specific email address
            ],
        },
        {
            'filename': 'MFP Trading FX Credit Policy 2026.docx',
            'uploaded': '2026-04-12 16:42',
            'total_chars': 3697,
            'signatures': [
                'Credit Console',                   # specific system referenced repeatedly
                'TTWL',                             # Halt their price feed in TTWL
                'ANOP',                             # Applied NOP
            ],
        },
        {
            'filename': 'SlackChatforChatBot.docx',
            'uploaded': '2026-04-12 16:42',
            'total_chars': 6197,
            'signatures': [
                'Wells Fargo',                      # central to the Slack incident
                'VBAN',                             # acronym used heavily
                'Soc Gen Paris',                    # second counterparty in incident
            ],
        },
        {
            'filename': 'forexventures_briefing.docx',
            'uploaded': '2026-04-21 16:33',
            'total_chars': 21587,
            'signatures': [
                'Forex Ventures',                   # anonymised name
                'Michael Nembrini',                 # anonymised principal
                '$5.7 billion',                     # anonymised peak volume (vs $4.5bn in MFP)
            ],
        },
        {
            'filename': 'initial_call_1776012184056.txt',
            'uploaded': '2026-04-12 16:43',
            'total_chars': 7023,
            'signatures': [
                # This file is ~identical to File Note Enriched. So pick shared signatures.
                'Thomas Dudbridge',
                'Lenders Bank Berlin',              # specific example bank
                'Fujitsu quantum',                  # quants tooling
            ],
        },
        {
            'filename': 'mfp_briefing (1).docx',
            'uploaded': '2026-04-21 16:33',
            'total_chars': 21817,
            'signatures': [
                'Becket House',                     # MFP's address
                'Old Jewry',                        # MFP's street
                'Mabrouka Abuhmida',                # named designer of safety layer
            ],
        },
        {
            'filename': 'mfp_briefing.docx',
            'uploaded': '2026-04-21 16:33',
            'total_chars': 21765,
            'signatures': [
                # Near-identical to (1). Pick shared signatures (these will hit if either is used).
                'Becket House',
                'Old Jewry',
                'Mabrouka Abuhmida',
            ],
        },
    ],
}

CLIENTS = [FC_DYNAMICS, MFP_TRADING]

conn = psycopg2.connect(DB_URL)


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
    # sources[].reference is descriptive prose, not just a filename — count it
    for s_ in analysis.get('sources', []) or []:
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


for client in CLIENTS:
    print(f"\n{'='*100}\n{client['name']}  enrichment={client['enrichment_id']}\n{'='*100}")

    cur = conn.cursor()
    cur.execute("""
        SELECT e.results_s3_key, c.encryption_key
        FROM enrichments e JOIN clients c ON c.id = e.client_id
        WHERE e.id = %s
    """, (client['enrichment_id'],))
    results_key, enc_key_b64 = cur.fetchone()
    cur.close()
    ck = unwrap_client_key(enc_key_b64) if enc_key_b64 else None
    raw = s3.get_object(Bucket=BUCKET, Key=results_key)['Body'].read()
    decrypted = decrypt_s3_body(ck, raw)
    if isinstance(decrypted, bytes):
        decrypted = decrypted.decode('utf-8', errors='replace')
    analysis = json.loads(decrypted)
    blob = build_blob(analysis)
    blob_lower = blob.lower()

    print(f"\n  Searchable blob: {len(blob)} chars across "
          f"problems({len(analysis.get('problems',[]))}), "
          f"sources({len(analysis.get('sources',[]))}), "
          f"plan({len(analysis.get('plan',[]))}), "
          f"summary, bottom_line, etc.\n")

    # Header
    print(f"  {'filename':70} {'upload':17} {'total':>6} {'cited':>5}  verdict")
    print(f"  {'-'*70} {'-'*17} {'-'*6} {'-'*5}  {'-'*15}")

    rows_out = []
    for f in client['files']:
        sigs = f['signatures']
        hits = []
        misses = []
        for s_ in sigs:
            if s_.lower() in blob_lower:
                hits.append(s_)
            else:
                misses.append(s_)
        cited = len(hits)
        total = len(sigs)
        if cited == total:
            verdict = 'used (full)'
        elif cited >= total - 1:
            verdict = 'used (partial)'
        elif cited >= 1:
            verdict = 'weak (1 of N)'
        else:
            verdict = 'NOT USED'
        truncated_chars = max(0, f['total_chars'] - 5000)
        truncation_note = f"  [truncated {truncated_chars}c]" if truncated_chars > 0 else ''
        print(f"  {f['filename'][:70]:70} {f['uploaded']:17} {f['total_chars']:>6} "
              f"{cited:>2}/{total}  {verdict}{truncation_note}")
        rows_out.append({
            'filename': f['filename'],
            'uploaded': f['uploaded'],
            'total_chars': f['total_chars'],
            'truncated_chars': truncated_chars,
            'sigs_total': total,
            'sigs_cited': cited,
            'hits': hits,
            'misses': misses,
            'verdict': verdict,
        })

    # Per-file detail
    print()
    for r in rows_out:
        print(f"  • {r['filename']}")
        print(f"      hits   ({len(r['hits'])}): {r['hits']}")
        print(f"      misses ({len(r['misses'])}): {r['misses']}")

conn.close()
print("\nDone.")
