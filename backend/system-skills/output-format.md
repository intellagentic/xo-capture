# System Skill: Output Format

## Structure Rules

1. **Executive summary format** -- The first line MUST be a single standalone sentence framing the core finding. Not a bullet — a sentence. Follow with EXACTLY 3 bullet points. Not 4, not 5, not 6. Three. Each bullet: 1-2 sentences maximum. If it exceeds 2 sentences, split or cut. Each bullet covers a distinct theme — no overlap between bullets. No transition or summary bullets like "the immediate opportunity is..." — every bullet must contain a concrete finding or data point.

2. **Numbered sections** -- Every section uses numbered items. Every recommendation is numbered. Every action item is numbered. This makes it easy to reference in follow-up discussions.

3. **Problems identified (top 3-5)** -- For each problem provide:
   - Title (clear, specific)
   - Severity: high, medium, or low. High = revenue/operational impact >10% or risk of business failure. Medium = measurable impact 3-10%. Low = improvement opportunity <3% impact.
   - Evidence: cite specific data from the documents (row counts, dollar amounts, percentages, page numbers)
   - Recommendation: concrete action with expected outcome

4. **Confidence scores** -- When making claims, indicate confidence:
   - "Based on client data" = high confidence (directly from uploaded documents)
   - "Industry benchmark" = medium confidence (general knowledge, may not apply)
   - "Inferred from patterns" = lower confidence (requires validation)

5. **Table format for schemas** -- All database table proposals use this exact format:
   Table: table_name -- purpose
   | Column | Type | Description |
   |--------|------|-------------|
   | id | UUID | Primary key |
   Include primary keys, foreign keys, indexes. Show relationships between tables after definitions.

6. **ASCII diagrams for architecture** -- Use box-drawing characters (+, -, |, >, v) to show system architecture, data flows, and process maps. Example:
   +----------+     +----------+     +---------+
   | Source A  |---->| Process  |---->| Output  |
   +----------+     +----------+     +---------+
   Show the current state and proposed state separately when possible.

7. **Source citations** -- Every claim must cite its source in parentheses: (customer_list.csv row 142), (billing_export.xlsx Sheet 2), (company website), (inferred from revenue data + industry benchmarks).

8. **7/14/21 Day Action Plan** -- Three phases:
   - 7-day: Build and demo -- prototype the solution to the primary pain point, get it on screen, show it live
   - 14-day: Validate and connect -- incorporate feedback, validate data connections, prepare for real deployment
   - 21-day: Deploy or decide -- go live with the solution or make the build/buy decision
   Numbered items within each phase. Each action should be specific and measurable. Include expected cost or effort level where possible.

9. **Bottom line** -- First word must be a verb (Deploy, Build, Schedule, Launch). No problem restatement. Maximum 4 sentences. Every sentence must contain at least one number (£, $, %, days, hours). No narrative framing — pure action + cost + outcome + timeline.

## XO + Streamline Architecture in Output

10. **Proposed Architecture must include both layers** -- Every recommendation in the Proposed Architecture section must clearly separate the XO component from the Streamline component:
    - **XO component**: What does the XO continuously monitor, detect, or surface? What patterns does it watch for? What decisions does it support? What alerts does it raise?
    - **Streamline component**: What workflow does Streamline execute when triggered? What documents does it generate? What notifications does it send? What routing does it perform?

11. **Problems section: XO + Streamline framing** -- Each problem's recommendation must state:
    - What the XO does: monitors, detects, surfaces, recommends, predicts, watches
    - What Streamline does: executes, generates, routes, notifies, collects, files
    - Do NOT describe everything as a workflow. The XO is intelligence (it thinks). Streamline is action (it acts).

12. **Action Plan: dual-layer items** -- Each action item in the 7/14/21 day plan should indicate whether it is an XO setup task (configuring monitoring, alerts, pattern detection) or a Streamline setup task (building workflows, templates, routing rules), or both.
