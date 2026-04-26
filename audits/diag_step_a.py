"""Step A: parse fetched CloudWatch events, locate the most recent enrichment
runs for each client, and count the diagnostic log lines."""
import json
from datetime import datetime, timezone

CLIENTS = [
    ('FC Dynamics', '/tmp/fc_dynamics_logs.json', 'client_1772616693_8b881fe7'),
    ('MFP Trading', '/tmp/mfp_trading_logs.json', 'client_1776011770_6aff114c'),
]

for name, path, client_id in CLIENTS:
    print(f"\n{'='*80}\n{name}  ({client_id})\n{'='*80}")
    with open(path) as f:
        events = json.load(f)
    print(f"Total events touching client_id in last 30d: {len(events)}")
    if not events:
        continue

    events.sort(key=lambda e: e[0])

    # Cluster events by gap > 60s into runs
    runs = []
    current = []
    last_ts = None
    for ts, msg in events:
        if last_ts is not None and ts - last_ts > 60_000:
            if current:
                runs.append(current)
            current = []
        current.append((ts, msg))
        last_ts = ts
    if current:
        runs.append(current)

    print(f"Detected {len(runs)} run cluster(s) (60s gap heuristic)\n")

    for i, run in enumerate(runs[-3:], start=max(1, len(runs)-2)):
        first_ts = run[0][0]
        last_ts = run[-1][0]
        first_dt = datetime.fromtimestamp(first_ts/1000, tz=timezone.utc).isoformat()
        last_dt = datetime.fromtimestamp(last_ts/1000, tz=timezone.utc).isoformat()

        active_keys_lines = [m for _, m in run if 'Active upload keys for enrichment:' in m]
        skipping_lines = [m for _, m in run if 'Skipping inactive/deleted file:' in m]
        processing_lines = [m for _, m in run if 'Processing file:' in m]
        extracted_lines = [m for _, m in run if 'Extracted text from' in m]
        analyzing_lines = [m for _, m in run if 'Analyzing' in m and 'source(s) for client' in m]
        async_lines = [m for _, m in run if 'Async enrichment invoked' in m]

        print(f"--- Run {i}  start={first_dt}  end={last_dt}  events={len(run)} ---")
        print(f"  'Async enrichment invoked'            ({len(async_lines)})")
        for m in async_lines:
            print(f"     {m.strip()}")
        print(f"  'Active upload keys for enrichment:'  ({len(active_keys_lines)})")
        for m in active_keys_lines:
            print(f"     {m.strip()}")
        print(f"  'Processing file:'                    ({len(processing_lines)})")
        for m in processing_lines:
            print(f"     {m.strip()}")
        print(f"  'Skipping inactive/deleted file:'     ({len(skipping_lines)})")
        for m in skipping_lines:
            print(f"     {m.strip()}")
        print(f"  'Extracted text from N files'         ({len(extracted_lines)})")
        for m in extracted_lines:
            print(f"     {m.strip()}")
        print(f"  'Analyzing N source(s) for client'    ({len(analyzing_lines)})")
        for m in analyzing_lines:
            print(f"     {m.strip()}")
        print()
