---
name: intellagentic-brief
description: "Create branded IntellagenticXO client deployment briefs (.docx) -- the strategic documents used to present XO deployment proposals to prospective clients. Trigger this skill whenever the user asks to create a deployment brief, client brief, XO brief, prospect brief, or strategic deployment document for a specific client or prospect. Also trigger when creating documents that follow the MFP Trading brief structure: cover page, executive summary with key metrics, numbered operational sections, OODA workflow, constitutional safety, and POC timeline. Use this skill even if the user just says 'brief' or 'deployment doc' in a context where an XO client engagement is involved. This skill uses XO Capture skill files (analysis-framework, enrichment-process, output-format, client-facing-summary, authority-boundaries, streamline-applications) as analytical inputs when client data is available."
---

# System Skill: Brief Generation

Create professional, branded client deployment briefs in .docx format. These are the strategic documents that present the XO value proposition to a specific prospect -- modeled on the MFP Trading deployment brief.

## Before Starting

1. **Read the docx skill** at `/mnt/skills/public/docx/SKILL.md` for docx-js setup, validation, and critical rules
2. **Read the code reference** at `references/code-patterns.md` (relative to this skill) for ready-to-use branded code blocks
3. **Copy brand assets** from this skill's `assets/` folder to `/home/claude/` before building

## When This Skill Is Used

This skill produces the **client-facing deployment brief** -- the document that goes to the prospect (e.g., Francois at MFP Trading). It is NOT for:
- Internal meeting summaries (use `intellagentic-docs`)
- Investor pitch decks (use `intellagentic-deck`)
- XO Capture analysis JSON output (that's the Capture system itself)

The brief takes XO Capture analysis outputs and client context and transforms them into a polished, branded strategic document.

## Document Structure

The brief follows a fixed structure. Every section is present in every brief, adapted to the client's domain:

```
Cover Page (dark branded, CONFIDENTIAL)
├── INTELLAGENTICXO header
├── Client name and location
├── "XO Deployment:" + headline framing
├── One-sentence value proposition with dollar/time impact
├── Client contact, Prepared by, Meeting date
└── STRICTLY CONFIDENTIAL footer

Executive Summary
├── Opening paragraph: what the client does, scale, the automated part
├── "The problem is everything around it." pivot
├── The operational crisis in specific terms
├── The human cost (specific to client leadership)
├── XO deployment framing: "Not replacing X's judgment -- encoding it."
├── Key Metrics Row (4 stat boxes with labels)
└── e.g., "$4.5bn Peak Daily Volume", "500+ Daily Comms", "2-3 yrs Training Time", "2 Days Off/Year"

01 CLIENT PROFILE
├── Company background, founding, location
├── Two-column layout: Technology Infrastructure | Leadership
├── Branded callout box for the client's core differentiator
└── "The operational crisis is not a technology deficit" framing

02 THE OPERATIONAL CRISIS: ANATOMY OF THE BOTTLENECK
├── "To position the XO correctly..." opening
├── How problems occur (bullet list specific to domain)
├── Why the critical risk window exists (geography, timing, staffing)
├── Current Reality vs Target State comparison table
└── Risk context callout box with financial quantification

03 WHY STANDARD AI CANNOT BE USED HERE
├── Two-column layout: Problem with Probabilistic AI | What Protocol-Grade Handling Requires
├── Specific examples of where LLMs fail in this domain
├── Audit trail argument
└── THE PRINCIPLE callout: "The XO is not a language model. It is a System of Action..."

04 THE XO DEPLOYMENT: ARCHITECTURE & OODA WORKFLOW
├── DX Cartridge explanation (domain-specific knowledge encoding)
│   ├── Exception/event taxonomy
│   ├── Resolution/response procedures
│   ├── Historical precedents
│   └── Authority matrix
├── OODA Loop walkthrough (4 phases with icons)
│   ├── OBSERVE: Detection & State Capture
│   ├── ORIENT: Historical Matching & Risk Classification
│   ├── DECIDE: Procedure Selection & Evidence Assembly
│   └── ACT: Guided Resolution & Traceable Escalation
└── Each phase has 2-4 specific sub-bullets adapted to client domain

05 CONSTITUTIONAL SAFETY: THE NON-NEGOTIABLE GUARDRAILS
├── Two-column: What the Safety Layer Prevents | What It Guarantees
├── 5 prevents, 5 guarantees (domain-specific)
└── THE GUARANTEE callout box

06 PROOF OF CONCEPT & NEXT STEPS
├── "Avoid Boiling the Ocean" scoping principle
├── Dual filter: Frequency + Risk Weight
├── Knowledge Abstraction Session description
├── POC Timeline table (8 steps with Week markers)
└── SUCCESS METRIC callout: the sleep test / operational freedom metric
```

## Brand System

### Colors

```javascript
const BRAND = {
  // Document colors
  darkNavy:     "0D0D0D",   // cover page background (simulated via shading)
  navy:         "1A1A2E",   // section number backgrounds
  teal:         "0F969C",   // accent lines, section numbers
  tealLight:    "6DD5ED",   // subtitle text on dark backgrounds
  xoRed:        "CC0000",   // "XO" text everywhere -- NON-NEGOTIABLE
  white:        "FFFFFF",
  // Body colors
  headingBlue:  "1A1A2E",   // H1 headings
  subheadBlue:  "2F5496",   // H2 headings
  bodyText:     "333333",   // body paragraphs
  mutedGray:    "666666",   // metadata, captions
  lightGray:    "808080",   // footer text
  // Box colors
  calloutBg:    "F0F7F7",   // light teal tint for callout boxes
  calloutBorder:"0F969C",   // teal border for callout boxes
  riskBg:       "FFF5F5",   // light red tint for risk/warning boxes
  riskBorder:   "CC0000",   // red border for risk boxes
  tableBg:      "F1F5F9",   // table header background
  tableAlt:     "F8FAFC",   // alternating row background
  compareBg:    "E8F5E9",   // green tint for "target state" column
};
```

### The Red XO Rule

**Every occurrence of "XO" in text must be colored CC0000 (brand red).** This applies to:
- "IntellagenticXO" in headers
- "XO Deployment" in titles
- "XO" in body text ("the XO acts as...", "XO Capture", "XO Manager")
- The tagline: "The XO clears the path."

Use the `xoTextRuns()` helper from code-patterns.md to split text at "XO" boundaries.

### Typography

| Element | Font | Size | Color |
|---------|------|------|-------|
| Cover title | Trebuchet MS, bold | 28pt | White |
| Cover subtitle | Calibri | 14pt | tealLight |
| Section number (01, 02...) | Trebuchet MS, bold | 14pt | teal on navy bg |
| H1 (section titles) | Trebuchet MS, bold | 18pt | headingBlue |
| H2 (subsections) | Calibri Light, bold | 14pt | subheadBlue |
| Body text | Calibri | 11pt | bodyText |
| Callout label | Calibri, bold | 11pt | teal or xoRed |
| Callout body | Calibri | 11pt | bodyText |
| Key metric value | Trebuchet MS, bold | 24pt | teal |
| Key metric label | Calibri | 9pt | mutedGray |
| Footer | Calibri | 9pt | lightGray |

### Page Layout

- **Paper:** A4 (11906 x 16838 DXA) -- UK-originated company, UK clients
- **Margins:** 1 inch (1440 DXA) all sides
- **Content width:** 9026 DXA (A4 with 1" margins)
- **Header:** "INTELLAGENTICXO" with red XO + client name + "CONFIDENTIAL" on every page after cover
- **Footer:** "IntellagenticXO · Strictly Confidential" + page number on every page

## Key Formatting Elements

### Section Number Badges
Each major section (01-06) gets a numbered badge: the number in teal on a navy background strip.

### Callout Boxes
Three types, each a single-row table with colored border:
- **THE PRINCIPLE / THE EDGE / etc.** -- teal border, light teal bg, bold label
- **RISK CONTEXT / WARNING** -- red border, light red bg, warning icon
- **THE GUARANTEE / SUCCESS METRIC** -- teal border, bold label, closing statement

### Comparison Tables
Used in Section 02 (Current vs Target) and Section 03 (Problems vs Requirements):
- Left column: current state (neutral bg)
- Right column: target/required state (green-tinted bg)
- Arrow indicators between rows

### Key Metrics Row
Four stat boxes in the Executive Summary:
- Large number/value in teal bold
- Label underneath in small gray text
- Arranged in a 4-column table with no visible borders

### OODA Workflow
Four-phase layout with emoji icons (or Unicode symbols):
- Each phase: icon + name + tagline on one line
- Indented sub-bullets describing the phase
- Visual hierarchy: phase name bold and colored, sub-bullets normal

### POC Timeline Table
8-row table with Step | Timeline | Action columns:
- Step numbers 1-8
- Timeline: "Immediate", "Week 1", "Week 1-2", etc.
- Action: detailed description of deliverable

## Content Rules

### Voice & Tone
- **Authoritative, not salesy.** This is a deployment brief, not a brochure.
- **Specific, not generic.** Every claim ties to the client's actual numbers, systems, and people.
- **The client's language.** Mirror the client's industry terminology throughout.
- **Direct.** Lead with the insight, not the preamble.

### Mandatory Inclusions
- Dollar/time impact quantification in the executive summary
- Named client personnel (founder, COO, operations lead)
- Named client systems and technology
- "Not replacing X's judgment -- encoding it" framing
- OODA loop with domain-specific examples at each phase
- Constitutional Safety as a standalone section (not buried)
- POC timeline with specific deliverables and weeks
- "The pilot is successful when..." closing metric

### Mandatory Exclusions
- No pricing, cost estimates, or fee structures
- No implementation cost breakdowns
- No competitor comparisons by name
- No guarantees of financial outcomes (use "designed to", "targeted at")
- No internal Intellagentic architecture details (no AWS, Lambda, YAML references)
- No mention of Streamline by name in the brief (it's an internal platform detail)

### XO Capture Skill Integration

When client data is available from XO Capture analysis, map the Capture skill outputs to brief sections:

| Capture Skill | Brief Section |
|--------------|---------------|
| analysis-framework (Revenue, Cost, Bottlenecks, Risk) | 01 Client Profile, 02 Operational Crisis |
| enrichment-process (data hierarchy, contradictions) | Evidence citations throughout |
| output-format (severity ratings, confidence scores) | 02 Crisis severity, 06 POC prioritization |
| client-facing-summary (3-5 bullet points) | Executive Summary value framing |
| authority-boundaries (safe vs. flag for review) | 05 Constitutional Safety mapping |
| streamline-applications (workflow recommendations) | 04 XO Deployment (without naming Streamline) |

## QA Process

1. Build the .docx
2. Validate: `python scripts/office/validate.py brief.docx`
3. Convert to PDF: `python scripts/office/soffice.py --headless --convert-to pdf brief.docx`
4. Convert to images: `pdftoppm -jpeg -r 150 brief.pdf page`
5. Visual inspect every page for:
   - Red XO treatment on all "XO" occurrences
   - Cover page formatting and CONFIDENTIAL marking
   - Table alignment and column widths
   - Callout box borders and shading
   - Section number badges
   - Header/footer on every page
   - No orphaned headings (heading at bottom of page with content on next)
6. Fix issues and re-verify
7. Copy final to `/mnt/user-data/outputs/`

## Versioning

Always version output files. Use `_v1`, `_v2` suffixes. Never overwrite.