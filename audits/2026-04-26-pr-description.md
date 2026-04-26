# Stage 1 per-document analysis + cache + Opus fallbacks

Two-stage enrichment pipeline. Per-document Stage 1 with full text and parallel dispatch + cache, replacing the `text[:5000]`-per-file flat-truncate concat that was silently dropping content. Six silent-fallback model defaults flipped to Opus 4.6, locked by a regression test. `.md` upload support. Stage 1 fails loudly on retry exhaustion instead of serving degraded output.

## Why

The audit branch [`audits/2026-04-26-enrich-investigation`](https://github.com/intellagentic/xo-capture/tree/audits/2026-04-26-enrich-investigation) ran a four-step diagnostic against FC Dynamics + MFP Trading. Steps A–C cleared retrieval (filenames named, S3 keys matched, no encoding drift). **Step D — citation depth — failed**: 6 of 18 input files across the two clients had zero unique content cited in the substantive analysis fields (`problems`, `summary`, `sources[].reference`, `plan`, etc.).

Mechanism: `text[:5000]` per-file truncation at `lambda_function.py:1300` discarded 87% of the Intro Call transcript and 63% of `Fire Strategy.pdf`. Stage 2 then synthesised across a flat concat that mashed all files together, encouraging Claude to consolidate near-duplicates and silently drop transcripts and follow-up emails.

This branch fixes the citation-depth failure end-to-end and addresses three latent issues found alongside it.

## Architecture: two-stage per-document analysis

```
Stage 1 (per-document)               Stage 2 (synthesis)
─────────────────────                ─────────────────
For each input file (parallel):     Existing analyze_with_claude prompt,
  → cache lookup by                   modified to consume Stage 1's
     (upload_id, S3 ETag,             structured output instead of raw
      STAGE1_PROMPT_VERSION)          concatenated text.
  → cache hit  → reuse              Per-file blocks include KIND,
  → cache miss → Bedrock call         DISTINCTIVE FACTS, NAMED ENTITIES,
                  with full text,     DECISIONS, ACTION ITEMS, KEY QUOTES,
                  store row.          OVERLAPS WITH.
                                     sources[] schema requires one entry
Output: distinctive_facts[],          per filename, distinctive_fact pulled
        named_entities,               verbatim from Stage 1, and
        decisions[],                  consolidated_with + unique_angle for
        action_items[],               legitimate overlaps.
        quotes[], overlap_signals,
        summary_2_lines.
```

Both stages use the same model — the value `model_to_use` resolved in Phase 1 (request body → `users.preferred_model` → backend fallback). No hardcoded model identifier in any new code. Production today: 25 of 35 users on Opus 4.6, 10 explicitly on Sonnet 4.5 (their choice, untouched).

### Per-document caching

New `document_analyses` table:

```sql
CREATE TABLE IF NOT EXISTS document_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    etag TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    stage1_output JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (upload_id, etag, prompt_version)
);
```

`INSERT ... ON CONFLICT DO NOTHING` for race-safety. Cache invalidates naturally when:
- a file changes (new ETag from `head_object`)
- the Stage 1 prompt template changes (`STAGE1_PROMPT_VERSION` bumped manually)
- the upload row is deleted (FK cascade)

Stage 2 is **never** cached — synthesis depends on full corpus + skills + client config which can change between runs.

### Stage 1 hardening (after Gate A 429 incident)

Initial deploy hit Bedrock 429s on 3 of 8 parallel Opus 4.6 calls within 1s of dispatch — Opus per-account TPM/RPM is tighter than I'd modelled. Rolled back, hardened, re-deployed:

- `DEFAULT_MAX_WORKERS = 3` (was 8). Locked by a unit test.
- Hand-rolled exponential backoff with jitter in `_bedrock_invoke_with_retry`. 1s, 2s, 4s base + 0–1s jitter, max 3 retries. Uniform across bearer-token urllib and boto3 IAM converse paths. Non-throttle errors bypass the loop.
- **`_fallback_stage1` deleted.** When a file's Stage 1 cannot complete after retries, `Stage1FailedError` propagates. Pipeline halts: `enrichments.status='failed'`, `stage='stage1_failed'`, `error_message=<truncated>`. **No degraded analysis JSON is written.** Stage 2 must NOT run on a partially-degraded input set. Successful per-file outputs from a partial run ARE still cached so a retry skips work that did complete.

## Silent-fallback audit (six sites flipped to Opus 4.6)

Production check: of 35 users, **0** have NULL `preferred_model`. But six fallback paths in code defaulted to Sonnet — a silent downgrade if any of them ever fired:

| File | Line | Was | Now |
| --- | --- | --- | --- |
| `backend/lambdas/enrich/lambda_function.py` | 192 | `COALESCE(preferred_model, 'claude-sonnet-4-5-20250929')` | `'claude-opus-4-6'` |
| `backend/lambdas/enrich/lambda_function.py` | 196 | Python `else 'claude-sonnet-4-5-20250929'` | `'claude-opus-4-6'` |
| `backend/lambdas/enrich/lambda_function.py` | 337 | `event.get('model', 'claude-sonnet-4-5-20250929')` | `'claude-opus-4-6'` |
| `backend/lambdas/enrich/lambda_function.py` | 1430 | `analyze_with_claude(model='claude-sonnet-4-5-20250929')` | `'claude-opus-4-6'` |
| `backend/lambdas/enrich/lambda_function.py` | 1645 | `BEDROCK_MODEL_MAP.get(model, BEDROCK_MODEL_MAP['claude-sonnet-4-6'])` | `'claude-opus-4-6'` |
| `src/App.jsx` | 1941 | `useState(initialAuth.user?.preferred_model \|\| 'claude-sonnet-4-6')` | `'claude-opus-4-6'` |

Locked by `test_no_request_model_no_user_row_resolves_to_opus_4_6` in `test_enrich_lambda.py`. Bumping any of these back to Sonnet without an explicit decision will trip CI.

## `.md` upload support

Two surfaces:
- `src/App.jsx:6805` — `accept=` attribute now includes `.md`.
- `backend/lambdas/enrich/lambda_function.py:extract_text` — `md` branch added (UTF-8 decode with `errors='replace'`).

Upload Lambda has no extension allowlist (presigned URLs forward whatever the browser sends), so no change there.

## Verification gates (post-deploy, FC Dynamics + MFP Trading)

| Gate | Result | Detail |
| --- | --- | --- |
| **A — FC cold** | **PASS** | 5 cache hit (orphans from initial Gate A's partial success), 3 fresh, 0 failed. Wall-clock 4m 15s. |
| **B — FC warm** | **PASS** | 8/8 cached. 0 Bedrock Stage 1 calls. Wall-clock 3m 19s. |
| **C1 — MFP cold** | **PASS** | 10/10 fresh, 0 failed. **5 separate 429 events absorbed by retry-with-backoff** (1.63s, 2.96s, 1.21s, 2.08s, 4.75s sleeps). Zero leaked. Wall-clock 6m 21s. |
| **C2 — MFP warm** | **PASS** | 10/10 cached. Wall-clock 5m 12s. |
| **D — `.md` end-to-end** | **PASS** | Plaintext `.md` upload → Stage 1 extracted sentinel `GATE-D-MD-SENTINEL-zphq9217-...` verbatim → cited in `sources[].distinctive_fact`. Test fixture cleaned up. |

### Citation-depth verification (Step D v2)

```
FC Dynamics  enrichment=f81e9aac-3e5a-45f2-a42e-b5f844cb0e6f
  Covered: 8/8    Failing: 0

MFP Trading  enrichment=86f21b7a-a9a5-4a90-8b2a-654e34d5222b
  Covered: 10/10  Failing: 0

OVERALL: PASS — every input file covered for both clients
```

Round-1 audit: 6 of 18 files were 0/3 cited.
Post-fix: **0 of 18 are uncovered.** Every distinctive marker from every source document lands in the analysis output. The Intro Call transcript + the previously-dropped meeting notes + the 4 MFP near-duplicate briefs all surface substantive content. The `consolidated_with + unique_angle` mechanism explicitly distinguishes overlapping pairs (Barrier Road design vs inspection; Intellagentic Mail #1 prioritised hierarchy vs #2 full library) instead of silently dropping one.

## Tests

30 / 30 passing.

New unit tests (in addition to the original 26):
- `test_stage1_retries_on_throttle_then_succeeds` — 429 + valid response → completes, retries=1.
- `test_stage1_raises_after_retries_exhausted` — always 429 → raises after `MAX_STAGE1_RETRIES + 1` calls.
- `test_stage1_non_throttle_error_is_not_retried` — `AccessDeniedException` → no retry.
- `test_run_stage1_parallel_raises_when_any_file_fails_after_retries` — one file 429 → `Stage1FailedError`, succeeded files still cached.
- `test_max_workers_default_is_3` — locks `DEFAULT_MAX_WORKERS=3` and `MAX_STAGE1_RETRIES=3`.
- `test_no_request_model_no_user_row_resolves_to_opus_4_6` — locks the silent-downgrade fix.

## Schema changes

Two `IF NOT EXISTS` additions to `backend/schema.sql`:
- `CREATE TABLE document_analyses (...)`
- `ALTER TABLE enrichments ADD COLUMN error_message TEXT`

Both applied to production RDS as part of the deploy. Rollback DDL is `DROP TABLE document_analyses; ALTER TABLE enrichments DROP COLUMN error_message;` — neither has FK references from elsewhere.

## Cost expectation

Per first enrichment (Stage 1 fresh + Stage 2 fresh, all Opus 4.6):
- 8-file client: ~$0.40 Stage 1 + ~$0.30 Stage 2 = ~$0.70
- 10-file client: ~$0.50 + ~$0.30 = ~$0.80

Cached re-run (Stage 1 cache hits, Stage 2 fresh): ~$0.30 regardless of file count.

At 53 active clients × ~7 enrichments/year = ~$910/year baseline. Re-runs (cache-warm) drop to ~$0.30 each.

## Deploy state

- Lambda `xo-enrich` deployed, `CodeSha256 D88ttp/zJyCG2uGAMMs9cTwm1YiPOAwOBtSbKqOJpoo=`. v1 + v2 retained as immutable rollback targets.
- Schema applied to production RDS.
- Frontend deployed (CloudFront `E7PWZX8BT02CE` invalidated `/*`).
- Cache populated: 8 FC + 10 MFP rows in `document_analyses`.

## Known issues filed separately

Two pre-existing latent issues spotted during the audit, not addressed in this PR:

- **`list_objects_v2` missing pagination — silent 1000-key cap** — three call sites in `enrich/lambda_function.py` will silently truncate any client with > 1000 objects/uploads/skills. P2.
- **`source_count` column predicate disagrees with enrich retrieval predicate** — `clients/lambda_function.py:872` filters `status='active'` only; `enrich/lambda_function.py:230` accepts NULL too. If anyone ever inserts an upload with NULL status, `source_count` understates. P3.

Both filed as GitHub issues against this repo.

## Commits

- `857e446` — Stage 1 per-document analysis + cache + .md + Opus fallbacks
- `70610a9` — Stage 1 hardening: max_workers=3, 429 retry-with-backoff, halt-on-failure
- (this commit) — Frontend `preprocessing` stage label

## Test plan

- [x] 30/30 unit tests passing on this branch.
- [x] `npm run build` green.
- [x] Schema applied to production RDS.
- [x] Lambda deployed (v3, `D88ttp/...`).
- [x] Frontend deployed.
- [x] All four verification gates passed end-to-end against production.
- [x] `audits/diag_step_d_score_signatures_v2.py` reports 18/18 covered, 0 failing.
- [x] Pre-deploy rollback artefacts in place: Lambda v1 published as immutable AWS version, code zip archived locally (then deleted), pre-fix analysis JSONs saved as baselines and now deleted post-verification (customer business data — not committed).
