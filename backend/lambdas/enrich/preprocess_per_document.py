"""
XO Capture — Stage 1 per-document preprocessing.

For every uploaded file the enrich Lambda processes, we run a small Claude
call that extracts a structured per-document summary (distinctive_facts,
named_entities, decisions, action_items, quotes). Stage 2 (synthesis)
consumes those summaries instead of raw concatenated text.

Stage 1 results are cached in the `document_analyses` table keyed by
(upload_id, etag, prompt_version). Re-enriching an unchanged corpus
reuses every row; changing a file (new ETag) or bumping
STAGE1_PROMPT_VERSION naturally invalidates entries.

Stage 2 is NEVER cached — synthesis depends on the full corpus + skills +
client context, all of which can change between runs.
"""
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed


# Bumped manually whenever STAGE1_PROMPT below changes substantively.
# Old cache rows with a different prompt_version are ignored (and
# eventually orphaned). Never decrement.
STAGE1_PROMPT_VERSION = "v1"


STAGE1_PROMPT = """You are extracting structured intelligence from a single
business document. Your output will be one of several per-document summaries
fed into a downstream synthesis stage.

DOCUMENT FILENAME: {filename}
DOCUMENT KIND HINT: {kind_hint}

DOCUMENT CONTENT:
{full_text}

Extract the following. Be specific and verbatim where possible — distinctive
facts must be tied to THIS document, not paraphrased generalities.

Return valid JSON only (no markdown, no commentary). Schema:

{{
  "distinctive_facts": [
    "5-10 specific facts that this document — and probably only this document — establishes. Numbers, dates, named entities, decisions, claims with evidence."
  ],
  "named_entities": {{
    "people":        ["..."],
    "organisations": ["..."],
    "places":        ["..."],
    "products":      ["..."],
    "regulations":   ["standards, statutes, frameworks"]
  }},
  "decisions":    ["Decisions made or directions agreed in this document"],
  "action_items": ["Who does what, by when, per this document"],
  "quotes": [
    "3-6 verbatim short quotes that capture intent, scale, or distinctive detail"
  ],
  "overlap_signals": [
    "Phrases or sections that suggest this document overlaps heavily with another. Empty list if none obvious."
  ],
  "summary_2_lines": "Two-line summary of what THIS document uniquely contributes."
}}
"""


CONVERSATIONAL_MARKERS = re.compile(
    r"\b(yeah|bear with me|umm|kinda|gonna|you know|i mean|like\s|right\?)\b",
    re.IGNORECASE,
)
SPEAKER_TURN = re.compile(r"^\s*(\d+:\d+\s*-\s*\w+|Speaker\s+\d+:|[A-Z][a-z]+\s+[A-Z][a-z]+:)", re.MULTILINE)
EMAIL_HEADERS = re.compile(r"^From:.*\n.*^To:.*\n.*^Subject:", re.MULTILINE | re.DOTALL)


def kind_hint(filename, text):
    """Cheap heuristic for the Stage 1 prompt's KIND HINT line.

    Not load-bearing — Stage 1 still extracts the same fields if the hint
    is wrong. We just nudge the model toward the right framing.
    """
    name = filename.lower()
    head = (text or "")[:1500]

    if name.endswith(('.csv', '.xlsx', '.xls')):
        return 'data'
    if name.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.sh', '.sql')):
        return 'code'
    if (
        re.search(r"(^|/)(mail|fw_|re_|fwd?_)", name)
        or 'mail' in name and ('re:' in head.lower() or 'fwd:' in head.lower())
        or EMAIL_HEADERS.search(head[:600])
    ):
        return 'email'

    speaker_turns = len(SPEAKER_TURN.findall(text or ""))
    convo_hits = len(CONVERSATIONAL_MARKERS.findall(text or ""))
    chars = max(1, len(text or ""))
    if speaker_turns >= max(3, chars // 2000) or convo_hits / chars >= 0.005:
        return 'transcript'

    return 'brief'


# ──────────────────────────────────────────────
# Cache helpers
# ──────────────────────────────────────────────

def get_cached_stage1(cur, upload_id, etag, prompt_version):
    """Return cached stage1_output dict, or None if no row matches."""
    cur.execute(
        "SELECT stage1_output FROM document_analyses "
        "WHERE upload_id = %s AND etag = %s AND prompt_version = %s",
        (upload_id, etag, prompt_version),
    )
    row = cur.fetchone()
    if not row:
        return None
    val = row[0]
    # psycopg2 returns jsonb as already-parsed dict on most setups; defensive
    # decode if it ever comes back as text.
    if isinstance(val, str):
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return None
    return val


def write_cached_stage1(cur, upload_id, etag, prompt_version, stage1_output):
    """INSERT ... ON CONFLICT DO NOTHING. Race-safe with concurrent runs."""
    cur.execute(
        "INSERT INTO document_analyses (upload_id, etag, prompt_version, stage1_output) "
        "VALUES (%s, %s, %s, %s::jsonb) "
        "ON CONFLICT (upload_id, etag, prompt_version) DO NOTHING",
        (upload_id, etag, prompt_version, json.dumps(stage1_output)),
    )


# ──────────────────────────────────────────────
# Stage 1 single-file call
# ──────────────────────────────────────────────

# Keep a buffer below Anthropic's input window. Files larger than this get
# their head sent. Stage 2 still receives the structured summary — no
# full-text drop on Stage 1 unless the file is genuinely enormous.
MAX_STAGE1_INPUT_CHARS = 100_000


def _build_stage1_prompt(filename, text):
    truncated = False
    if len(text) > MAX_STAGE1_INPUT_CHARS:
        text = text[:MAX_STAGE1_INPUT_CHARS]
        truncated = True
    prompt = STAGE1_PROMPT.format(
        filename=filename,
        kind_hint=kind_hint(filename, text),
        full_text=text,
    )
    return prompt, truncated


def _strip_code_fence(s):
    """Pull JSON out of ```json ... ``` or ``` ... ``` blocks if present."""
    s = s.strip()
    if s.startswith('```json'):
        s = s[7:]
        end = s.rfind('```')
        if end != -1:
            s = s[:end]
    elif s.startswith('```'):
        s = s[3:]
        end = s.rfind('```')
        if end != -1:
            s = s[:end]
    return s.strip()


def _parse_stage1_response(response_text):
    """Parse the model's JSON response. Raise on unrecoverable errors."""
    body = _strip_code_fence(response_text)
    return json.loads(body)


def _fallback_stage1(filename, reason):
    """Stub Stage 1 output when extraction failed entirely.

    Stage 2 still sees the file by filename — it just has no distinctive
    content to draw on. The cache row is NOT written so the next run
    retries cleanly.
    """
    return {
        'filename': filename,
        'extraction_failed': True,
        'failure_reason': reason,
        'distinctive_facts': [],
        'named_entities': {
            'people': [], 'organisations': [], 'places': [], 'products': [], 'regulations': [],
        },
        'decisions': [],
        'action_items': [],
        'quotes': [],
        'overlap_signals': [],
        'summary_2_lines': f"Stage 1 extraction failed for {filename}: {reason}",
    }


def _call_stage1(filename, text, model_id, bedrock_invoker):
    """Invoke Bedrock for one file, parse, and decorate with metadata.

    `bedrock_invoker(model_id, body_json_str) -> response_dict` is supplied
    by the caller so we mirror whichever auth path the parent Lambda uses
    (bearer-token urllib or boto3 IAM converse) without re-implementing it.
    """
    prompt, truncated = _build_stage1_prompt(filename, text)
    body = json.dumps({
        "messages": [{"role": "user", "content": [{"text": prompt}]}],
        "inferenceConfig": {"maxTokens": 4000, "temperature": 0.2},
    })

    response = bedrock_invoker(model_id, body)
    response_text = response['output']['message']['content'][0]['text']

    try:
        parsed = _parse_stage1_response(response_text)
    except json.JSONDecodeError as e:
        return _fallback_stage1(filename, f"JSON parse failed: {e}")

    # Decorate with bookkeeping fields
    parsed.setdefault('distinctive_facts', [])
    parsed.setdefault('named_entities', {})
    parsed.setdefault('decisions', [])
    parsed.setdefault('action_items', [])
    parsed.setdefault('quotes', [])
    parsed.setdefault('overlap_signals', [])
    parsed.setdefault('summary_2_lines', '')
    parsed['filename'] = filename
    parsed['kind_hint'] = kind_hint(filename, text)
    parsed['chars_in'] = len(text)
    parsed['chars_used'] = min(len(text), MAX_STAGE1_INPUT_CHARS)
    parsed['stage1_input_truncated'] = truncated
    parsed['model'] = model_id
    parsed['extraction_failed'] = False
    return parsed


# ──────────────────────────────────────────────
# Parallel dispatch with caching
# ──────────────────────────────────────────────

def run_stage1_parallel(
    extracted_text,
    upload_meta,
    conn,
    *,
    model_id,
    bedrock_invoker,
    max_workers=8,
):
    """For each file in extracted_text, return a Stage 1 structured summary.

    Args:
      extracted_text: dict {filename: text}.
      upload_meta:    dict {filename: {'upload_id': str, 'etag': str}}.
                      Files without an entry (e.g. transcripts of audio
                      uploads where the canonical row is the audio file)
                      are processed but never cached.
      conn:           psycopg2 connection. DB ops happen on the main
                      thread only; Bedrock calls run in workers.
      model_id:       Bedrock model id for Stage 1. Caller supplies the
                      same model the rest of the enrichment uses — this
                      module does not pin a specific model.
      bedrock_invoker: callable matching _invoke_bedrock_bearer's signature.
      max_workers:    cap on ThreadPoolExecutor concurrency.

    Returns:
      dict {filename: stage1_output_dict}.
    """
    results = {}
    misses = []

    cur = conn.cursor()
    try:
        for filename, text in extracted_text.items():
            meta = upload_meta.get(filename) or {}
            upload_id = meta.get('upload_id')
            etag = meta.get('etag')

            if upload_id and etag:
                cached = get_cached_stage1(cur, upload_id, etag, STAGE1_PROMPT_VERSION)
                if cached is not None:
                    print(
                        f"Stage 1 cache hit:  upload_id={upload_id} etag={etag} "
                        f"filename={filename!r}"
                    )
                    results[filename] = cached
                    continue
                print(
                    f"Stage 1 cache miss: upload_id={upload_id} etag={etag} "
                    f"filename={filename!r} (running Claude)"
                )
            else:
                print(
                    f"Stage 1 cache skip: filename={filename!r} (no upload_id/etag, "
                    f"running Claude without caching)"
                )

            misses.append((filename, text, upload_id, etag))
    finally:
        cur.close()

    if misses:
        with ThreadPoolExecutor(max_workers=max(1, min(max_workers, len(misses)))) as ex:
            future_to_meta = {
                ex.submit(_call_stage1, filename, text, model_id, bedrock_invoker):
                    (filename, upload_id, etag)
                for filename, text, upload_id, etag in misses
            }
            for fut in as_completed(future_to_meta):
                filename, upload_id, etag = future_to_meta[fut]
                try:
                    stage1_output = fut.result()
                except Exception as e:
                    print(f"Stage 1 failed for {filename!r}: {type(e).__name__}: {e}")
                    stage1_output = _fallback_stage1(filename, f"{type(e).__name__}: {e}")
                results[filename] = stage1_output

        cur = conn.cursor()
        try:
            for filename, _text, upload_id, etag in misses:
                if not (upload_id and etag):
                    continue
                output = results.get(filename)
                if not output or output.get('extraction_failed'):
                    continue
                write_cached_stage1(cur, upload_id, etag, STAGE1_PROMPT_VERSION, output)
            conn.commit()
        finally:
            cur.close()

    cached_count = len(extracted_text) - len(misses)
    print(
        f"Stage 1 dispatch summary: {cached_count}/{len(extracted_text)} cached, "
        f"{len(misses)} ran fresh, parallel_workers="
        f"{max(1, min(max_workers, max(1, len(misses))))}"
    )
    return results


# ──────────────────────────────────────────────
# Stage 2 input formatter
# ──────────────────────────────────────────────

def build_stage2_input(stage1_summaries):
    """Format Stage 1 outputs as one block per file for the synthesis prompt.

    Replaces the old text[:5000] concat. Stage 2 sees structured fields
    (distinctive facts, entities, decisions, quotes) instead of raw text.
    """
    blocks = []
    for filename, s1 in stage1_summaries.items():
        ne = s1.get('named_entities') or {}
        people = ", ".join(ne.get('people', []) or []) or '—'
        orgs = ", ".join(ne.get('organisations', []) or []) or '—'
        places = ", ".join(ne.get('places', []) or []) or '—'
        products = ", ".join(ne.get('products', []) or []) or '—'
        regs = ", ".join(ne.get('regulations', []) or []) or '—'

        facts = s1.get('distinctive_facts') or []
        decisions = s1.get('decisions') or []
        actions = s1.get('action_items') or []
        quotes = s1.get('quotes') or []
        overlaps = s1.get('overlap_signals') or []

        block = [f"=== {filename} ==="]
        block.append(f"KIND: {s1.get('kind_hint', 'unknown')}")
        block.append(f"2-LINE SUMMARY: {s1.get('summary_2_lines', '').strip()}")
        block.append("DISTINCTIVE FACTS:")
        for f in facts:
            block.append(f"  - {f}")
        block.append(
            f"NAMED ENTITIES: people=[{people}]; organisations=[{orgs}]; "
            f"places=[{places}]; products=[{products}]; regulations=[{regs}]"
        )
        if decisions:
            block.append("DECISIONS:")
            for d in decisions:
                block.append(f"  - {d}")
        if actions:
            block.append("ACTION ITEMS:")
            for a in actions:
                block.append(f"  - {a}")
        if quotes:
            block.append("KEY QUOTES:")
            for q in quotes:
                block.append(f'  - "{q}"')
        if overlaps:
            block.append("OVERLAPS WITH: " + "; ".join(overlaps))
        else:
            block.append("OVERLAPS WITH: none flagged")
        if s1.get('extraction_failed'):
            block.append(
                "NOTE: Stage 1 extraction failed for this file — "
                "no structured signal available. Cite by filename only."
            )
        blocks.append("\n".join(block))

    return "\n\n".join(blocks)
