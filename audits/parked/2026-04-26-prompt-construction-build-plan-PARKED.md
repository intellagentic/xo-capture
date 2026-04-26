# Build plan — `/enrich` prompt-construction overhaul

**Branch:** `fix/enrich-prompt-construction` (off `main`).
**Status:** PLAN ONLY — no code yet, awaiting Ken's review.
**Driver:** Step D citation-depth findings on branch `audits/2026-04-26-enrich-investigation` — 6 of 18 input files had zero unique content cited in the analysis JSON's substantive fields.
**Pass condition:** re-running `audits/diag_step_d_score_signatures.py` against post-fix enrichments of FC Dynamics + MFP Trading must show **zero files at 0/3 unique citations**, with the exception of files explicitly tagged in `sources[]` with a non-empty `consolidated_with` list.

---

## 1. Pipeline shape — current vs. proposed

### Current (`backend/lambdas/enrich/lambda_function.py`)

```
extract_all_files()              → dict {filename: text}        # one S3 get + extract per file
   └─ extract_text per ext       (csv/txt/xlsx/pdf/docx)
transcribe_audio_files()         → merges transcripts into the same dict
analyze_with_claude()            → builds files_summary via text[:5000] per file (line 1300)
                                 → single Bedrock Converse call, maxTokens=16000
                                 → parse JSON, repair if truncated, write to S3
```

### Proposed

```
extract_all_files()              → dict {filename: text}        (unchanged)
transcribe_audio_files()         → merges transcripts             (unchanged)

preprocess_documents(extracted_text, model_haiku)
   ├─ detect_file_kind()         → tag each file: brief | transcript | email | code | data | other
   ├─ fold_email_threads()       → merge same-thread emails into one canonical
   ├─ consolidate_duplicates()   → group near-duplicates, pick canonical, list members
   ├─ structure_transcripts()    → Haiku pre-pass: topics, entities, decisions, quotes
   └─ smart_truncate()           → for remaining >20k char inputs: chunk + Haiku summarise
   ─→ returns processed_inputs[] + transformations metadata

build_files_summary(processed_inputs)   → replaces text[:5000] block at line 1300

analyze_with_claude(processed_inputs, transformations)
   ├─ prompt template now includes per-file kind labels + consolidation notes
   ├─ output schema requires sources[] entry per *original* filename
   ├─ Bedrock Converse call (token budget recomputed from processed input size)
   └─ post-process: backfill transformations into analysis JSON
                    (truncated_files, consolidated_files, structured_files)
```

The Haiku pre-pass uses the same Bedrock model map already in `BEDROCK_MODEL_MAP` (`claude-haiku-4-5-20251001`). No new credentials, no new client.

---

## 2. Module sequence (implementation order)

Each module is a pure function on the `extracted_text` dict + transformations log. Builds incrementally so each phase is independently shippable + testable.

### Phase 0 — Scaffolding (no behaviour change)

- **New file:** `backend/lambdas/enrich/preprocess.py`
- Extract the existing `text[:5000]` join into `build_files_summary(extracted_text) -> str` so the call site at line 1300 is one line.
- Add `Transformations` dataclass: `truncated_files: list[dict]`, `consolidated_files: list[dict]`, `structured_files: list[dict]`, `email_threads: list[dict]`.
- Wire `preprocess_documents()` as a no-op pass-through called from `_run_enrichment_pipeline` between `extract_all_files` and `analyze_with_claude`.
- Pre-existing CloudWatch log line `Analyzing N source(s)` stays; add `Preprocessed N source(s) → M canonical inputs (truncated=X, consolidated=Y, structured=Z, email_folded=W)` line for operator visibility.
- **Effort: 2h.** Verifies the slot exists and nothing breaks before any logic lands.

### Phase 1 — `detect_file_kind()`

Tags each file with a kind so later stages can route correctly. Implemented as cheap heuristics, no model calls.

| Kind | Heuristic |
| --- | --- |
| `email` | filename matches `Mail\|FW_\|RE:\|FW:` OR first 500c contains `From:` and `To:` and `Subject:` |
| `transcript` | speaker-turn regex hit-rate ≥ 1 per 200c (`/^\d+:\d+\s*-\s*\w+/m` for the existing format, plus `/^Speaker \d+:/m`, `/^[A-Z][a-z]+ [A-Z][a-z]+:/m`) **OR** conversational-marker density ≥ 0.5% (`yeah|bear with me|umm|kinda|gonna|you know`) |
| `data` | extension in `csv\|xlsx\|xls` |
| `code` | extension in `py\|js\|jsx\|ts\|tsx\|sh\|sql` (ignored — not in current corpus, but cheap to tag) |
| `brief` | falls through; PDF/docx without email/transcript markers |
| `other` | none of the above |

- **Effort: 3h** (mostly fixture-driven threshold tuning against the 18 Step D source dumps).

### Phase 2 — `fold_email_threads()`

For files tagged `email`: parse Subject line + send date from extracted text. Group by normalised subject (strip `Re:`/`Fwd:`/whitespace, lowercase). Within a group, sort by parsed date and concatenate chronologically.

- Output: one canonical input per thread, content = full chronological thread, `member_filenames` = list of original filenames.
- Edge case: subject parse fails → file stays as standalone (no folding).
- **Validates against the FC Dynamics fixture:** the two `Intellagentic Mail - Re_ FC Dynamics and XO on March 20, 2026` emails share subject and sender — should fold into one thread.
- **Effort: 4h.**

### Phase 3 — `consolidate_duplicates()`

For all remaining inputs (non-email, post-thread-folding emails included): compute a similarity score on the first 5000 chars of canonical text.

- **Method:** MinHash on character 4-shingles → Jaccard estimate. Cheap, deterministic, no model calls. Threshold: similarity ≥ 0.8.
- **Alternative considered:** Bedrock Titan embeddings + cosine. Rejected for v1 — adds latency, cost, and a new IAM dependency without clear win on the duplication patterns we've seen (the MFP briefings share entire paragraphs verbatim, so MinHash wins easily).
- **Output:** for each duplicate group, pick canonical = longest text. Other members listed in `consolidated_with`. Members keep their filenames in the metadata trail; only the canonical is sent to Claude.
- **Validates against the MFP fixture:** `mfp_briefing.docx`, `mfp_briefing (1).docx`, and `forexventures_briefing.docx` should consolidate (first 5000c are >85% similar between the .docx pair, ~70% with the forexventures version after name swaps). The `IntellagenticXO · MFP Trading — XO Deployment Deep Dive.pdf` is structurally different (corrections-and-additions format, not narrative) and should NOT consolidate.
- **Effort: 6h** (MinHash impl + threshold tuning + group-resolution policy when `A~B`, `B~C`, `A!~C` — use connected-components, not pairwise).

### Phase 4 — `structure_transcripts()`

For files tagged `transcript`: Haiku pre-pass via `_invoke_bedrock_bearer` (existing helper, no new code path). Single structured prompt:

```
Extract from this meeting transcript. Return JSON only:
{
  "topics": ["..."],                # 3-7 topics covered
  "named_entities": {
    "people": ["..."],
    "organisations": ["..."],
    "places": ["..."],
    "products": ["..."]
  },
  "decisions": ["..."],             # decisions made or directions given
  "action_items": ["..."],          # who-does-what
  "distinctive_quotes": ["..."],    # 3-6 verbatim quotes that capture intent or detail
  "key_facts": ["..."]              # numbers, dates, scales, distinctive claims
}
```

- Replace the raw transcript with a synthesised brief: each section as a labelled paragraph.
- Cap structured output at ~3000 chars (well within the new per-file budget).
- **Validates against:** `Intro Call Edem and Alan Transcript.txt` (FC Dynamics, 40k chars, currently 0/3 cited) — post-structuring should preserve `Southern Housing`, `Crewe`, `AWAB's law` as named entities or quotes.
- **Effort: 6h** (prompt design + retry/repair on Haiku JSON failures + integration test on the two transcripts).

### Phase 5 — `smart_truncate()`

For remaining inputs > 20k chars (post-thread-fold, post-consolidation, post-transcript-structuring): chunk + Haiku summarise.

- Chunk at ~5000c boundaries (split on paragraph breaks where possible, fall back to char count).
- Per-chunk Haiku call: `Extract distinctive facts, named entities, section structure, and 2-3 verbatim quotes.`
- Concatenate chunk summaries into a single document summary, capped at ~6000c per file.
- Files ≤ 20k chars pass through with raw text (replaces the current `text[:5000]` flat truncate).
- **Validates against:** `Fire Strategy.pdf` (13,463c — passes through full at 20k threshold), `Sittingbourne` (15,790c — passes through), `mfp_briefing*` (21k+ — chunked + summarised, but already consolidated by phase 3).
- **Effort: 6h** (chunker, Haiku integration reuse from phase 4, reassembly).

### Phase 6 — `build_files_summary(processed_inputs)`

Replaces line 1300. Each block now carries:

```
=== <canonical_filename> ===
KIND: brief | email_thread | transcript_structured | brief_summarised
ORIGINAL_FILES: <comma-separated original filenames if consolidated/folded>
TRANSFORMATIONS: full | structured | summarised | folded(<n> emails)
ORIGINAL_CHARS: <int>   PROVIDED_CHARS: <int>

<content>
```

- The `ORIGINAL_FILES` line is the contract that lets Claude name every original filename in `sources[]` even when the content was consolidated.
- **Effort: 2h.**

### Phase 7 — Prompt-template + output-schema changes

- Add a paragraph above `OUTPUT FORMAT` (line 1406):
  > **Source coverage requirement.** The prompt above includes a `KIND` and `ORIGINAL_FILES` header for each input block. Your `sources[]` array MUST contain one entry per filename listed in `ORIGINAL_FILES` across every block — never aggregate filenames into one entry. If a filename was consolidated with others (its block has multiple ORIGINAL_FILES), populate that entry's `consolidated_with` field with the other filenames in the same block and explain in `note` why this file's content was redundant. If a filename's content yielded no distinctive signal, set `unique_signal: false` and explain in `note` (e.g. "near-duplicate of X, no unique content extracted"). Never silently drop a filename.
- Update the `sources[]` schema in the OUTPUT FORMAT block:

  ```json
  "sources": [
    {
      "filename": "<exact original upload filename>",
      "type": "client_data | client_config",
      "evidence": "<distinctive content from this file: a quote, a number, a named entity, a decision>",
      "unique_signal": true,
      "consolidated_with": [],
      "note": ""
    }
  ]
  ```

- **Backward-compat shim:** keep populating the old `sources[].reference` field by composing `f"{filename} — {evidence}"` server-side after Claude returns. Frontend + Streamline webhook continue to work unchanged. Mark the old field deprecated in a code comment; remove in a later branch.
- **Effort: 3h.**

### Phase 8 — Instrumentation in analysis JSON

Three new top-level fields, populated server-side from the `Transformations` dataclass after Claude returns:

```json
"truncated_files":   [{"filename": "...", "total_chars": N, "provided_chars": M, "method": "summarised|structured"}],
"consolidated_files":[{"canonical": "...", "members": ["..."], "similarity": 0.87}],
"structured_files":  [{"filename": "...", "kind": "transcript", "original_chars": N, "structured_chars": M}]
```

Operators querying the analysis JSON can immediately see what was transformed without re-running diagnostics. CloudWatch gets a one-line summary log too.

- **Effort: 2h.**

### Phase 9 — Tests + verification

See section 5 below.

### Phase 10 — Deploy + smoke

- Deploy via the existing pattern in CLAUDE.md (`backend/lambdas/enrich`, root-of-dir zip).
- Re-enrich FC Dynamics and MFP Trading from a UI-driven test (creates new `enrichments` rows; doesn't overwrite the audited ones since the constraint was "don't re-run before fix is deployed and verified" — fix is now deployed).
- Run Step D verification (section 5).
- **Effort: 2-3h.**

---

## 3. Total effort estimate

| Phase | Description | Hours |
| --- | --- | ---: |
| 0 | Scaffolding + slot wiring | 2 |
| 1 | `detect_file_kind` heuristics | 3 |
| 2 | Email thread folding | 4 |
| 3 | Duplicate consolidation (MinHash) | 6 |
| 4 | Transcript structuring (Haiku) | 6 |
| 5 | Smart truncation (Haiku chunking) | 6 |
| 6 | `build_files_summary` rewrite | 2 |
| 7 | Prompt + schema changes + back-compat | 3 |
| 8 | Instrumentation fields | 2 |
| 9 | Tests (existing + new) | 8 |
| 10 | Deploy + Step D re-verification | 3 |
| **Total** | | **45h** |

Realistically 1–1.5 weeks of focused work with two natural review gates: after phase 5 (preprocessing pipeline stable), and after phase 8 (full schema + instrumentation lands).

---

## 4. Prompt-template and output-schema diffs

### Diff: prompt body (line 1300 region)

```diff
- files_summary = "\n\n".join([
-     f"=== {filename} ===\n{text[:5000]}"
-     for filename, text in extracted_text.items()
- ])
+ processed_inputs, transformations = preprocess_documents(
+     extracted_text,
+     haiku_model_id=BEDROCK_MODEL_MAP['claude-haiku-4-5-20251001'],
+     bedrock_invoker=_invoke_bedrock_bearer if AWS_BEARER_TOKEN_BEDROCK else _invoke_bedrock_iam,
+ )
+ files_summary = build_files_summary(processed_inputs)
```

### Diff: prompt above OUTPUT FORMAT (after line 1404)

```diff
+ SOURCE COVERAGE REQUIREMENT (NON-NEGOTIABLE):
+ Each input block above has a header showing KIND, ORIGINAL_FILES (one or
+ more original upload filenames), and TRANSFORMATIONS applied. Your
+ sources[] array MUST contain exactly one entry per filename listed across
+ all ORIGINAL_FILES headers — no aggregation, no silent drops.
+
+ - If a filename was consolidated with others (its block has multiple
+   ORIGINAL_FILES), set "consolidated_with" to the other filenames in that
+   block and put the rationale in "note".
+ - If a filename yielded no distinctive content (rare — happens when the
+   file is near-identical to another), set "unique_signal": false and
+   explain in "note".
+ - Otherwise set "unique_signal": true and put a distinctive fact, quote,
+   or named entity from THAT file in "evidence".
```

### Diff: OUTPUT FORMAT — `sources[]` schema (around line 1472)

```diff
- "sources": [
-   {"type": "client_data", "reference": "filename or data source"}
- ]
+ "sources": [
+   {
+     "filename": "<exact original upload filename>",
+     "type": "client_data | client_config",
+     "evidence": "<distinctive content from this file>",
+     "unique_signal": true,
+     "consolidated_with": [],
+     "note": ""
+   }
+ ]
```

### Diff: OUTPUT FORMAT — new top-level instrumentation (server-side appended, NOT model-emitted)

```diff
+ // Populated by the Lambda after Claude returns, NOT by Claude itself.
+ // Claude is told to ignore these — they record preprocessing actions.
+ "truncated_files":    [{"filename": "...", "total_chars": N, "provided_chars": M, "method": "..."}],
+ "consolidated_files": [{"canonical": "...", "members": [...], "similarity": 0.87}],
+ "structured_files":   [{"filename": "...", "kind": "transcript", "original_chars": N, "structured_chars": M}]
```

---

## 5. Tests

### Existing tests in `backend/lambdas/tests/test_enrich_lambda.py` that need updating

| Test | What changes |
| --- | --- |
| `test_extract_plain_text`, `test_extract_csv`, `test_extract_csv_empty` | Unchanged. `extract_text` and `extract_csv` are not touched. |
| `test_repair_valid_json`, `test_repair_truncated_object`, `test_repair_truncated_string` | Unchanged. `_repair_truncated_json` not touched in this PR. |
| `test_no_audio_files`, `test_finds_audio_files` | Unchanged. Audio path not touched. |
| `test_read_unencrypted_config`, `test_read_missing_config_returns_none` | Unchanged. |
| `test_updates_stage` | Unchanged (just adds a `preprocessing` stage if we want — TBD). |
| `test_empty_uploads`, `test_skips_inactive_files`, `test_skips_audio_files` | Unchanged. `extract_all_files` not touched. |
| `test_options_returns_200`, `test_missing_client_id_returns_400`, `test_client_not_found_returns_404` | Unchanged. Phase 1 path not touched. |

No existing tests **break** — only one needs touching:

- A new mock for the Haiku pre-pass needs to be added to `mock_deps` so test runs don't try to hit Bedrock. Default mock returns the input text unchanged so legacy tests don't accidentally exercise the new path.

### New tests (in `test_enrich_lambda.py` or a new `test_enrich_preprocess.py`)

1. `test_detect_file_kind_email` — fixture: the `Intellagentic Mail - Re_...pdf` text. Asserts `kind=='email'`.
2. `test_detect_file_kind_transcript` — fixture: first 5000c of the Intro Call. Asserts `kind=='transcript'`.
3. `test_detect_file_kind_brief` — fixture: first 5000c of `mfp_briefing.docx`. Asserts `kind=='brief'`.
4. `test_fold_email_threads_groups_by_subject` — fixture: the two FC Dynamics Intellagentic Mail texts. Asserts they fold into one thread with both filenames in `members`.
5. `test_fold_email_threads_keeps_singletons_separate` — fixture: one email + one brief. Asserts no folding.
6. `test_consolidate_duplicates_minhash` — fixture: `mfp_briefing.docx` + `mfp_briefing (1).docx` first-5000c. Asserts they consolidate; canonical is the longer; members include both.
7. `test_consolidate_duplicates_keeps_distinct_files` — fixture: `Fire Strategy.pdf` + `Sittingbourne...pdf`. Different content, different addresses, different jobs. Asserts NOT consolidated.
8. `test_consolidate_duplicates_connected_components` — three files where A~B, B~C, A!~C (transitive). Asserts they form one group.
9. `test_structure_transcripts_extracts_named_entities` — fixture: Intro Call first 5000c, **mocked Haiku** that returns a known JSON. Asserts the synthesised brief contains "Southern Housing", "AWAB's law".
10. `test_smart_truncate_under_threshold_passes_full` — 18k char text. Asserts no transformation.
11. `test_smart_truncate_over_threshold_chunks` — 25k char text, mocked Haiku. Asserts output is the chunk-summarised version, not raw.
12. `test_build_files_summary_includes_kind_header` — asserts the output string has `KIND:` and `ORIGINAL_FILES:` headers per block.
13. `test_build_files_summary_consolidation_lists_members` — for a consolidated input, asserts all member filenames appear in the `ORIGINAL_FILES` line.
14. `test_analysis_postprocess_backfills_reference_field` — asserts old `sources[].reference` is server-populated for back-compat.
15. `test_analysis_postprocess_adds_instrumentation` — asserts `truncated_files`, `consolidated_files`, `structured_files` arrays are present.
16. `test_no_filename_dropped_from_sources` — end-to-end with mocked Bedrock returning a `sources[]` missing one input filename. Asserts the Lambda raises a clear error (not silent corruption).

### Verification — Step D re-run

Update `audits/diag_step_d_score_signatures.py` (or a v2) with:

```python
# Pass condition for round-3 Step D:
#   A file is "covered" if EITHER
#     (a) >= 1 of its 3 unique signatures appears in the analysis blob, OR
#     (b) sources[] contains an entry with filename matching, AND
#         consolidated_with is non-empty, AND note explains overlap.
#   Pass: every input file is covered.
```

Run pre-fix (today's analysis JSON, already done — 6 files fail).
Run post-fix on a fresh enrichment of FC Dynamics + MFP Trading.
**Pass criterion: 0 failing files.** Print a side-by-side table.

Save the post-fix Step D output as `audits/2026-04-26-enrich-bug-hunt-summary.md` addendum and as a separate `audits/2026-04-XX-step-d-postfix-results.md` (date filled in on actual fix day).

---

## 6. Risk register

| Risk | Mitigation |
| --- | --- |
| Haiku non-determinism in transcript/chunk summaries makes test fixtures brittle | Tests assert on shape + presence of named entities, not exact string match. Use a fuzzy assertion: "Southern Housing" appears in *some* field of the structured output. |
| Pre-pass adds 5-30s latency per long/transcript file | Run preprocessing per-file in parallel using `concurrent.futures.ThreadPoolExecutor`. Bedrock calls are I/O-bound; parallelism is safe. Cap at ~8 concurrent. |
| Cost: each Haiku call ~$0.001-0.005; 18 files × multiple chunks adds up | At current scale (~50 active clients, infrequent re-enrichment) cost is < $0.50/run. Log token usage to CloudWatch for ongoing visibility. Add a cost-cap circuit-breaker in phase 5: if total preprocessing tokens > N, fall back to flat truncation with a `degraded=true` flag in the analysis JSON. |
| New `sources[]` schema breaks frontend / Streamline webhook | Back-compat shim populates legacy `reference` field server-side. Frontend changes are NOT in scope of this branch — they're a separate follow-up only if/when the new fields need to render in the UI. |
| Claude ignores the SOURCE COVERAGE REQUIREMENT and aggregates filenames anyway | Post-process validation in Phase 7 (test 16): if `sources[]` doesn't cover every input filename, raise a structured error, retry the Bedrock call ONCE with a stricter "you missed these filenames: ..." prompt. If still fails, fall back to server-side filling of missing entries with `unique_signal: false, note: "Claude did not produce an entry; auto-filled."`. Never silently drop. |
| Production deploy disrupts in-flight enrichments | Deploy outside business hours. The two-phase async pattern means in-flight Phase 2 invocations finish on the old code; only new Phase 1 calls hit the new pipeline. Zero downtime. |

---

## 7. Out of scope for this branch (explicit non-goals)

- **Frontend changes.** No new UI for `truncated_files` / `consolidated_files`. Operators query the JSON directly until/unless we decide to surface it.
- **Streamline webhook payload changes.** Old `reference` field is preserved; new sources fields are not yet pushed to Streamline.
- **The three latent issues from the round-1 audit** (`list_objects_v2` pagination, `source_count` ↔ enrich predicate divergence, `_repair_truncated_json` silent masking). All separate branches.
- **Re-enrichment backfill.** Existing analysis JSONs in S3 are not regenerated. New runs use new code; old runs stay as historical record.
- **Embedding-based similarity.** v1 uses MinHash. Embeddings considered + rejected for v1; revisit only if MinHash misses real duplicates in production.

---

## 8. Review gates (for Ken)

1. **Now (this plan)** — approve / push back on architecture, similarity method, schema shape, back-compat strategy.
2. **After Phase 5** — code review of `preprocess.py` end-to-end before phase 6 wires it into the prompt.
3. **After Phase 8** — code review of full schema + instrumentation before deploy.
4. **After deploy + Step D re-run** — verify pass criterion on FC Dynamics + MFP Trading; sign off on closing the branch.

Plan stops here. Awaiting approval to begin Phase 0.
