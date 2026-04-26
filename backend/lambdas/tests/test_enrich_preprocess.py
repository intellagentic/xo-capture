"""
Tests for the new Stage 1 per-document preprocessing path:
  - preprocess_per_document.run_stage1_parallel + caching
  - extract_text(.md)
  - end-to-end Stage 2 input formatting on FC Dynamics + MFP Trading fixtures
"""
import os
import sys
import json
import pytest
from unittest.mock import MagicMock

# Make enrich-lambda dir importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'enrich'))

import preprocess_per_document as pp  # noqa: E402


def _stage1_response(distinctive_facts, named_entities=None, decisions=None,
                     action_items=None, quotes=None, overlap_signals=None,
                     summary='one-line.\nsecond line.'):
    """Build a Bedrock Converse-shaped response carrying a Stage 1 JSON body."""
    body = {
        'distinctive_facts': distinctive_facts,
        'named_entities': named_entities or {
            'people': [], 'organisations': [], 'places': [], 'products': [], 'regulations': [],
        },
        'decisions': decisions or [],
        'action_items': action_items or [],
        'quotes': quotes or [],
        'overlap_signals': overlap_signals or [],
        'summary_2_lines': summary,
    }
    return {
        'output': {'message': {'content': [{'text': json.dumps(body)}]}},
        'stopReason': 'end_turn',
    }


def _make_conn():
    """psycopg2-shaped MagicMock with a fresh cursor each call."""
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


# ──────────────────────────────────────────────
# Test 1: Stage 1 extracts structured output (mocked Claude)
# ──────────────────────────────────────────────

def test_stage1_extracts_structured_output():
    conn, cur = _make_conn()
    cur.fetchone.return_value = None  # cache miss
    invoker = MagicMock(return_value=_stage1_response(
        distinctive_facts=['Tringham House Bournemouth, BH7 7DT'],
        named_entities={'organisations': ['Bennington Green'], 'places': ['Bournemouth'],
                        'people': [], 'products': [], 'regulations': []},
        summary='Fire strategy for Tringham House.\nUniversity Hospitals Dorset.',
    ))

    out = pp.run_stage1_parallel(
        extracted_text={'Fire Strategy.pdf': 'Bennington Green Ltd ... Tringham House ...'},
        upload_meta={'Fire Strategy.pdf': {'upload_id': 'u1', 'etag': 'etag1'}},
        conn=conn,
        model_id='haiku-test',
        bedrock_invoker=invoker,
    )

    assert 'Fire Strategy.pdf' in out
    s1 = out['Fire Strategy.pdf']
    assert s1['filename'] == 'Fire Strategy.pdf'
    assert s1.get('retries', 0) == 0
    assert 'Tringham House Bournemouth, BH7 7DT' in s1['distinctive_facts']
    assert 'Bennington Green' in s1['named_entities']['organisations']
    assert s1['model'] == 'haiku-test'
    assert s1['chars_in'] > 0
    invoker.assert_called_once()


# ──────────────────────────────────────────────
# Test 2: Stage 1 cache hit skips Claude
# ──────────────────────────────────────────────

def test_stage1_cache_hit_skips_claude():
    conn, cur = _make_conn()
    pre_cached = {
        'filename': 'Fire Strategy.pdf',
        'distinctive_facts': ['Tringham House Bournemouth'],
        'named_entities': {},
        'extraction_failed': False,
        'summary_2_lines': 'cached row',
    }
    # SELECT returns the cached row — psycopg2 returns dict for jsonb
    cur.fetchone.return_value = (pre_cached,)

    invoker = MagicMock(side_effect=AssertionError("Bedrock must NOT be called on cache hit"))

    out = pp.run_stage1_parallel(
        extracted_text={'Fire Strategy.pdf': 'doc text'},
        upload_meta={'Fire Strategy.pdf': {'upload_id': 'u1', 'etag': 'etag1'}},
        conn=conn,
        model_id='haiku-test',
        bedrock_invoker=invoker,
    )

    assert out['Fire Strategy.pdf'] == pre_cached
    invoker.assert_not_called()
    # No INSERT issued either — only a SELECT
    insert_calls = [c for c in cur.execute.call_args_list
                    if 'INSERT INTO document_analyses' in c[0][0]]
    assert insert_calls == []


# ──────────────────────────────────────────────
# Test 3: Stage 1 cache miss runs Claude AND writes the row
# ──────────────────────────────────────────────

def test_stage1_cache_miss_runs_and_writes():
    conn, cur = _make_conn()
    cur.fetchone.return_value = None  # cache miss
    invoker = MagicMock(return_value=_stage1_response(
        distinctive_facts=['$4.5 billion peak'],
    ))

    out = pp.run_stage1_parallel(
        extracted_text={'mfp.docx': 'Becket House ... $4.5 billion'},
        upload_meta={'mfp.docx': {'upload_id': 'u-mfp', 'etag': 'etag-mfp'}},
        conn=conn,
        model_id='haiku-test',
        bedrock_invoker=invoker,
    )

    assert out['mfp.docx']['distinctive_facts'] == ['$4.5 billion peak']
    invoker.assert_called_once()

    # Confirm INSERT was executed with the right key tuple
    insert_calls = [c for c in cur.execute.call_args_list
                    if 'INSERT INTO document_analyses' in c[0][0]]
    assert len(insert_calls) == 1
    args = insert_calls[0][0][1]
    assert args[0] == 'u-mfp'
    assert args[1] == 'etag-mfp'
    assert args[2] == pp.STAGE1_PROMPT_VERSION
    inserted = json.loads(args[3])
    assert inserted['distinctive_facts'] == ['$4.5 billion peak']
    conn.commit.assert_called()


# ──────────────────────────────────────────────
# Test 4: end-to-end FC Dynamics — Stage 2 input has one block per file
# ──────────────────────────────────────────────

def test_end_to_end_fc_dynamics():
    fc_files = {
        'Fire Strategy.pdf': 'Bennington Green ... Tringham House ... University Hospitals Dorset',
        'Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf':
            'Sittingbourne Library, Central Ave, Kent ... FB SURVEYING LIMITED',
        'Intro Call Edem and Alan Transcript.txt':
            '0:02 - Edem Brampah\nYeah ... Southern Housing ... Crewe ... AWAB\'s law',
    }
    fc_meta = {
        f: {'upload_id': f'u-{i}', 'etag': f'etag-{i}'}
        for i, f in enumerate(fc_files)
    }

    # Per-file Stage 1 stubs — each file gets its distinctive content back.
    responses = {
        'Fire Strategy.pdf': _stage1_response(
            distinctive_facts=['Tringham House at 580 Deansleigh Road, Bournemouth'],
            named_entities={'organisations': ['Bennington Green', 'University Hospitals Dorset'],
                            'people': [], 'places': ['Bournemouth'], 'products': [], 'regulations': []},
        ),
        'Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf': _stage1_response(
            distinctive_facts=['Sittingbourne Library, Central Ave, Kent ME10 4AH'],
            named_entities={'organisations': ['FB SURVEYING LIMITED'], 'people': [],
                            'places': ['Sittingbourne'], 'products': [], 'regulations': []},
        ),
        'Intro Call Edem and Alan Transcript.txt': _stage1_response(
            distinctive_facts=["Southern Housing Group meeting in Fulham; AWAB's law mentioned"],
            named_entities={'organisations': ['Southern Housing'], 'people': ['Edem Brampah', 'Alan Moore'],
                            'places': ['Crewe', 'Fulham'], 'products': [], 'regulations': []},
        ),
    }

    def invoker(model_id, body_str):
        body = json.loads(body_str)
        prompt = body['messages'][0]['content'][0]['text']
        for fname, resp in responses.items():
            if f'DOCUMENT FILENAME: {fname}' in prompt:
                return resp
        raise AssertionError(f"Unrecognised prompt — no fixture matched\n{prompt[:300]}")

    conn, cur = _make_conn()
    cur.fetchone.return_value = None

    stage1 = pp.run_stage1_parallel(
        extracted_text=fc_files, upload_meta=fc_meta, conn=conn,
        model_id='haiku-test', bedrock_invoker=invoker,
    )

    # All 3 files came back
    assert set(stage1.keys()) == set(fc_files.keys())
    assert stage1['Fire Strategy.pdf']['distinctive_facts'] == [
        'Tringham House at 580 Deansleigh Road, Bournemouth'
    ]
    assert "Southern Housing Group" in stage1['Intro Call Edem and Alan Transcript.txt']['distinctive_facts'][0]

    # Stage 2 input formatter produces one block per file with key signal
    s2 = pp.build_stage2_input(stage1)
    assert s2.count('===') == 6  # one open + close marker per filename
    for fname in fc_files:
        assert f'=== {fname} ===' in s2
    assert 'Tringham House' in s2
    assert 'FB SURVEYING' in s2
    assert "Southern Housing" in s2


# ──────────────────────────────────────────────
# Test 5: end-to-end MFP Trading — overlap_signals surface in Stage 2 input
# ──────────────────────────────────────────────

def test_end_to_end_mfp_trading_overlaps_surface():
    mfp_files = {
        'mfp_briefing.docx': 'Becket House, Old Jewry ... Mabrouka Abuhmida ... $4.5 billion',
        'mfp_briefing (1).docx': 'Becket House, Old Jewry ... Mabrouka Abuhmida ... $4.5 billion',
        'IntellagenticXO MFP Deep Dive.pdf': 'Minerva platform ... 5 exception types ... CreditAlertEngine',
    }
    mfp_meta = {
        f: {'upload_id': f'u-{i}', 'etag': f'etag-{i}'}
        for i, f in enumerate(mfp_files)
    }

    responses = {
        'mfp_briefing.docx': _stage1_response(
            distinctive_facts=['Becket House, 36 Old Jewry, London'],
            named_entities={'people': ['Mabrouka Abuhmida'], 'organisations': [],
                            'places': ['Old Jewry'], 'products': [], 'regulations': []},
            overlap_signals=['Same executive summary as mfp_briefing (1).docx'],
        ),
        'mfp_briefing (1).docx': _stage1_response(
            distinctive_facts=['Becket House, 36 Old Jewry, London'],
            named_entities={'people': ['Mabrouka Abuhmida'], 'organisations': [],
                            'places': ['Old Jewry'], 'products': [], 'regulations': []},
            overlap_signals=['Near-identical to mfp_briefing.docx'],
        ),
        'IntellagenticXO MFP Deep Dive.pdf': _stage1_response(
            distinctive_facts=['Minerva is MFP\'s proprietary FX bridging platform',
                               '5 exception types — not 6 — per Lisa\'s April 10 email'],
            named_entities={'products': ['Minerva', 'CreditAlertEngine'], 'people': [], 'organisations': [],
                            'places': [], 'regulations': []},
        ),
    }

    def invoker(model_id, body_str):
        body = json.loads(body_str)
        prompt = body['messages'][0]['content'][0]['text']
        for fname, resp in responses.items():
            if f'DOCUMENT FILENAME: {fname}' in prompt:
                return resp
        raise AssertionError(f"No fixture matched")

    conn, cur = _make_conn()
    cur.fetchone.return_value = None

    stage1 = pp.run_stage1_parallel(
        extracted_text=mfp_files, upload_meta=mfp_meta, conn=conn,
        model_id='haiku-test', bedrock_invoker=invoker,
    )
    s2 = pp.build_stage2_input(stage1)

    # Overlap signals show up in the Stage 2 input, so Claude can populate
    # consolidated_with on the corresponding sources[] entries.
    assert 'OVERLAPS WITH:' in s2
    assert 'mfp_briefing (1).docx' in s2  # cited as overlapping in the .docx block
    assert 'mfp_briefing.docx' in s2

    # Distinctive facts survive: Minerva, exception types
    assert 'Minerva' in s2
    assert '5 exception types' in s2 or 'exception types' in s2


# ──────────────────────────────────────────────
# Test 6: .md upload + extract path
# ──────────────────────────────────────────────

@pytest.fixture
def enrich_module():
    """Light reload of the enrich Lambda module for extract_text testing."""
    enrich_dir = os.path.join(os.path.dirname(__file__), '..', 'enrich')
    if enrich_dir not in sys.path:
        sys.path.insert(0, enrich_dir)
    if 'lambda_function' in sys.modules:
        del sys.modules['lambda_function']
    # Stub psycopg2 to avoid real DB on import
    from unittest.mock import patch
    with patch.dict(os.environ, {
        'DATABASE_URL': 'postgresql://fake', 'JWT_SECRET': 'test',
        'BUCKET_NAME': 'test-bucket', 'ANTHROPIC_API_KEY': 'test-key',
    }):
        with patch('psycopg2.connect'):
            import importlib
            import lambda_function
            importlib.reload(lambda_function)
            yield lambda_function
            del sys.modules['lambda_function']


def test_md_extract_text_returns_full_content(enrich_module):
    md_bytes = b"# Heading\n\nDistinctive: zphq-marker-9217\n\n- bullet one\n- bullet two\n"
    out = enrich_module.extract_text("notes.md", md_bytes)
    assert out is not None
    assert "zphq-marker-9217" in out
    assert "# Heading" in out
    assert "bullet one" in out


def test_md_extract_text_handles_invalid_utf8(enrich_module):
    # `extract_text` for md uses errors='replace' so a stray byte does not raise
    bad_bytes = b"# Header\n\xff\xfe valid tail\n"
    out = enrich_module.extract_text("rough.md", bad_bytes)
    assert out is not None
    assert "valid tail" in out


# ──────────────────────────────────────────────
# 429 retry behaviour
# ──────────────────────────────────────────────

def _throttle_error():
    return Exception("Bedrock API error 429: {\"message\":\"Too many requests, please wait before trying again.\"}")


def test_stage1_retries_on_throttle_then_succeeds():
    """One 429, then a valid response on retry. _call_stage1 must NOT raise,
    must return the parsed Stage 1 output, and must record retries=1."""
    invoker = MagicMock(side_effect=[
        _throttle_error(),
        _stage1_response(distinctive_facts=['canonical fact']),
    ])
    sleep_calls = []

    out = pp._bedrock_invoke_with_retry(
        'haiku-test',
        '{"messages":[]}',
        invoker,
        sleep=sleep_calls.append,  # avoid real sleep in tests
    )
    response, attempts = out
    assert attempts == 2
    assert invoker.call_count == 2
    assert len(sleep_calls) == 1  # one backoff between attempt 1 and attempt 2
    assert sleep_calls[0] >= 1.0  # at least 2^0 = 1s + jitter

    # Now end-to-end through _call_stage1 to verify retries propagates to output
    invoker2 = MagicMock(side_effect=[
        _throttle_error(),
        _stage1_response(distinctive_facts=['canonical fact']),
    ])
    import preprocess_per_document as ppm
    original_sleep = ppm.time.sleep
    ppm.time.sleep = lambda *_: None
    try:
        result = ppm._call_stage1('doc.pdf', 'text body', 'haiku-test', invoker2)
    finally:
        ppm.time.sleep = original_sleep
    assert result['retries'] == 1
    assert result['distinctive_facts'] == ['canonical fact']


def test_stage1_raises_after_retries_exhausted():
    """Throttle on every attempt. _bedrock_invoke_with_retry must give up
    after MAX_STAGE1_RETRIES + 1 calls and re-raise the last error."""
    invoker = MagicMock(side_effect=[_throttle_error()] * 10)
    import preprocess_per_document as ppm

    with pytest.raises(Exception) as exc_info:
        ppm._bedrock_invoke_with_retry(
            'haiku-test',
            '{"messages":[]}',
            invoker,
            sleep=lambda *_: None,
        )
    assert '429' in str(exc_info.value)
    # Total attempts = 1 initial + MAX_STAGE1_RETRIES retries
    assert invoker.call_count == ppm.MAX_STAGE1_RETRIES + 1


def test_stage1_non_throttle_error_is_not_retried():
    """A non-429 error (e.g. AccessDenied) should bypass the retry loop and
    surface immediately so deeper bugs aren't masked."""
    invoker = MagicMock(side_effect=[Exception("AccessDeniedException: not allowed")])
    import preprocess_per_document as ppm

    with pytest.raises(Exception):
        ppm._bedrock_invoke_with_retry(
            'haiku-test',
            '{"messages":[]}',
            invoker,
            sleep=lambda *_: None,
        )
    assert invoker.call_count == 1


# ──────────────────────────────────────────────
# Stage 1 halt: failures propagate, no fallback served
# ──────────────────────────────────────────────

def test_run_stage1_parallel_raises_when_any_file_fails_after_retries():
    """When a file's Stage 1 call exhausts retries, run_stage1_parallel must
    raise Stage1FailedError. No fallback dict is served. Successful files
    are still cached so a re-run benefits."""
    files = {
        'good.pdf': 'good content',
        'throttled.pdf': 'throttled content',
    }
    meta = {
        'good.pdf':       {'upload_id': 'u-good', 'etag': 'e-good'},
        'throttled.pdf': {'upload_id': 'u-throt', 'etag': 'e-throt'},
    }

    def invoker(model_id, body_str):
        if 'DOCUMENT FILENAME: good.pdf' in body_str:
            return _stage1_response(distinctive_facts=['good fact'])
        # throttled.pdf — always 429
        raise Exception('Bedrock API error 429: rate limit')

    conn, cur = _make_conn()
    cur.fetchone.return_value = None  # cache miss for both

    # Patch sleep to keep the test fast
    import preprocess_per_document as ppm
    original_sleep = ppm.time.sleep
    ppm.time.sleep = lambda *_: None
    try:
        with pytest.raises(ppm.Stage1FailedError) as exc_info:
            ppm.run_stage1_parallel(
                files, meta, conn,
                model_id='haiku-test', bedrock_invoker=invoker,
                max_workers=2,
            )
    finally:
        ppm.time.sleep = original_sleep

    failures = exc_info.value.failures
    assert len(failures) == 1
    assert failures[0]['filename'] == 'throttled.pdf'
    assert '429' in failures[0]['last_error']

    # The succeeding file's row IS cached (partial-progress preservation)
    insert_calls = [c for c in cur.execute.call_args_list
                    if 'INSERT INTO document_analyses' in c[0][0]]
    inserted_keys = [c[0][1][0] for c in insert_calls]
    assert 'u-good' in inserted_keys
    assert 'u-throt' not in inserted_keys


def test_max_workers_default_is_3():
    """Pin DEFAULT_MAX_WORKERS to 3 — it's the throttle-safety knob and
    bumping it without explicit Bedrock-quota review reintroduces the
    Gate A 429 cascade. Lock the value."""
    import preprocess_per_document as ppm
    assert ppm.DEFAULT_MAX_WORKERS == 3
    assert ppm.MAX_STAGE1_RETRIES == 3
