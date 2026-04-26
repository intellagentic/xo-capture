# Build plan v2 — `/enrich` two-stage per-document analysis + cache + `.md` support

**Branch:** `fix/enrich-prompt-construction` (off `main`).
**Status:** PLAN ONLY — no code yet, awaiting Ken's approval. Full diff to be shown before deploy.
**Supersedes:** `audits/parked/2026-04-26-prompt-construction-build-plan-PARKED.md` (45h MinHash/heuristics plan; cancelled).
**Driver:** Step D citation-depth findings on `audits/2026-04-26-enrich-investigation` — 6 of 18 input files had zero unique content cited in the analysis JSON.
**Effort:** 6–12 hours.

---

## 1. Architecture — two stages

```
extract_all_files()              → dict {filename: text}                    (unchanged)
transcribe_audio_files()         → merges transcripts into the same dict     (unchanged)

──── STAGE 1: per-document analysis (NEW, parallel, cached) ────
for each file in extracted_text (in parallel via ThreadPoolExecutor):
    1. SELECT from document_analyses WHERE upload_id=X AND etag=Y AND prompt_version=Z
    2. cache hit  → log + reuse stage1_output
       cache miss → Claude call with full file text (chunk if >100k chars)
                    → INSERT row with ON CONFLICT DO NOTHING
                    → log
returns stage1_summaries: {upload_id: {filename, distinctive_facts, named_entities,
                                       decisions, action_items, quotes}}

──── STAGE 2: synthesis (existing analyse, modified, NEVER cached) ────
analyze_with_claude(stage1_summaries)
    - prompt template no longer concatenates raw text[:5000]
    - consumes structured per-file Stage 1 output
    - sources[] schema requires one entry per input filename
    - consolidated_with allowed only with explicit unique_angle text
```

**Key properties:**

- Stage 1 = **parallel + cached**, so re-enrichment of an unchanged corpus is near-free (~$0.05 Stage 2 only).
- Stage 1 = **full-text per file** (no `text[:5000]` cap). Chunk only at >100k chars (Anthropic context-window guardrail, not a budget concern). For our current FC Dynamics + MFP corpus, max file is 40k chars — no chunking needed in practice.
- Stage 2 = **fresh every run**, since synthesis depends on the full corpus + skills + client context which can change.
- `PROMPT_VERSION` constant in the Lambda invalidates all caches when the Stage 1 prompt template changes — bumped manually as part of any Stage 1 prompt edit.

---

## 2. Per-document caching

### Schema addition (`backend/schema.sql`, append at end alongside existing `ALTER` block style)

```sql
-- ============================================================
-- DOCUMENT_ANALYSES — per-file Stage 1 cache (xo-enrich)
-- One row per (upload version, prompt version) pair. Re-enriching an
-- unchanged corpus reuses these rows; changing the file (new ETag) or
-- bumping PROMPT_VERSION naturally invalidates the cache.
-- ============================================================
CREATE TABLE IF NOT EXISTS document_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    etag TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    stage1_output JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (upload_id, etag, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_document_analyses_upload_id
    ON document_analyses(upload_id);
```

- `etag` is the S3 ETag at analysis time. Read from `head_object` during Stage 1 dispatch.
- `prompt_version` is a Lambda-side constant (e.g. `STAGE1_PROMPT_VERSION = "v1"`). Bumped manually on prompt edits.
- `ON CONFLICT (upload_id, etag, prompt_version) DO NOTHING` makes concurrent enrichments race-safe — last writer doesn't clobber, both run Claude once each (idempotent waste, acceptable).
- `JSONB` so we can index on internals later if needed (e.g. by named entities).

### Apply path

The repo's schema.sql is the source of truth and already uses `CREATE TABLE IF NOT EXISTS` everywhere. Two applications:

1. Append the new table block to `backend/schema.sql` (matches existing style, idempotent).
2. Apply it once to production via psql:
   ```
   psql "$DATABASE_URL" -f backend/schema.sql   # idempotent — only the new table actually gets created
   ```
   Or apply just the new block via a one-shot connection. Either is safe.

### Lookup/write helpers (in `preprocess_per_document.py`)

```python
def get_cached_stage1(cur, upload_id, etag, prompt_version):
    cur.execute(
        "SELECT stage1_output FROM document_analyses "
        "WHERE upload_id = %s AND etag = %s AND prompt_version = %s",
        (upload_id, etag, prompt_version),
    )
    row = cur.fetchone()
    return row[0] if row else None

def write_cached_stage1(cur, upload_id, etag, prompt_version, stage1_output):
    cur.execute(
        "INSERT INTO document_analyses (upload_id, etag, prompt_version, stage1_output) "
        "VALUES (%s, %s, %s, %s::jsonb) "
        "ON CONFLICT (upload_id, etag, prompt_version) DO NOTHING",
        (upload_id, etag, prompt_version, json.dumps(stage1_output)),
    )
```

### Logging — for the cache verification gate

On every Stage 1 dispatch, emit one of:

```
Stage 1 cache hit:  upload_id=<uuid>  etag=<etag>  filename=<name>
Stage 1 cache miss: upload_id=<uuid>  etag=<etag>  filename=<name>  (running Claude)
Stage 1 dispatch summary: <hits>/<total> cached, <misses> ran fresh, parallel_workers=<n>
```

This makes the cache-verification gate (Section 7) trivially auditable from CloudWatch.

---

## 3. Stage 1 prompt + output schema

### Prompt template (in `preprocess_per_document.py`, version-tagged)

```
STAGE1_PROMPT_VERSION = "v1"

STAGE1_PROMPT = """You are extracting structured intelligence from a single
business document. Your output will be one of several per-document summaries
fed into a downstream synthesis stage.

DOCUMENT FILENAME: {filename}
DOCUMENT KIND HINT: {kind_hint}    # email|transcript|brief|data|other (cheap heuristic)

DOCUMENT CONTENT:
{full_text_or_chunk}

Extract the following. Be specific and verbatim where possible — distinctive
facts must be tied to THIS document, not paraphrased generalities.

Return JSON only:
{{
  "distinctive_facts": [
    "Specific facts that this document — and probably only this document — establishes. Numbers, dates, named entities, decisions, claims with evidence. 5-10 items."
  ],
  "named_entities": {{
    "people":        ["..."],
    "organisations": ["..."],
    "places":        ["..."],
    "products":      ["..."],
    "regulations":   ["..."]   // standards, statutes, frameworks
  }},
  "decisions":   ["Decisions made or directions agreed in this document"],
  "action_items":["Who does what, by when, per this document"],
  "quotes": [
    "3-6 verbatim short quotes that capture intent, scale, or distinctive detail"
  ],
  "overlap_signals": [
    "Phrases or sections that suggest this document overlaps heavily with another. Empty if none obvious."
  ],
  "summary_2_lines": "Two-line summary of what THIS document uniquely contributes."
}}
"""
```

### Stage 1 output (cached as `stage1_output` JSONB)

```json
{
  "filename": "<original upload filename>",
  "etag": "<S3 ETag>",
  "kind_hint": "transcript",
  "chars_in": 40184,
  "chars_used": 40184,
  "model": "claude-haiku-4-5-20251001",
  "distinctive_facts": ["..."],
  "named_entities": {"people":[...], "organisations":[...], ...},
  "decisions": ["..."],
  "action_items": ["..."],
  "quotes": ["..."],
  "overlap_signals": ["..."],
  "summary_2_lines": "..."
}
```

`kind_hint` is a 30-line heuristic (filename pattern + first-500c marker scan) used only to nudge Stage 1 — not load-bearing. If wrong, the structured extraction still works; the categories don't depend on the hint.

---

## 4. Stage 2 prompt + output schema changes

### What gets injected (replaces `text[:5000]` concat at `lambda_function.py:1300`)

```
=== <filename> ===
KIND: <kind_hint>
2-LINE SUMMARY: <stage1.summary_2_lines>
DISTINCTIVE FACTS:
  - <stage1.distinctive_facts[0]>
  - ...
NAMED ENTITIES: people=[...], organisations=[...], places=[...], products=[...], regulations=[...]
DECISIONS: ...
ACTION ITEMS: ...
KEY QUOTES:
  - "<stage1.quotes[0]>"
  - ...
OVERLAPS WITH: <stage1.overlap_signals or "none flagged">

=== <next filename> ===
...
```

### `sources[]` schema diff (around `lambda_function.py:1472`)

```diff
- "sources": [
-   {"type": "client_data", "reference": "filename or data source"}
- ]
+ "sources": [
+   {
+     "filename":         "<exact original upload filename>",
+     "type":             "client_data | client_config",
+     "distinctive_fact": "<one verbatim fact pulled from this file's Stage 1 distinctive_facts[]>",
+     "consolidated_with": [],
+     "unique_angle":     ""
+   }
+ ]
```

### New paragraph above `OUTPUT FORMAT` (around `lambda_function.py:1404`)

```
SOURCE COVERAGE REQUIREMENT (NON-NEGOTIABLE):
The DOCUMENT BLOCKS above contain one section per uploaded file. Your sources[]
array MUST contain exactly one entry per filename — never aggregate, never
silently drop. For each entry:
  - Set "distinctive_fact" to a verbatim or near-verbatim fact from THAT file's
    DISTINCTIVE FACTS section. Do not invent; do not paraphrase to genericness.
  - If a file genuinely overlaps with another (its OVERLAPS WITH section flags
    this), populate "consolidated_with" with the other filenames AND give an
    explicit "unique_angle" — what THIS file adds that the others don't (e.g.
    "anonymised version with Forex Ventures naming", "earlier version with
    pre-correction COO label"). Empty unique_angle is not allowed when
    consolidated_with is non-empty.
  - Otherwise leave consolidated_with as [] and unique_angle as "".
```

### Back-compat: legacy `sources[].reference` field

Server-side, after Claude returns, fill the legacy field for any unchanged consumers:
```python
for src in analysis.get('sources', []):
    if 'reference' not in src and 'filename' in src:
        src['reference'] = f"{src['filename']} — {src.get('distinctive_fact', '')}"
```
Drops the legacy field once UI / Streamline are confirmed migrated (separate branch).

---

## 5. `.md` support — three places

| Place | File | Change |
| --- | --- | --- |
| 1. Frontend file picker | `src/App.jsx:6805` | Add `.md` to `accept=` attribute. The other accept= at `:8210` already has `.md`. |
| 2. Upload Lambda validation | `backend/lambdas/upload/lambda_function.py` | **No change needed** — the upload Lambda has no extension allowlist; it accepts whatever the client sends and stores the MIME type the browser provides. Browsers report `text/markdown` for `.md` (Chrome) or `text/plain` (Safari/Firefox); both pass through. Verified by reading lines 199–227 of upload `lambda_function.py`. |
| 3. Extraction path | `backend/lambdas/enrich/lambda_function.py:1071-1093` (`extract_text`) | Add an `md` branch to the dispatch: `if ext == 'md': return file_content.decode('utf-8')`. Same behaviour as `txt`, no library dependency. |

So **two** places, not three — the upload Lambda is permissive already. The plan accounts for both that need touching.

---

## 6. Implementation order + effort

| # | Phase | Description | Hours |
| --- | --- | --- | ---: |
| 0 | Schema | Append `document_analyses` block to `backend/schema.sql` + apply to prod RDS | 0.5 |
| 1 | `.md` support | Add `.md` to App.jsx accept=, add `md` to extract_text dispatch | 0.5 |
| 2 | New module `preprocess_per_document.py` | `STAGE1_PROMPT_VERSION`, `STAGE1_PROMPT`, `kind_hint`, cache helpers, `run_stage1_for_file` (Bedrock call + JSON parse + repair fallback), `run_stage1_parallel` (ThreadPoolExecutor, max_workers=8) | 3 |
| 3 | Wire Stage 1 into pipeline | In `_run_enrichment_pipeline` after `extract_all_files`/transcribe: call `run_stage1_parallel`, pass result to Stage 2 | 0.5 |
| 4 | Stage 2 prompt rewrite | Replace `files_summary = "\n\n".join([f"=== {filename} ===\n{text[:5000]}" ...])` with `build_stage2_input(stage1_summaries)`. Add SOURCE COVERAGE REQUIREMENT block. Update `sources[]` schema in OUTPUT FORMAT. | 1.5 |
| 5 | Back-compat shim | Server-side `reference` field backfill | 0.25 |
| 6 | Update existing tests | `test_enrich_lambda.py` — adjust any test that asserts on the old `sources[]` shape; mock Bedrock for new path; nothing should break, just add mocks | 1 |
| 7 | New tests | 6 tests as specified in Section 8 | 2 |
| 8 | Step D verification re-run | `audits/diag_step_d_score_signatures.py` updated for new `sources[]` shape; assert 0 failing files | 0.5 |
| 9 | Deploy + smoke | Deploy via existing `cd backend/lambdas/enrich && zip ... && aws lambda update-function-code` pattern from CLAUDE.md. Re-enrich FC Dynamics + MFP. Run cache-verification re-enrichment. Test .md upload. | 1.25 |
| **Total** | | | **11h** |

Within 6–12h. Realistic delivery in one focused day.

---

## 7. Verification gates

### A. Citation depth (the original Step D failure)

Pre-existing `audits/diag_step_d_score_signatures.py` runs against the post-fix analysis JSON for FC Dynamics + MFP Trading. Updated pass criterion:

```
A file is COVERED if:
  (a) >= 1 of its 3 unique signatures appears in the analysis blob, OR
  (b) sources[] has entry with filename matching, AND
       consolidated_with is non-empty, AND
       unique_angle is non-empty.
PASS: every input file is COVERED.
```

User-stated stricter target: **3/3 unique signatures cited per file** (or explicit `consolidated_with` + `unique_angle`). The plan aims for that — Stage 1 extracts ~5–10 distinctive facts per file, Stage 2 must cite at least one per `sources[]` entry, and signatures are picked to overlap with Stage 1's distinctive_facts list. So 3/3 is the realistic target unless Stage 2 picks a non-signature fact (still passes the looser criterion).

### B. Cache verification

1. Deploy.
2. Run `/enrich` for FC Dynamics. Capture CloudWatch logs.
3. Expected: `Stage 1 dispatch summary: 0/8 cached, 8 ran fresh`.
4. Without changing any uploaded file, immediately re-run `/enrich` for FC Dynamics.
5. Expected: `Stage 1 dispatch summary: 8/8 cached, 0 ran fresh`. Eight `Stage 1 cache hit` log lines, one per upload_id.
6. Cost check: first run ≈ Stage 1 (8 files × ~$0.05 Haiku) + Stage 2 (~$0.30 Sonnet) ≈ $0.70. Second run ≈ Stage 2 only ≈ $0.30. Logged via Bedrock token-count log lines.

If a single `Stage 1 cache miss` appears on the second run with no file changes, the cache key is wrong — fail the gate.

### C. `.md` end-to-end

1. Create a test client (sandbox).
2. Upload a `.md` file with three distinctive facts (a custom phrase, a number, a named entity not in any other corpus).
3. Trigger `/enrich`.
4. Inspect analysis JSON → `sources[]` has an entry with the `.md` filename and a `distinctive_fact` containing one of the three planted markers.
5. Inspect `extract_all_files` log → `Processing file: <name>.md`.

---

## 8. Tests

### Existing tests to update (in `backend/lambdas/tests/test_enrich_lambda.py`)

Most are unaffected — they test extract/repair/audio/config/stage paths, not the Claude prompt. Two need adjustment:

| Test | Change |
| --- | --- |
| `mock_deps` fixture | Add a Bedrock mock entry for Stage 1 calls so tests don't accidentally hit the API. Default returns a stub Stage 1 output (one `distinctive_fact`, one entity each). |
| Any test asserting on `sources[].reference` literal shape | Update to assert on either the new `sources[].filename` field OR the back-compat `reference` (which is server-populated). The codebase grep shows the test file does not currently assert against `sources[]` shape — confirmed. So zero existing tests break. |

### New tests (6, as specified in the brief)

1. **`test_stage1_extracts_structured_output`** — mocked Bedrock returns a known JSON. Assert `run_stage1_for_file` returns it intact, with `filename`/`etag`/`chars_in` populated correctly.
2. **`test_stage1_cache_hit_skips_claude`** — pre-seed `document_analyses` with a row matching upload_id+etag+prompt_version. Mock Bedrock raises if called. Run `run_stage1_for_file`. Assert: row reused, Bedrock NOT called, `Stage 1 cache hit` log emitted.
3. **`test_stage1_cache_miss_runs_and_writes`** — empty `document_analyses`. Mock Bedrock returns stub. Run `run_stage1_for_file`. Assert: Bedrock called once, row written with correct keys, `Stage 1 cache miss` log emitted, second call (same args) becomes a hit.
4. **`test_end_to_end_fc_dynamics`** — fixture: 8 file-text dicts using the actual extracted text from `audits/source-text/client_1772616693_8b881fe7/`. Mock Stage 1 to return realistic structured output (using actual distinctive facts pulled from the source text). Mock Stage 2 with a known `sources[]` shape. Assert: Stage 2 prompt block contains one `=== filename ===` block per file; assert: post-process backfills `reference`.
5. **`test_end_to_end_mfp_trading`** — same shape, MFP fixture (10 files from `audits/source-text/client_1776011770_6aff114c/`). Additionally assert: when Stage 1 flags `overlap_signals` for the three duplicate briefs, Stage 2 input shows the overlap signal so Claude can populate `consolidated_with`.
6. **`test_md_file_upload_and_extract`** — write a small `.md` file with a distinctive marker, exercise `extract_text("test.md", b"# Heading\n\nDistinctive: zphq-marker\n")`, assert returned text contains "zphq-marker" verbatim.

---

## 9. Risk register

| Risk | Mitigation |
| --- | --- |
| Stage 1 latency: 8 files × ~3-8s Haiku each, sequential = 24-64s blocking | Parallel via `ThreadPoolExecutor(max_workers=8)`. Bedrock concurrency limits comfortable at 8. Total Stage 1 time bounded by the slowest single call (~8s typical). |
| Stage 1 cost: 18 files × Haiku per enrichment | At Haiku 4.5 pricing (~$1/M input tokens), 40k chars ≈ 10k tokens × $1/M = $0.01 per file. 18 files = $0.18/run on first enrichment. Cache makes re-runs ~free. Affordable. |
| Stage 1 JSON parse failure (Claude returns prose, malformed JSON) | Reuse existing `_repair_truncated_json` for repair. If still fails after one retry, fall back to a stub Stage 1 output with `summary_2_lines = "Stage 1 extraction failed for this file."` — Stage 2 still sees the file by filename in `sources[]` and the cache row is NOT written (so next run retries cleanly). |
| ETag mismatch surprises (S3 multi-part uploads use a different ETag scheme than single-part) | Use the ETag exactly as `head_object` returns it — opaque string. If multi-part uploads change the ETag schema for the same content, that's a cache miss (acceptable; correctness preserved). |
| `PROMPT_VERSION` bumped accidentally → mass cache invalidation | Clear comment on the constant. Tied to template via a doc-string note. Worst case: one full re-run cost; not data loss. |
| Stage 2 ignores SOURCE COVERAGE REQUIREMENT, drops a filename | Server-side post-process validates: every input filename must appear in `sources[]`. If missing, retry once with `Missing filenames: X, Y, Z. Add entries.` If still missing, server-fills with `unique_signal=false, distinctive_fact="Auto-filled — Claude omitted this filename"`. Never silent drop. |
| Schema apply on production DB races with in-flight enrichments | `CREATE TABLE IF NOT EXISTS` is metadata-only; no row-level locks. Apply during low-traffic window anyway. Two-phase async pattern means Phase 2 invocations finish on old code; only new Phase 1 calls hit new pipeline. |
| `.md` file with binary contents (e.g. some editors save BOM/encoding artifacts) | `decode('utf-8', errors='replace')` instead of strict decode — same defensive choice the existing `extract_text` makes for other types. |

---

## 10. Out of scope (explicit)

- Frontend changes to render `truncated_files` / `consolidated_files` — not added in v2 architecture; instrumentation no longer needed because Stage 1 is per-file by design.
- Streamline webhook payload changes — old `reference` field preserved.
- Backfill of existing analysis JSONs.
- Migration to Anthropic-direct API for Stage 1 (stays on Bedrock; reuses existing auth path).
- The three round-1 latent issues (`list_objects_v2` pagination, `source_count` divergence, `_repair_truncated_json` silent masking) — separate branches.

---

## 11. Review gates

1. **Now (this plan)** — Ken approves architecture, schema shape, prompt version strategy, .md plan.
2. **Pre-deploy** — full diff shown for review (Ken's stated requirement). Commits cleanly broken up by phase: schema, .md, preprocess module, Stage 2 rewrite, tests.
3. **Post-deploy** — three verification gates above (citation depth + cache + .md) all pass before closing the branch.

Plan stops here. Awaiting approval to begin Phase 0.
