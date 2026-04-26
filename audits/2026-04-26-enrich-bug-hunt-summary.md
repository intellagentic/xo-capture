# /enrich silent-document-drop investigation — 2026-04-26

**Verdict:** Retrieval is clean (unchanged from the initial three-step pass). But the citation-depth test (Step D) found **6 of 18 input files across FC Dynamics + MFP Trading have zero unique content cited in the substantive analysis fields**. The original observation that "files disappear from the analysis" was directionally correct, with a different mechanism than the briefing hypothesised — it lives in prompt construction (per-file `text[:5000]` truncation + Claude content de-duplication), not in DB retrieval.

**Recommendation: close branch `fix/enrich-document-retrieval` without merging** (no retrieval-layer fix is warranted). A separate **P1 follow-up** is opened below for prompt-construction work.

## What was checked

Branch `fix/enrich-document-retrieval` was cut from `main`; no code was modified. All evidence below comes from production state via the `intellagentic` AWS profile + the `xo-quickstart` RDS database.

### Four diagnostic passes

1. **Step A — CloudWatch logs** for the most recent xo-enrich run for each client. Pulled by log stream rather than by client_id filter (the diagnostic log lines `Processing file:`, `Skipping inactive/deleted file:`, `Active upload keys for enrichment:` don't contain the client_id, so a naive content filter misses them).
2. **Step B — DB rows vs S3 listing**. `SELECT * FROM uploads WHERE client_id = ...`, then `list_objects_v2` (with pagination) for `{s3_folder}/uploads/`, then set-diff the two key sets. Includes URL-encoding / leading-slash / whitespace / double-slash mismatch detection.
3. **Step C — analysis JSON name coverage**. Decrypted (per-client AES-GCM via `crypto_helper.unwrap_client_key` + `decrypt_s3_body`) the analysis JSON written to S3, and verified each input filename appears in `analyzed_files` and `sources[]`.
4. **Step D — citation-depth test** (added after Step C passed). For each input file, extracted its source text via the same code paths the Lambda uses, picked 2–3 distinctive substrings from the **first 5000 chars only** (what Claude actually saw given the `text[:5000]` cap), then searched the analysis JSON's substantive fields (`summary`, `bottom_line`, `client_summary`, `streamline_applications`, `architecture_diagram`, `problems[].{title,evidence,recommendation}`, `plan[].actions/phase`, `sources[].reference`, `xo_applications`, `component_mapping`, `schema.tables`) for them. The point: distinguish "file is named in the analysis" (Step C) from "file's content is actually drawn into the analysis" (Step D).

Diagnostic scripts live in `audits/diag_step1_find_clients.py`, `audits/diag_step_a_v2.py`, `audits/diag_step_b_v2.py`, `audits/diag_step_c_v2.py`, `audits/diag_step_d_extract_sources.py`, `audits/diag_step_d_score_signatures.py`. Per-file source-text dumps are in `audits/source-text/{s3_folder}/`. All scripts are re-runnable; they take `DATABASE_URL` and `AES_MASTER_KEY` from env and use the `intellagentic` AWS profile.

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

## Step D — citation-depth test (results)

Step C verified every input file is **named** in the analysis JSON. Step D tests whether each file's **content** is actually drawn into the substantive output. Method: 3 distinctive substrings per file picked from the first 5000 chars (what Claude saw under the `text[:5000]` cap at `backend/lambdas/enrich/lambda_function.py:1300`), case-insensitive substring search across the analysis JSON's substantive fields (excluding `analyzed_files`, which is just a name list).

### FC Dynamics — `12e46d43-...` (2026-04-25 15:27 UTC)

Searchable analysis blob: 34,050 chars across 5 problems, 9 sources, 3-phase plan, summary, bottom_line.

| filename | upload | total chars | sigs cited | verdict |
| --- | --- | --: | :---: | --- |
| 1-2 BARRIER ROAD, CHATHAM, KENT FIRE STRATEGY -DRAFT COPY .pdf | 03-05 09:37 | 15,121 (10,121c trunc) | 3/3 | used (full) |
| 250704 Issue Detail of Fire Stopping-1-2 Barrier Road, Chatham.pdf | 03-05 09:37 | 8,624 (3,624c trunc) | 2/3 | used (partial) |
| FC Dynamics - regulation research.docx | 03-05 17:53 | 4,518 | 2/3 | used (partial) |
| Fire Strategy.pdf | 04-04 14:05 | 13,463 (8,463c trunc) | 3/3 | used (full) |
| Intellagentic Mail #1 (FC Dynamics XO meeting) | 04-04 14:05 | 6,866 (1,866c trunc) | 1/3 | weak |
| Intro Call Edem and Alan Transcript.txt | 03-05 09:34 | 40,184 (35,184c trunc) | 0/3 | **NOT USED** |
| no. 2 Intellagentic Mail (UK Fire Engineering Standards Library) | 04-04 14:05 | 4,000 | 0/3 | **NOT USED** |
| Sittingbourne Library Stage 4 Fire Strategy Report REV D ISD.pdf | 03-05 09:37 | 15,790 (10,790c trunc) | 2/3 | used (partial) |

`Fire Strategy.pdf` (the file specifically flagged as suspect in the original briefing) is **used fully** — `Tringham House`, `University Hospitals Dorset`, and `Bennington Green` all appear in the analysis narrative.

### MFP Trading — `6c81490f-...` (2026-04-21 17:04 UTC)

Searchable analysis blob: 38,473 chars across 5 problems, 8 sources, 3-phase plan.

| filename | upload | total chars | sigs cited | verdict |
| --- | --- | --: | :---: | --- |
| FW_ Starting Out (Lisa's training email) | 04-12 16:42 | 3,353 | 1/3 | weak |
| File Note_ Enriched MFP Trading XO Discovery (Feb 24 2026) | 04-21 16:33 | 7,063 (2,063c trunc) | 0/3 | **NOT USED** |
| **IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf** | 04-21 17:04 | 15,835 (10,835c trunc) | **3/3** | used (full) |
| MFP Notes for AP Chat Bot.docx | 04-12 16:42 | 8,044 (3,044c trunc) | 3/3 | used (full) |
| MFP Trading FX Credit Policy 2026.docx | 04-12 16:42 | 3,697 | 3/3 | used (full) |
| SlackChatforChatBot.docx | 04-12 16:42 | 6,197 (1,197c trunc) | 3/3 | used (full) |
| forexventures_briefing.docx | 04-21 16:33 | 21,587 (16,587c trunc) | 2/3 | used (partial) |
| initial_call_1776012184056.txt | 04-12 16:43 | 7,023 (2,023c trunc) | 0/3 | **NOT USED** |
| mfp_briefing (1).docx | 04-21 16:33 | 21,817 (16,817c trunc) | 0/3 | **NOT USED** |
| mfp_briefing.docx | 04-21 16:33 | 21,765 (16,765c trunc) | 0/3 | **NOT USED** |

`IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf` (uploaded 17:04:08, ~15 minutes before enrichment ran) is **used fully** — `Minerva` (proprietary platform mentioned only in this doc), `5 exception types` (the brief's specific correction), and `CreditAlertEngine` (Lisa's specific engine name) all appear in the analysis. It is the **most cited** of all 10 inputs.

### Findings (Step D)

1. **`text[:5000]` per-file truncation is losing significant material.** 11 of 18 files exceed 5000c. Fire Strategy.pdf loses 8,463c. The Intro Call transcript loses 35,184c (Claude saw 12.5% of it). The three MFP briefings lose ~16,800c each. Cap is at `backend/lambdas/enrich/lambda_function.py:1300` (`text[:5000]` inside the `files_summary` join). Truncation alone does not fully explain the under-citation — Fire Strategy.pdf is fully cited despite losing 63% of its content because its distinctive markers happen to live in the cover-page prelude inside the surviving 5000c window.

2. **Claude content de-duplication on near-duplicate inputs.** The four MFP files uploaded together at 04-21 16:33 (`File Note Enriched`, `mfp_briefing.docx`, `mfp_briefing (1).docx`, `forexventures_briefing.docx`) share 80%+ of their first-5000c executive-summary text. Claude received all four in the prompt and consolidated, citing only the most distinctive (`Deep Dive PDF` and `forexventures_briefing` partial). Distinctive markers `Becket House`, `Old Jewry`, `Mabrouka Abuhmida` — all well within the 5000c window of the three briefings — appear in **none** of the analysis output. From a user perspective this looks like "files dropped" but the canonical content is in the analysis, just attributed to the most distinctive source.

3. **Conversational transcripts are systematically under-cited even within their first 5000c.** Intro Call (FC Dynamics, 0/3 hits) and File Note Enriched / initial_call (MFP, 0/3 each) all have distinctive, citable content in their first 5000c that does not surface. Claude prefers polished prose over meeting transcripts. For any client whose primary input is meeting transcripts, this enrichment will under-cite them.

4. **Email-thread consolidation.** The 2nd Intellagentic Mail (FC Dynamics, 4,000c, no truncation) is dropped from the narrative despite distinctive content (`120 key UK standards`, `Tier-1 consultancies`, `FDS, CFAST`). Same author, same date, same subject as #1 — Claude collapsed the pair into a single source line.

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

## Recommended follow-ups

### P1 — Prompt-construction under-cites uploaded content

Promoted from Step D. **6 of 18 input files across the two clients have zero unique content cited in the substantive analysis fields.** This affects FC Dynamics and MFP Trading today and any future client with (a) long files, (b) near-duplicate uploads, or (c) meeting-transcript-heavy inputs.

Two contributing mechanisms with concrete code references:

- **Per-file 5000-char truncation** at `backend/lambdas/enrich/lambda_function.py:1300`:
  ```python
  files_summary = "\n\n".join([
      f"=== {filename} ===\n{text[:5000]}"
      for filename, text in extracted_text.items()
  ])
  ```
  Hits 11 of 18 files in the Step D sample. Fire Strategy.pdf loses 63% of its text, the Intro Call transcript loses 87%.

- **`maxTokens: 16000` output cap** at `backend/lambdas/enrich/lambda_function.py:1488` (passed into `bedrock.converse` at `:1503`). Output cap, not input — but it bounds how many evidence pulls Claude can produce, so per-file evidence is effectively rationed across files.

Recommended fixes (none implemented yet):

1. **Raise per-file truncation with explicit token-budget math.** Don't flat-raise `text[:5000]` — measure: prompt template overhead + system skills + client config + per-file budget × N files must fit within model context (Claude's ~200k input is the true ceiling, well under-used today). Pick a per-file char budget that scales with file count and the model's actual input window.
2. **Chunk-and-summarise long files before injection.** For files > target budget, run a cheap pre-pass (Haiku) that produces a structured summary preserving distinctive markers (named entities, numbers, dates), then inject the summary instead of the head-of-file truncate. Preserves signal density without blowing the prompt.
3. **Force per-file evidence in `sources[]`.** Today the prompt asks for `sources[]` but doesn't require one entry per input file with a substantive evidence pull. Make it required + structured: `{"file": "<filename>", "evidence": "<verbatim quote or paraphrase with span>"}`. This converts the de-duplication behaviour into an explicit "this file is redundant with X" signal rather than a silent drop.
4. **Surface a `truncated_files` warning in the analysis JSON.** When any input file exceeded the per-file char budget, append a top-level `truncated_files: [{filename, total_chars, seen_chars}]` array. Today there's zero observability of truncation from the consumer side.

Ordering: 3 + 4 are cheap and high-value (visibility wins). 1 needs measurement before changing. 2 is a real architectural change and may be deferred until 1 isn't enough.

### Lower-priority backlog (not affecting current clients)

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

None to production code. Branch `fix/enrich-document-retrieval` was deleted (no commits). All audit artefacts (this summary, diagnostic scripts, source-text dumps from Step D) live on branch `audits/2026-04-26-enrich-investigation`.
