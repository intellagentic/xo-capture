"""Step A v2: locate the log streams holding the most recent enrichment Phase 2
async run for each client, then pull ALL events from those streams and count
the diagnostic lines."""
import boto3
import json
from datetime import datetime, timezone, timedelta

session = boto3.Session(profile_name='intellagentic', region_name='eu-west-2')
logs = session.client('logs')

# These enrichment_ids came from the Phase 1 log lines in v1
RUNS = [
    ('FC Dynamics', 'client_1772616693_8b881fe7', '12e46d43-2ab5-4c4e-a7a1-1c161a027d41', '2026-04-25T15:27:00Z'),
    ('MFP Trading', 'client_1776011770_6aff114c', '6c81490f-491a-4708-ab8c-3ebd4e93f45c', '2026-04-21T17:04:00Z'),
]

LOG_GROUP = '/aws/lambda/xo-enrich'

for name, client_id, enrich_id, around_iso in RUNS:
    print(f"\n{'='*80}\n{name}  enrichment={enrich_id}\n{'='*80}")
    around_dt = datetime.fromisoformat(around_iso.replace('Z','+00:00'))
    start_ms = int((around_dt - timedelta(minutes=1)).timestamp() * 1000)
    end_ms = int((around_dt + timedelta(minutes=20)).timestamp() * 1000)

    # Step 1: find log streams that mention the client_id during this window
    # Use filter_log_events with both client_id AND enrich_id to pin down the
    # invocation streams, then pull every event in those streams.
    paginator = logs.get_paginator('filter_log_events')
    stream_set = set()
    for page in paginator.paginate(
        logGroupName=LOG_GROUP,
        startTime=start_ms,
        endTime=end_ms,
        filterPattern=f'"{client_id}"',
    ):
        for ev in page.get('events', []):
            stream_set.add(ev['logStreamName'])

    print(f"Streams referencing {client_id} in window: {len(stream_set)}")
    for s in sorted(stream_set):
        print(f"  {s}")

    # Step 2: for each stream, pull every event in the time window and tally
    all_events = []
    for stream in sorted(stream_set):
        resp = logs.get_log_events(
            logGroupName=LOG_GROUP,
            logStreamName=stream,
            startTime=start_ms,
            endTime=end_ms,
            startFromHead=True,
        )
        all_events.extend([(ev['timestamp'], stream, ev['message']) for ev in resp['events']])
        # paginate the rest
        prev_token = None
        token = resp.get('nextForwardToken')
        while token and token != prev_token:
            prev_token = token
            resp = logs.get_log_events(
                logGroupName=LOG_GROUP,
                logStreamName=stream,
                startTime=start_ms,
                endTime=end_ms,
                startFromHead=True,
                nextToken=token,
            )
            new_events = [(ev['timestamp'], stream, ev['message']) for ev in resp['events']]
            if not new_events:
                break
            all_events.extend(new_events)
            token = resp.get('nextForwardToken')

    # Filter to events that mention either the client_id OR enrich_id OR are
    # within a stream that contained one — the streams already passed that
    # filter, so all_events covers the full Lambda invocation logs.
    all_events.sort(key=lambda x: x[0])
    print(f"\nTotal events across those streams in window: {len(all_events)}")

    indicators = [
        'Async enrichment invoked',
        'Active upload keys for enrichment:',
        'Processing file:',
        'Skipping inactive/deleted file:',
        'Audio file — will be handled by Transcribe',
        'Unsupported file type',
        'Error extracting',
        'Extracted text from',
        'Analyzing',
        'No uploaded documents',
        'Stage updated:',
    ]

    for ind in indicators:
        matches = [e for e in all_events if ind in e[2]]
        if matches:
            print(f"\n  '{ind}' ({len(matches)})")
            for ts, stream, msg in matches:
                ts_dt = datetime.fromtimestamp(ts/1000, tz=timezone.utc).strftime('%H:%M:%S')
                print(f"     {ts_dt}  {msg.strip()[:200]}")
