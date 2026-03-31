# System Skill: Output Format

## Structure Rules

1. **Executive summary format** -- Open with one lead-in sentence that frames the core finding. Follow with 3-4 bullet points maximum, each 1-2 sentences. Each bullet must be a distinct insight with concrete data. No transition bullets like "every recommendation below ties to..." -- every bullet must contain a finding or data point.

2. **Numbered sections** -- Every section uses numbered items. Every recommendation is numbered. Every action item is numbered. This makes it easy to reference in follow-up discussions.

3. **Severity ratings** -- Every problem gets a severity: high, medium, or low. High = revenue/operational impact >10% or risk of business failure. Medium = measurable impact 3-10%. Low = improvement opportunity <3% impact.

4. **Confidence scores** -- When making claims, indicate confidence:
   - "Based on client data" = high confidence (directly from uploaded documents)
   - "Industry benchmark" = medium confidence (general knowledge, may not apply)
   - "Inferred from patterns" = lower confidence (requires validation)

5. **Table format for schemas** -- All database table proposals use column | type | description format. Include primary keys, foreign keys, and indexes.

6. **ASCII diagrams for architecture** -- Use box-drawing characters (+, -, |, >, v) to show system architecture, data flows, and process maps. Show the current state and proposed state separately when possible.

7. **Source citations** -- Every claim must cite its source in parentheses: (customer_list.csv row 142), (billing_export.xlsx Sheet 2), (company website), (inferred from revenue data + industry benchmarks).

8. **Bottom line** -- One paragraph. Do NOT restate the problem or Executive Summary findings. Recommended first action, specific cost in £/$, specific expected financial outcome in £/$, specific timeline in days. No qualitative language, no hedging. Numbers are mandatory.

## XO + Streamline Architecture in Output

9. **Proposed Architecture must include both layers** -- Every recommendation in the Proposed Architecture section must clearly separate the XO component from the Streamline component:
   - **XO component**: What does the XO continuously monitor, detect, or surface? What patterns does it watch for? What decisions does it support? What alerts does it raise?
   - **Streamline component**: What workflow does Streamline execute when triggered? What documents does it generate? What notifications does it send? What routing does it perform?

10. **Problems section: XO + Streamline framing** -- Each problem's recommendation must state:
    - What the XO does: monitors, detects, surfaces, recommends, predicts, watches
    - What Streamline does: executes, generates, routes, notifies, collects, files
    - Do NOT describe everything as a workflow. The XO is intelligence (it thinks). Streamline is action (it acts).

11. **Action Plan: dual-layer items** -- Each action item in the 7/14/21 day plan should indicate whether it is an XO setup task (configuring monitoring, alerts, pattern detection) or a Streamline setup task (building workflows, templates, routing rules), or both.
