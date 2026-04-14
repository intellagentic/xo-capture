---
name: intellagentic-brief
description: "Create branded IntellagenticXO client deployment briefs (.docx) -- the strategic leave-behind document that accompanies the Growth Deck. Trigger this skill whenever the user asks to create a deployment brief, client brief, XO brief, or strategic deployment document. The brief expands on the deck with narrative depth -- it is NOT a copy of the deck, NOT a technical manual, and NOT a repeat of the Results page. Each section has one job. No content appears twice."
---

# System Skill: Brief Generation

The deployment brief is the leave-behind document. The prospect reads it after the meeting. It expands on what the deck showed with narrative depth, evidence, and strategic framing.

## The Three Outputs -- What Goes Where

The enrichment engine produces one set of analysis data. Three outputs consume it differently:

| Output | Purpose | Audience Moment | Length |
|--------|---------|----------------|--------|
| **Results Page** | Raw analysis with full evidence and recommendations | Internal review by Intellagentic team | Unlimited |
| **Growth Deck** | Executive pitch -- stats, visuals, headlines | In the room, 10-minute presentation | 8 slides |
| **Deployment Brief** | Strategic companion -- narrative depth behind the deck | Read after the meeting, shared internally by prospect | 8-10 pages |

**The cardinal rule: each piece of content appears in ONE section only.** If a problem is described in Section 02, it is not described again in Section 04. If a Streamline workflow is explained alongside its solution, it does not get a separate section.

## Document Structure

```
Cover Page (dark branded, CONFIDENTIAL)
├── INTELLAGENTICXO header
├── Client name
├── "XO Deployment:" + headline framing (one sentence)
├── Value proposition with quantified impact
├── Client contact | Prepared by | Meeting date
└── STRICTLY CONFIDENTIAL footer

Executive Summary (1 page max)
├── Opening: what the client does, their scale
├── The insight: the single biggest operational finding
├── The opportunity: what changes with XO
├── Key Metrics Row (4 stat boxes)
└── No recommendations here -- just the picture

01 CLIENT PROFILE (1 page max)
├── Company background, founding, industry, scale
├── Key personnel named
├── Technology landscape (what systems they use today)
└── Their unique differentiator or strategic position

02 THE OPERATIONAL CRISIS (1-2 pages max)
├── Each problem: title + severity + 2-3 sentence evidence paragraph
├── Evidence cites specific client data, documents, or statements
├── NO recommendations -- just the pain points
├── NO XO Component / Streamline Component blocks
└── Closes with a single paragraph on cumulative business impact

03 WHY STANDARD AI CANNOT BE USED HERE (1 page max)
├── Two-column: Standard AI/LLMs vs The XO Executive
├── Domain-specific examples of where generic AI fails
├── THE PRINCIPLE callout box
└── Mirrors deck slide 02 (Protocol vs Probability) with more depth

04 THE XO DEPLOYMENT (2-3 pages max)
├── OODA workflow (4 phases with domain-specific examples)
├── Architecture overview (ASCII diagram or structured description)
├── Solution mapping: for each problem in Section 02, ONE paragraph
│   describing how XO + Streamline addresses it
│   ├── What XO does (monitors, detects, surfaces, decides)
│   ├── What Streamline does (executes, routes, notifies, generates)
│   └── Expected operational outcome (1 sentence)
├── THIS IS THE ONLY SECTION WITH RECOMMENDATIONS
└── Streamline workflows are described here, not in a separate section

05 CONSTITUTIONAL SAFETY (0.5-1 page max)
├── What the safety layer prevents (3-5 items, domain-specific)
├── What it guarantees (3-5 items, domain-specific)
├── THE GUARANTEE callout box
└── Short and punchy -- this is a trust signal, not a chapter

06 PROOF OF CONCEPT & NEXT STEPS (1-2 pages max)
├── 21-day timeline as a 3-column table ONLY
│   ├── Week 1: Build & Demo (4-5 items)
│   ├── Week 2: Validate & Connect (4-5 items)
│   └── Week 3: Deploy or Decide (4-5 items)
├── NO narrative preamble repeating the table content
├── SUCCESS METRIC callout: "The pilot is successful when..."
└── Matches deck slide 06 structure but with more specific action items
```

## What Was Removed (and Why)

**Section 06 Streamline Applications as a standalone section -- DELETED.** The Streamline workflows are now described in Section 04 alongside the XO solution for each problem. A separate Streamline section duplicated content from both Section 02 recommendations and Section 04 architecture.

**Recommendation blocks in Section 02 -- REMOVED.** Section 02 describes problems only. Solutions live in Section 04. The old pattern of Evidence + Recommendation + XO Component + Streamline Component + Expected Outcome per problem created walls of text and tripled the content.

**Narrative preamble in Section 06 POC -- REMOVED.** The old brief had 2-3 pages of narrative describing the POC steps, then repeated them in the timeline table. Now it is table only.

**Section 01 operational content -- MOVED to Section 02.** The old brief put operational detail in both Section 01 (Client Profile) and Section 02 (Operational Crisis), creating duplication. Section 01 is now company background only.

## Page Budget

| Section | Max Pages |
|---------|-----------|
| Cover | 1 |
| Executive Summary | 1 |
| 01 Client Profile | 1 |
| 02 Operational Crisis | 1-2 |
| 03 Why Not Standard AI | 1 |
| 04 XO Deployment | 2-3 |
| 05 Constitutional Safety | 0.5-1 |
| 06 POC & Next Steps | 1-2 |
| **Total** | **8-12** |

If the brief exceeds 12 pages, content is too verbose. Cut.

## Content Rules

### Voice & Tone
- **Authoritative, not salesy.** Deployment brief, not brochure.
- **Specific, not generic.** Every claim ties to the client's actual data.
- **The client's language.** Mirror their industry terminology.
- **Direct.** Lead with the insight, not the preamble.
- **Concise.** If a paragraph can be a sentence, make it a sentence.

### Section 04 Solution Mapping Pattern

For each problem from Section 02, use this exact pattern (one paragraph each):

> **[Problem Title]:** The XO [monitors/detects/surfaces specific thing]. When [condition], Streamline [executes/routes/notifies specific action]. [One-sentence expected outcome.]

Example:
> **Manual Parcel Tracking:** The XO polls carrier tracking APIs daily at 06:00 and classifies every shipment as On Track, Delayed, Exception, or Delivered. When an exception is flagged, Streamline sends a prioritised notification to the customer and creates a CS task with carrier context and suggested resolution. Staff arrive to a clean exception list instead of logging into 5+ carrier portals.

That is the entire recommendation for one problem. Not a page. One paragraph.

### Mandatory Inclusions
- Quantified impact in executive summary (dollars, hours, percentages)
- Named client personnel
- Named client systems and technology
- OODA loop with domain-specific examples
- Constitutional Safety as standalone section
- POC timeline with specific deliverables per week
- "The pilot is successful when..." closing metric

### Mandatory Exclusions
- No pricing or fee structures
- No implementation cost breakdowns
- No competitor comparisons by name
- No guarantees of financial outcomes
- No internal architecture details (no AWS, Lambda, YAML)
- No Streamline mentioned by name in Sections 01-03 (internal platform detail)
- Streamline IS named in Section 04 solutions and Section 06 POC timeline

### XO Capture Skill Integration

| Capture Skill | Brief Section |
|--------------|---------------|
| analysis-framework | 01 Client Profile, 02 Operational Crisis |
| enrichment-process | Evidence citations in 02 |
| output-format | Severity ratings in 02, POC prioritization in 06 |
| client-facing-summary | Executive Summary framing |
| authority-boundaries | 05 Constitutional Safety |
| streamline-applications | 04 XO Deployment solution mapping |

## Brand System

### Colors

```javascript
const BRAND = {
  darkNavy:     "0D0D0D",   // cover background
  navy:         "1A1A2E",   // section number backgrounds
  teal:         "0F969C",   // accent lines, section numbers
  tealLight:    "6DD5ED",   // subtitle text on dark
  xoRed:        "CC0000",   // "XO" text everywhere -- NON-NEGOTIABLE
  white:        "FFFFFF",
  headingBlue:  "1A1A2E",   // H1
  subheadBlue:  "2F5496",   // H2
  bodyText:     "333333",
  mutedGray:    "666666",
  lightGray:    "808080",
  calloutBg:    "F0F7F7",
  calloutBorder:"0F969C",
  riskBg:       "FFF5F5",
  riskBorder:   "CC0000",
  tableBg:      "F1F5F9",
  tableAlt:     "F8FAFC",
  compareBg:    "E8F5E9",
};
```

### The Red XO Rule

**Every occurrence of "XO" in text must be colored CC0000 (brand red).** No exceptions.

### Typography

| Element | Font | Size | Color |
|---------|------|------|-------|
| Cover title | Trebuchet MS, bold | 28pt | White |
| Cover subtitle | Calibri | 14pt | tealLight |
| Section number | Trebuchet MS, bold | 14pt | teal on navy bg |
| H1 | Trebuchet MS, bold | 18pt | headingBlue |
| H2 | Calibri Light, bold | 14pt | subheadBlue |
| Body | Calibri | 11pt | bodyText |
| Key metric value | Trebuchet MS, bold | 24pt | teal |
| Key metric label | Calibri | 9pt | mutedGray |

### Page Layout

- **Paper:** A4 (11906 x 16838 DXA)
- **Margins:** 1 inch (1440 DXA) all sides
- **Header:** "INTELLAGENTICXO" with red XO + client name + CONFIDENTIAL
- **Footer:** "IntellagenticXO · Strictly Confidential" + page number

## QA Checklist

1. Total page count within 8-12 range
2. No content appears in more than one section
3. Section 02 has ZERO recommendations
4. Section 04 is the ONLY section with solutions
5. Section 06 timeline has NO narrative preamble
6. Red XO treatment on all "XO" occurrences
7. Cover page formatting and CONFIDENTIAL marking
8. Header/footer on every page after cover
9. All callout boxes render with correct borders and shading
10. No orphaned headings