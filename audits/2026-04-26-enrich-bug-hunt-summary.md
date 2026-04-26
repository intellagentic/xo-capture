# /enrich silent-document-drop investigation — 2026-04-26

**Verdict: NO BUG.** The original briefing claim that the `/enrich` Lambda was silently dropping documents (FC Dynamics: 5/8 processed, MFP Trading: 2/6 processed) was generated without code or runtime access and is not grounded in observable behaviour. Document retrieval and analysis output are both clean on the most recent runs for both clients.

**Recommendation: close branch `fix/enrich-document-retrieval` without merging.** No code change is warranted.

## What was checked

Branch `fix/enrich-document-retrieval` was cut from `main`; no code was modified. All evidence below comes from production state via the `intellagentic` AWS profile + the `xo-quickstart` RDS database.

### Three diagnostic passes

1. **Step A — CloudWatch logs** for the most recent xo-enrich run for each client. Pulled by log stream rather than by client_id filter (the diagnostic log lines `Processing file:`, `Skipping inactive/deleted file:`, `Active upload keys for enrichment:` don't contain the client_id, so a naive content filter misses them).
2. **Step B — DB rows vs S3 listing**. `SELECT * FROM uploads WHERE client_id = ...`, then `list_objects_v2` (with pagination) for `{s3_folder}/uploads/`, then set-diff the two key sets. Includes URL-encoding / leading-slash / whitespace / double-slash mismatch detection.
3. **Step C — analysis JSON coverage**. Decrypted (per-client AES-GCM via `crypto_helper.unwrap_client_key` + `decrypt_s3_body`) the analysis JSON written to S3, and verified each input filename appears in `analyzed_files` and `sources[]`.

Diagnostic scripts live in `audits/diag_step1_find_clients.py`, `audits/diag_step_a_v2.py`, `audits/diag_step_b_v2.py`, `audits/diag_step_c_v2.py`. All are re-runnable; they take `DATABASE_URL` from env and use the `intellagentic` AWS profile.

## FC Dynamics (`client_1772616693_8b881fe7`, db_id `51f49469-6328-4afe-a492-7c2f36274907`)

**Most recent run:** 2026-04-25 15:27:37 UTC, enrichment_id `12e46d43-2ab5-4c4e-a7a1-1c161a027d41`, log stream `2026/04/25/[$LATEST]ac47de6a28354b778ee25edcb47d28d7`.

### Step A — CloudWatch
- `Active upload keys for enrichment: 8`
- `Processing file:` × **8** — all 8 active files including `Fire Strategy.pdf`
- `Skipping inactive/deleted file:` × **0**
- `Extracted text from 8 files`
- `Analyzing 8 source(s) for client: client_1772616693_8b881fe7`

### Step B — DB ↔ S3
- DB `uploads`: 9 rows total — 8 `active`, 1 `deleted` (`FC Dynamics - regulation research.pdf`, superseded by `.docx` 8 hours later)
- S3 `list_objects_v2`: 8 keys
- Intersection: 8. The single "in DB but not S3" row is the `deleted` one — expected.
- No URL-encoding, leading-slash, whitespace or double-slash mismatches.
- `source_count` predicate (`status='active'`) and enrich predicate (`status='active' OR NULL`) both return 8.

### Step C — analysis output
- `analyzed_files` (8/8): all expected files present
- `sources[]`: 9 entries — every one of the 8 input files named with a description, plus a 9th entry for client configuration
- `Fire Strategy.pdf` confirmed in both `analyzed_files` and the narrative summary
- `analysis.status = 'complete'`

## MFP Trading Limited (`client_1776011770_6aff114c`, db_id `58420e26-fd85-4da7-a638-e8729b55725f`)

**Most recent run:** 2026-04-21 17:04:23 UTC, enrichment_id `6c81490f-491a-4708-ab8c-3ebd4e93f45c`, log stream `2026/04/21/[$LATEST]a896b5fc37714c02b1ed680a16ae7aba`.

### Step A — CloudWatch
- `Active upload keys for enrichment: 10`
- `Processing file:` × **10** — all 10 active files including the 17:04:08 `IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf` (uploaded ~15 minutes before this enrichment ran)
- `Skipping inactive/deleted file:` × **0**
- `Extracted text from 10 files`
- `Analyzing 10 source(s) for client: client_1776011770_6aff114c`

### Step B — DB ↔ S3
- DB `uploads`: 10 rows, all `active`
- S3 `list_objects_v2`: 11 keys (10 files + 1 empty `{folder}/uploads/` placeholder marker — harmless folder-creation artefact, never selected by the enrich code path)
- Intersection: 10
- No URL-encoding, leading-slash, whitespace or double-slash mismatches.

### Step C — analysis output
- `analyzed_files` (10/10): all expected files present
- `sources[]`: 8 entries — every input file accounted for; Claude bundled `mfp_briefing (1).docx` + `mfp_briefing.docx` into a single source line (both still named verbatim)
- `IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf` confirmed in `analyzed_files` and `sources[]` ("April 21 2026 intelligence brief confirming 5 exception types as official scope, Minerva platform existence, and engagement timeline")
- `analysis.status = 'complete'`

## Why the briefing's hypotheses were wrong

The briefing assumed DynamoDB. The actual storage is **PostgreSQL** (`uploads` table on `xo-quickstart-db.c9g8ymsccljy.eu-west-2.rds.amazonaws.com`). The four ranked root causes therefore don't apply:

| Hypothesis | Status |
| --- | --- |
| Missing `LastEvaluatedKey` pagination loop | N/A — Postgres `fetchall()` returns all rows in one call |
| Hardcoded `Limit=5` / `[:5]` slice | N/A — no LIMIT in the SQL, no slice in the Python |
| `created_at` filter anchored to client creation date | N/A — no date predicate |
| `batch_id` filter matching only first upload session | N/A — no `batch_id` column referenced |

The actual SQL at `backend/lambdas/enrich/lambda_function.py:229-233` is:
```python
cur.execute(
    "SELECT s3_key FROM uploads WHERE client_id = %s AND (status IS NULL OR status = 'active')",
    (db_client_id,)
)
active_keys = [r[0] for r in cur.fetchall()]
print(f"Active upload keys for enrichment: {len(active_keys)}")
```
That log line ("Active upload keys for enrichment: N") **already exists** — Step A's whole `/Active upload keys/` line was the diagnostic the brief asked us to add.

## Recommended follow-ups (not P0, backlog)

These are real concerns surfaced during the audit. None affect FC Dynamics or MFP Trading at current data volumes. Not fixed in this investigation.

1. **`list_objects_v2` lacks pagination** in three call sites, each capped at 1000 keys/call. Will silently truncate any client with > 1000 upload objects / > 1000 audio files / > 1000 skill files. No client in production is near that today.
   - `backend/lambdas/enrich/lambda_function.py:1023` — `extract_all_files`
   - `backend/lambdas/enrich/lambda_function.py:758` — `find_audio_files`
   - `backend/lambdas/enrich/lambda_function.py:988` — `read_skills_from_s3`
2. **`source_count` and the enrich query disagree on `status IS NULL` rows.** If anyone ever inserts an upload with NULL status, `source_count` will under-report relative to what enrich actually processes. No NULL-status rows exist for either client today.
   - `backend/lambdas/clients/lambda_function.py:872` — `source_count` counts only `status='active'`
   - `backend/lambdas/enrich/lambda_function.py:230` — enrich accepts `status IS NULL OR status = 'active'`
3. **`_repair_truncated_json` silently masks Claude truncation.** If `maxTokens=16000` is ever hit, downstream code will see `status='complete'` even though Claude was cut off. The repaired JSON is returned with no flag on the analysis record. Real silent-failure path; should at minimum log a structured warning and flip a `truncated=true` field.
   - `backend/lambdas/enrich/lambda_function.py:1547` — `_repair_truncated_json`
   - `backend/lambdas/enrich/lambda_function.py:1521-1525` — call site that swallows the parse error and invokes the repair

The briefing asked us to also report on a 51-client audit and grep for the same anti-pattern across other Lambdas. Both are skipped — there is no anti-pattern to audit for. If the latent issues above warrant a sweep, that's a separately-scoped piece of work.

## Files changed

None. Branch `fix/enrich-document-retrieval` is clean off `main` apart from the `audits/` directory (untracked diagnostic scripts and this summary). Recommend deleting the branch.
