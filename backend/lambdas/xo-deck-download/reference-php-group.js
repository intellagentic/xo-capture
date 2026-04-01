const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "IntellagenticXO";
pres.title = "PHP Group — XO Facilities Management Platform";

const NAVY = "1B2A4A";
const BLUE = "2E75B6";
const RED = "C0392B";
const WHITE = "FFFFFF";
const LIGHT_BG = "EDF2F8";
const GREY = "555555";
const CARD_BG = "1A2030";
const NEAR_WHITE = "F0F4F8";
const GREEN = "27AE60";

const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.18 });
const makeCardShadow = () => ({ type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.25 });

// ============================================================
// SLIDE 1: TITLE — Briefing-led framing (RAG 3.1, 3.25)
// ============================================================
let s1 = pres.addSlide();
s1.background = { color: NAVY };

s1.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 0, w: 3.5, h: 2.2, fill: { color: BLUE, transparency: 85 } });
s1.addShape(pres.shapes.RECTANGLE, { x: 7.8, y: 0, w: 2.2, h: 1.2, fill: { color: RED, transparency: 85 } });

s1.addText([
  { text: "Intellagentic", options: { bold: true, color: WHITE, fontSize: 16 } },
  { text: "XO", options: { bold: true, color: RED, fontSize: 16 } }
], { x: 0.7, y: 0.5, w: 4, h: 0.5, margin: 0 });

s1.addText("Operational Briefing:\nFM Across 1,142 Properties", {
  x: 0.7, y: 1.5, w: 8.5, h: 2.0,
  fontSize: 34, fontFace: "Georgia", bold: true, color: WHITE,
  lineSpacingMultiple: 1.15, valign: "top", margin: 0
});

s1.addShape(pres.shapes.LINE, { x: 0.7, y: 3.7, w: 2.5, h: 0, line: { color: RED, width: 3 } });

// Briefing-led positioning phrase (RAG 3.25: Never pitch, brief)
s1.addText("You are the domain experts. This is our take on status and next steps.", {
  x: 0.7, y: 3.95, w: 7, h: 0.4,
  fontSize: 12, fontFace: "Arial", italic: true, color: "B0BEC5", margin: 0
});

s1.addText("Prepared for Yasmin Romane  |  31 March 2026", {
  x: 0.7, y: 4.5, w: 6, h: 0.4,
  fontSize: 13, fontFace: "Arial", color: NEAR_WHITE, margin: 0
});

s1.addText("CONFIDENTIAL", {
  x: 0.7, y: 5.1, w: 3, h: 0.35,
  fontSize: 10, fontFace: "Arial", italic: true, color: GREY
});


// ============================================================
// SLIDE 2: PHP GROUP TODAY (RAG 25.8: Problem Architecture)
// ============================================================
let s2 = pres.addSlide();
s2.background = { color: WHITE };

s2.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s2.addText("01", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s2.addText("PHP Group — Post-Merger Position", {
  x: 1.15, y: 0.3, w: 7, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

const stats = [
  { num: "1,142", label: "Properties", sub: "UK & Ireland healthcare estate" },
  { num: "£6bn", label: "Portfolio Value", sub: "Post-Assura merger (Aug 2025)" },
  { num: "99%", label: "Occupancy", sub: "GP surgeries, NHS, pharmacies" },
  { num: "£342m", label: "Rent Roll", sub: "10.8yr WAULT, inflation-linked" }
];

stats.forEach((s, i) => {
  const cx = 0.5 + i * 2.3;
  s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.1, h: 1.9, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.1, h: 0.06, fill: { color: BLUE } });
  s2.addText(s.num, { x: cx + 0.15, y: 1.4, w: 1.8, h: 0.65, fontSize: 28, fontFace: "Georgia", bold: true, color: NAVY, margin: 0 });
  s2.addText(s.label, { x: cx + 0.15, y: 2.0, w: 1.8, h: 0.4, fontSize: 12, fontFace: "Arial", bold: true, color: BLUE, margin: 0 });
  s2.addText(s.sub, { x: cx + 0.15, y: 2.35, w: 1.8, h: 0.55, fontSize: 9, fontFace: "Arial", color: GREY, margin: 0 });
});

s2.addText("The FM Insource Challenge", {
  x: 0.5, y: 3.5, w: 4, h: 0.4,
  fontSize: 16, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

// RAG 25.8: Problem Architecture Before Solution
const challenges = [
  { title: "Post-Merger Systems Gap", desc: "Two legacy estates, different CAFM systems, contractor databases, compliance tracking. No unified FM platform exists." },
  { title: "1,142-Property Compliance Risk", desc: "Fire safety, legionella, EICR, gas safety, asbestos — healthcare buildings where failure impacts NHS patient care directly." },
  { title: "No Visible FM Tech Stack", desc: "178-page Annual Report references IT only for cyber security. No CAFM, IWMS, or FM technology at board level." },
  { title: "Key-Person Dependency", desc: "Yasmin leading the insource while running day-to-day FM. Institutional knowledge lives in one person, not in systems." }
];

challenges.forEach((c, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const cx = 0.5 + col * 4.6;
  const cy = 4.05 + row * 0.75;
  s2.addShape(pres.shapes.OVAL, { x: cx, y: cy + 0.08, w: 0.12, h: 0.12, fill: { color: RED } });
  s2.addText([
    { text: c.title + "  ", options: { bold: true, color: NAVY, fontSize: 10 } },
    { text: c.desc, options: { color: GREY, fontSize: 9 } }
  ], { x: cx + 0.22, y: cy, w: 4.2, h: 0.65, fontFace: "Arial", valign: "top", margin: 0 });
});

// RAG 25.8: Cost of gaps callout
s2.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.15, w: 9, h: 0.32, fill: { color: "FFF3CD" } });
s2.addText("The cost of these gaps is not theoretical — a missed fire certificate in an NHS building is a patient safety incident, not a maintenance issue.", {
  x: 0.65, y: 5.15, w: 8.7, h: 0.32,
  fontSize: 9.5, fontFace: "Arial", italic: true, color: NAVY, valign: "middle", margin: 0
});


// ============================================================
// SLIDE 3: PROTOCOL VS PROBABILITY (RAG 27.5, 27.6, 25.3)
// ============================================================
let s3 = pres.addSlide();
s3.background = { color: NAVY };

s3.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: RED } });
s3.addText("02", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s3.addText("Protocol vs Probability", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: WHITE, margin: 0
});

// Comparison table (RAG 27.5)
const tableRows = [
  ["", "Standard AI / LLMs", "The XO Executive"],
  ["Foundation", "Probability-based\n(statistical guessing)", "Protocol-based\n(codified domain rules)"],
  ["Engagement", "Passive \"Pull Model\"\n(waits for a prompt)", "Active \"Command Loop\"\n(24/7 scanning)"],
  ["Identity", "Conversational Assistant", "Sovereign Decision Engine"],
  ["Output", "High liability,\nprone to hallucinations", "Pre-compliant,\nevidence-bound"]
];

s3.addTable(tableRows, {
  x: 0.5, y: 1.05, w: 9, h: 2.8,
  fontSize: 10, fontFace: "Arial", color: NEAR_WHITE,
  colW: [1.8, 3.6, 3.6],
  border: { pt: 0.5, color: "334466" },
  rowH: [0.4, 0.6, 0.6, 0.5, 0.6],
  autoPage: false,
  align: "left",
  valign: "middle"
});

s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.05, w: 9, h: 0.4, fill: { color: BLUE } });
s3.addText("", { x: 0.5, y: 1.05, w: 1.8, h: 0.4, margin: 0 });
s3.addText("Standard AI / LLMs", { x: 2.3, y: 1.05, w: 3.6, h: 0.4, fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
s3.addText("The XO Executive", { x: 5.9, y: 1.05, w: 3.6, h: 0.4, fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

// Healthcare-specific Constitutional Safety callout (RAG 27.6 + 25.3)
s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.1, w: 9, h: 1.3, fill: { color: CARD_BG } });
s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.1, w: 0.07, h: 1.3, fill: { color: RED } });

s3.addText("Constitutional Safety — Why This Matters for NHS Properties", {
  x: 0.8, y: 4.15, w: 8.5, h: 0.35,
  fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, margin: 0
});

s3.addText("You cannot run compliance across 1,142 NHS buildings on probability. Designed by Dr. Mabrouka Abuhmida, the Two-Brain architecture ensures every output is compliant before it reaches the operator. Hard limits, not advisory constraints. Every action traceable to a specific rule, precedent, and evidence chain. The audit trail IS the deliverable.", {
  x: 0.8, y: 4.5, w: 8.5, h: 0.8,
  fontSize: 9, fontFace: "Arial", color: "B0BEC5", valign: "top", margin: 0
});

// RAG 27.5: Positioning line
s3.addText("Every other AI product guesses. We follow your rules.", {
  x: 0.5, y: 5.5, w: 9, h: 0.25,
  fontSize: 11, fontFace: "Arial", italic: true, color: RED, align: "center", margin: 0
});


// ============================================================
// SLIDE 4: THE OODA COMMAND LOOP (RAG 24.9: L1-L4 maturity)
// ============================================================
let s4 = pres.addSlide();
s4.background = { color: WHITE };

s4.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s4.addText("03", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s4.addText("The XO Command Loop for PHP FM", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

const ooda = [
  { phase: "OBSERVE", color: BLUE, desc: "24/7 sentinel — compliance certificates, work orders, contractor records, EPC ratings, tenant service logs across 1,142 properties. Data gated by risk classification." },
  { phase: "ORIENT", color: NAVY, desc: "Mandatory decomposition — contextualises against healthcare FM rules: fire safety, legionella, EICR, CQC standards. Risks explicitly enumerated." },
  { phase: "DECIDE", color: RED, desc: "Executive framing — ranks by severity. Compliance expiry escalated immediately. Cost anomalies flagged. Post-governance validation." },
  { phase: "ACT", color: GREEN, desc: "Bounded execution — contractor dispatch, certificate collection, tenant updates. Yasmin authorises; system executes. Full audit trail." }
];

ooda.forEach((o, i) => {
  const cy = 1.2 + i * 0.95;
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 9, h: 0.85, fill: { color: LIGHT_BG }, shadow: makeCardShadow() });
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 0.07, h: 0.85, fill: { color: o.color } });
  s4.addText(o.phase, { x: 0.8, y: cy + 0.08, w: 1.4, h: 0.35, fontSize: 16, fontFace: "Georgia", bold: true, color: o.color, margin: 0 });
  s4.addText(o.desc, { x: 0.8, y: cy + 0.42, w: 8.5, h: 0.42, fontSize: 9, fontFace: "Arial", color: GREY, margin: 0 });
});

// RAG 24.9: L1-L4 maturity scale
s4.addText("Maturity Scale:", {
  x: 0.5, y: 5.0, w: 9, h: 0.25,
  fontSize: 11, fontFace: "Arial", bold: true, color: NAVY, margin: 0
});

s4.addText("L1: Monitor  →  L2: Recommend  →  L3: Bounded Autonomy  →  L4: Full Autonomous Operation", {
  x: 0.5, y: 5.3, w: 9, h: 0.25,
  fontSize: 9.5, fontFace: "Arial", color: BLUE, margin: 0
});

s4.addText("PHP FM starts at L1 across 20-30 pilot properties. Expand as confidence builds.", {
  x: 0.5, y: 5.6, w: 9, h: 0.22,
  fontSize: 8.5, fontFace: "Arial", italic: true, color: GREY, margin: 0
});


// ============================================================
// SLIDE 5: WORKFLOWS (RAG 27.2, 25.3)
// ============================================================
let s5 = pres.addSlide();
s5.background = { color: NAVY };

s5.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: RED } });
s5.addText("04", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s5.addText("Workflows That Encode FM Protocol", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 24, fontFace: "Georgia", bold: true, color: WHITE, margin: 0
});

// RAG-enhanced workflows
const workflows = [
  { title: "Reactive Maintenance Lifecycle", desc: "QR code submission. Auto-categorised, patient-care-impact flagged. Threshold routing: <£500 auto, £500-£5K regional, >£5K Yasmin.", accent: BLUE },
  { title: "Compliance Certificate Renewal", desc: "90/60/30-day alerts for fire, legionella, EICR, gas, asbestos across 1,142 properties. The audit trail IS the deliverable.", accent: RED },
  { title: "Contractor Onboarding & SLAs", desc: "Insurance, accreditations, framework agreements. Response time, first-fix rate, cost-per-work-order by trade and region.", accent: GREEN },
  { title: "Tenant Service Portal", desc: "Every GP practice gets a consistent channel. QR code, auto-routing, post-completion satisfaction surveys.", accent: BLUE },
  { title: "ESG Data Collection", desc: "AI-powered utility data extraction from 1,142 tenants. Outlier detection. GRESB and EPRA sBPR submission-ready.", accent: RED },
  { title: "Portfolio Health Dashboard", desc: "Compliance RAG status, work order volumes, contractor league table, cost by region, Assura integration report.", accent: GREEN }
];

workflows.forEach((w, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const cx = 0.5 + col * 4.7;
  const cy = 1.1 + row * 1.45;

  s5.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 4.4, h: 1.25, fill: { color: CARD_BG }, shadow: makeCardShadow() });
  s5.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 4.4, h: 0.05, fill: { color: w.accent } });
  s5.addText(w.title, { x: cx + 0.2, y: cy + 0.15, w: 4.0, h: 0.35, fontSize: 13, fontFace: "Arial", bold: true, color: WHITE, margin: 0 });
  s5.addText(w.desc, { x: cx + 0.2, y: cy + 0.5, w: 4.0, h: 0.65, fontSize: 9.5, fontFace: "Arial", color: "B0BEC5", valign: "top", margin: 0 });
});


// ============================================================
// SLIDE 6: BEFORE/AFTER (RAG 27.8)
// ============================================================
let s6 = pres.addSlide();
s6.background = { color: WHITE };

s6.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s6.addText("05", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s6.addText("From System of Record to System of Action", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.1, w: 4.3, h: 0.45, fill: { color: GREY } });
s6.addText("SYSTEM OF RECORD", { x: 0.5, y: 1.1, w: 4.3, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s6.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.1, w: 4.3, h: 0.45, fill: { color: BLUE } });
s6.addText("SYSTEM OF ACTION", { x: 5.2, y: 1.1, w: 4.3, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

const comparisons = [
  { before: "Two legacy FM estates with fragmented systems", after: "Unified property register from day one" },
  { before: "Compliance certificates tracked in spreadsheets", after: "90/60/30-day alerts, zero missed inspections" },
  { before: "Tenants report issues by phone and email", after: "Digital portal with QR, auto-routing, live updates" },
  { before: "Contractor performance unknown at portfolio level", after: "SLA tracking, cost benchmarking, league tables" },
  { before: "ESG data collected manually from 1,142 tenants", after: "AI extraction with outlier detection, audit-ready" },
  { before: "Yasmin personally tracks everything", after: "Exception-only escalation, protocol handles routine" }
];

comparisons.forEach((c, i) => {
  const cy = 1.7 + i * 0.55;
  const bgColor = i % 2 === 0 ? LIGHT_BG : WHITE;
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 4.3, h: 0.48, fill: { color: bgColor } });
  s6.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: cy, w: 4.3, h: 0.48, fill: { color: bgColor } });
  s6.addText(c.before, { x: 0.65, y: cy, w: 4.0, h: 0.48, fontSize: 9.5, fontFace: "Arial", color: GREY, valign: "middle", margin: 0 });
  s6.addText(c.after, { x: 5.35, y: cy, w: 4.0, h: 0.48, fontSize: 9.5, fontFace: "Arial", color: NAVY, bold: true, valign: "middle", margin: 0 });
});

s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.8, w: 9, h: 0.45, fill: { color: NAVY } });
s6.addText("Supports EPRA cost ratio target of <10% by automating FM operations at scale", {
  x: 0.5, y: 4.8, w: 9, h: 0.45,
  fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0
});

// RAG 27.8: Data-agnostic architecture note
s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.35, w: 9, h: 0.28, fill: { color: "F0F0F0" } });
s6.addText("XO sits on top of existing systems — zero rip-and-replace. Data-agnostic architecture.", {
  x: 0.65, y: 5.35, w: 8.7, h: 0.28,
  fontSize: 8.5, fontFace: "Arial", italic: true, color: GREY, valign: "middle", margin: 0
});


// ============================================================
// SLIDE 7: 21-DAY PROOF OF CONCEPT (RAG 24.5-24.8)
// ============================================================
let s7 = pres.addSlide();
s7.background = { color: LIGHT_BG };

s7.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s7.addText("06", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s7.addText("21-Day Proof of Concept", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

// RAG 24.6-24.8: Enhanced phases with Knowledge Abstraction and parallel run
const phases = [
  {
    week: "WEEK 1", title: "Capture & Quick Wins", color: BLUE,
    items: [
      "90-min Knowledge Abstraction Session — extract Yasmin's exception taxonomy, resolution procedures, authority matrix, contractor rules",
      "Unified property register: all 1,142 assets from both legacy estates",
      "Reactive maintenance pilot for 20-30 properties",
      "Compliance monitoring: 90/60/30-day expiry alerts"
    ]
  },
  {
    week: "WEEK 2", title: "Prototype & Validate", color: NAVY,
    items: [
      "XO shadows live FM operations — parallel run alongside current process",
      "Full work order lifecycle: dispatch, completion, invoice matching",
      "Compliance renewal workflow with contractor dispatch",
      "Expand to 100+ properties with contractor benchmarks"
    ]
  },
  {
    week: "WEEK 3", title: "Deploy & Decide", color: RED,
    items: [
      "Portfolio dashboard: compliance RAG, work orders, contractor league table",
      "ESG data collection workflow for GRESB submission",
      "Evidence-based CAFM specification from 21 days of live data",
      "Business case for full 1,142-property rollout"
    ]
  }
];

phases.forEach((p, i) => {
  const cx = 0.5 + i * 3.15;
  s7.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.1, w: 2.95, h: 4.2, fill: { color: WHITE }, shadow: makeShadow() });
  s7.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.1, w: 2.95, h: 0.7, fill: { color: p.color } });
  s7.addText(p.week, { x: cx + 0.15, y: 1.15, w: 2.65, h: 0.3, fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, margin: 0, transparency: 20 });
  s7.addText(p.title, { x: cx + 0.15, y: 1.42, w: 2.65, h: 0.3, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, margin: 0 });

  p.items.forEach((item, j) => {
    const iy = 2.0 + j * 0.8;
    s7.addShape(pres.shapes.OVAL, { x: cx + 0.15, y: iy + 0.05, w: 0.1, h: 0.1, fill: { color: p.color } });
    s7.addText(item, { x: cx + 0.35, y: iy - 0.05, w: 2.4, h: 0.7, fontSize: 8.5, fontFace: "Arial", color: NAVY, valign: "top", margin: 0 });
  });
});

// RAG 24.8: Footer note
s7.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.4, w: 9, h: 0.25, fill: { color: "FFE8E8" } });
s7.addText("Weeks 1-2 are discovery. Commercial engagement begins at prototype sign-off.", {
  x: 0.65, y: 5.4, w: 8.7, h: 0.25,
  fontSize: 8, fontFace: "Arial", italic: true, color: RED, valign: "middle", margin: 0
});


// ============================================================
// SLIDE 8: NEXT STEPS (RAG 3.4)
// ============================================================
let s8 = pres.addSlide();
s8.background = { color: NAVY };

s8.addShape(pres.shapes.RECTANGLE, { x: 0, y: 3.5, w: 3.5, h: 2.2, fill: { color: BLUE, transparency: 85 } });
s8.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.5, w: 2.2, h: 1.2, fill: { color: RED, transparency: 85 } });

s8.addText([
  { text: "Intellagentic", options: { bold: true, color: WHITE, fontSize: 16 } },
  { text: "XO", options: { bold: true, color: RED, fontSize: 16 } }
], { x: 0.7, y: 0.5, w: 4, h: 0.5, margin: 0 });

s8.addText("Next Steps", {
  x: 0.7, y: 1.3, w: 8, h: 0.7,
  fontSize: 36, fontFace: "Georgia", bold: true, color: WHITE, margin: 0
});

s8.addShape(pres.shapes.LINE, { x: 0.7, y: 2.1, w: 2.5, h: 0, line: { color: RED, width: 3 } });

const nextSteps = [
  { num: "1", text: "90-minute Knowledge Abstraction Session — encode FM systems, processes, insource scope" },
  { num: "2", text: "Week 1 quick win — reactive maintenance workflow live for 20-30 properties" },
  { num: "3", text: "21-day pilot — portfolio dashboard with compliance, work orders, contractor data" }
];

nextSteps.forEach((ns, i) => {
  const cy = 2.5 + i * 0.7;
  s8.addShape(pres.shapes.OVAL, { x: 0.7, y: cy, w: 0.4, h: 0.4, fill: { color: RED } });
  s8.addText(ns.num, { x: 0.7, y: cy, w: 0.4, h: 0.4, fontSize: 14, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s8.addText(ns.text, { x: 1.3, y: cy, w: 7.5, h: 0.4, fontSize: 13, fontFace: "Arial", color: NEAR_WHITE, valign: "middle", margin: 0 });
});

s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.5, w: 8.6, h: 0.65, fill: { color: CARD_BG } });
s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.5, w: 0.07, h: 0.65, fill: { color: GREEN } });
s8.addText([
  { text: "Success Metric: ", options: { bold: true, color: GREEN, fontSize: 11 } },
  { text: "FM systems integration operates without manual intervention. Institutional knowledge encoded into protocol, not people.", options: { color: NEAR_WHITE, fontSize: 11 } }
], { x: 1.0, y: 4.5, w: 8.1, h: 0.65, fontFace: "Arial", valign: "middle", margin: 0 });

// RAG 3.4: Pricing model callout
s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 5.25, w: 8.6, h: 0.28, fill: { color: "E8F4F8" } });
s8.addText("XO is priced against the cost of the problem, not the cost of the technology.", {
  x: 0.85, y: 5.25, w: 8.3, h: 0.28,
  fontSize: 9, fontFace: "Arial", italic: true, color: BLUE, valign: "middle", margin: 0
});

s8.addText("alan.moore@intellagentic.io", {
  x: 0.7, y: 5.65, w: 5, h: 0.3,
  fontSize: 10, fontFace: "Arial", color: "B0BEC5", margin: 0
});
