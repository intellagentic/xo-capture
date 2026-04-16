# System Skill: Output Format

## Structure Rules

1. **Lead with the headline** -- The first sentence of the executive summary must state the single most important finding. Not a preamble. Not context. The insight.

2. **Numbered sections** -- Every section uses numbered items. Every recommendation is numbered. Every action item is numbered. This makes it easy to reference in follow-up discussions.

3. **Severity ratings** -- Every problem gets a severity: high, medium, or low. High = revenue/operational impact >10% or risk of business failure. Medium = measurable impact 3-10%. Low = improvement opportunity <3% impact.

4. **Confidence scores** -- When making claims, indicate confidence:
   - "Based on client data" = high confidence (directly from uploaded documents)
   - "Industry benchmark" = medium confidence (general knowledge, may not apply)
   - "Inferred from patterns" = lower confidence (requires validation)

5. **Table format for schemas** -- All database table proposals use column | type | description format. Include primary keys, foreign keys, and indexes.

6. **ASCII diagrams for architecture** -- Use box-drawing characters (+, -, |, >, v) to show system architecture, data flows, and process maps. Show the current state and proposed state separately when possible.

7. **Source citations** -- Every claim must cite its source in parentheses: (customer_list.csv row 142), (billing_export.xlsx Sheet 2), (company website), (inferred from revenue data + industry benchmarks).

8. **Bottom line** -- End with a direct, CEO-level summary. One paragraph. What to do first. What outcome to expect. No hedging.

## Problem Structure — Evidence and Recommendation as Separate Fields

9. **Every problem must have two distinct sections: evidence and recommendation.** These must be clearly separated in the output — not merged into a single narrative block.

   - **Evidence:** 3-5 sentences maximum. What the data shows. Cite specific sources. No opinions, no solutions — just the facts of the problem and its business impact. If the evidence can be stated in 2 sentences, use 2 sentences.

   - **Recommendation:** 3-5 sentences maximum. What XO does and what Streamline does to address this problem, plus the expected outcome. One paragraph — not sub-sections, not separate XO Component / Streamline Component blocks. Use the pattern: "The XO [monitors/detects/surfaces X]. Streamline [executes/routes/notifies Y]. Expected outcome: [Z]."

10. **Do NOT write implementation manuals inside recommendations.** A recommendation is a strategic summary of what the solution does, not a technical specification of how to build it. No API names, no polling frequencies, no database schemas, no code patterns. Those belong in the POC plan, not in the problem recommendation.

11. **Do NOT repeat evidence inside recommendations.** The recommendation assumes the reader has just read the evidence. Do not restate the problem — go straight to the solution.

## XO + Streamline Architecture in Output

12. **Proposed Architecture must include both layers** -- Every recommendation in the Proposed Architecture section must clearly separate the XO component from the Streamline component:
   - **XO component**: What does the XO continuously monitor, detect, or surface? What patterns does it watch for? What decisions does it support?
   - **Streamline component**: What workflow does Streamline execute when triggered? What documents does it generate? What notifications does it send?

13. **Problems section: concise dual-layer framing** -- Each problem's recommendation must state:
    - What the XO does: monitors, detects, surfaces, recommends, predicts, watches
    - What Streamline does: executes, generates, routes, notifies, collects, files
    - Do NOT describe everything as a workflow. The XO is intelligence (it thinks). Streamline is action (it acts).
    - The entire recommendation paragraph must fit in 3-5 sentences. If it exceeds this, it is too verbose. Cut.

14. **Action Plan: dual-layer items** -- Each action item in the 7/14/21 day plan should indicate whether it is an XO setup task, a Streamline setup task, or both. Each item is 1-2 sentences maximum — a deliverable, not a paragraph.

## Verbosity Controls

15. **Executive Summary: MUST be exactly 3 paragraphs separated by double newlines (\n\n).** This structure is non-negotiable — the frontend parser depends on it.
   - **Paragraph 1:** Bold headline — single sentence stating the key insight. Then 2-3 sentences of context.
   - **Paragraph 2:** The operational opportunity explanation.
   - **Paragraph 3:** MUST start with the literal text "Key metrics:" followed by comma-separated metrics with numbers. Example: "Key metrics: ~100-150 parcels/day shipping volume, zero automated exception detection today, 300+ potential franchise deployments, and 2-3 hours daily CS time on manual portal checks." No fourth paragraph. Do NOT merge these into a single paragraph.

16. **Client Profile section: 1 page maximum.** Company background, industry, scale, key personnel, technology landscape. No operational problems — those belong in the Problems section.

17. **Each problem: evidence + recommendation together must not exceed 250 words.** If a problem requires more detail, the extra detail goes in the POC plan — not in the problem description.

18. **POC timeline: action items only.** Each week gets 4-6 numbered items, each 1-2 sentences. No narrative preamble before the timeline. No prose paragraphs explaining what each week covers — the items speak for themselves.

19. **Constitutional Safety: 1 page maximum.** 3-5 prevents, 3-5 guarantees, one callout box. No elaboration beyond what fits on one page.

20. **Why Standard AI section: 1 page maximum.** Two-column comparison plus THE PRINCIPLE callout. No extended prose.

21. **Total brief output should produce 8-12 pages when formatted.** If the content would exceed 12 pages, the output is too verbose. Prioritise conciseness over completeness — the brief is a strategic leave-behind, not a technical manual.