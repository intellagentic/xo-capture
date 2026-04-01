const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "IntellagenticXO";
pres.title = "The Pine Fund — XO Growth Platform";

// Brand colours (no #)
const NAVY = "1B2A4A";
const BLUE = "2E75B6";
const RED = "C0392B";
const WHITE = "FFFFFF";
const LIGHT_BG = "EDF2F8";
const GREY = "555555";
const DARK_BG = "0F1419";
const CARD_BG = "1A2030";
const NEAR_WHITE = "F0F4F8";
const GREEN = "27AE60";

const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.18 });
const makeCardShadow = () => ({ type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.25 });

// ============================================================
// SLIDE 1: TITLE — Briefing-led framing (from xo-writing: "never pitch, brief")
// ============================================================
let s1 = pres.addSlide();
s1.background = { color: NAVY };

s1.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 0, w: 3.5, h: 2.2, fill: { color: BLUE, transparency: 85 } });
s1.addShape(pres.shapes.RECTANGLE, { x: 7.8, y: 0, w: 2.2, h: 1.2, fill: { color: RED, transparency: 85 } });

s1.addText([
  { text: "Intellagentic", options: { bold: true, color: WHITE, fontSize: 16 } },
  { text: "XO", options: { bold: true, color: RED, fontSize: 16 } }
], { x: 0.7, y: 0.5, w: 4, h: 0.5, margin: 0 });

// Title — framed as briefing, not pitch
s1.addText("Operational Briefing:\nScaling The Pine Fund", {
  x: 0.7, y: 1.5, w: 8, h: 2.0,
  fontSize: 36, fontFace: "Georgia", bold: true, color: WHITE,
  lineSpacingMultiple: 1.15, valign: "top", margin: 0
});

s1.addShape(pres.shapes.LINE, { x: 0.7, y: 3.7, w: 2.5, h: 0, line: { color: RED, width: 3 } });

// Briefing-led positioning phrase (from xo-writing skill)
s1.addText("You are the domain experts. This is our take on status and next steps.", {
  x: 0.7, y: 3.95, w: 7, h: 0.4,
  fontSize: 12, fontFace: "Arial", italic: true, color: "B0BEC5", margin: 0
});

s1.addText("Prepared for Clinton Kramer  |  31 March 2026", {
  x: 0.7, y: 4.5, w: 6, h: 0.4,
  fontSize: 13, fontFace: "Arial", color: NEAR_WHITE, margin: 0
});

s1.addText("CONFIDENTIAL", {
  x: 0.7, y: 5.1, w: 3, h: 0.35,
  fontSize: 10, fontFace: "Arial", italic: true, color: GREY
});


// ============================================================
// SLIDE 2: WHERE PINE II STANDS TODAY — RAG 25.8 Enhancement
// ============================================================
let s2 = pres.addSlide();
s2.background = { color: WHITE };

s2.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s2.addText("01", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s2.addText("Where PINE II Stands Today", {
  x: 1.15, y: 0.3, w: 7, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

const stats = [
  { num: "£24.3M", label: "Equity Raised", sub: "Multiple allotments since 2021" },
  { num: "~£50M", label: "Target Portfolio", sub: "Including leverage facilities" },
  { num: "33", label: "PINE I Assets", sub: "Successfully exited to USS 2017" },
  { num: "20+ yrs", label: "Avg Lease Term", sub: "Inflation-linked rent reviews" }
];

stats.forEach((s, i) => {
  const cx = 0.5 + i * 2.3;
  s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.1, h: 1.9, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  s2.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.1, h: 0.06, fill: { color: BLUE } });
  s2.addText(s.num, { x: cx + 0.15, y: 1.4, w: 1.8, h: 0.65, fontSize: 28, fontFace: "Georgia", bold: true, color: NAVY, margin: 0 });
  s2.addText(s.label, { x: cx + 0.15, y: 2.0, w: 1.8, h: 0.4, fontSize: 12, fontFace: "Arial", bold: true, color: BLUE, margin: 0 });
  s2.addText(s.sub, { x: cx + 0.15, y: 2.35, w: 1.8, h: 0.55, fontSize: 9, fontFace: "Arial", color: GREY, margin: 0 });
});

// The Growth Challenge — RAG-informed: key-person dependency is the #1 pattern
s2.addText("The Growth Challenge", {
  x: 0.5, y: 3.5, w: 4, h: 0.4,
  fontSize: 16, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

const challenges = [
  { title: "Leadership Transition", desc: "Clinton moved to Special Projects (Aug 2024). 17+ years of sector relationships and underwriting criteria at risk of dissipating." },
  { title: "Operational Infrastructure Gap", desc: "Capital deployment accelerating but portfolio management relies on manual processes. Institutional knowledge lives in people, not systems." },
  { title: "Fragmented Entity Structure", desc: "Multiple SPVs each requiring separate filings, board minutes, and compliance. Remaining directors absorb this load." },
  { title: "No Systematic Monitoring", desc: "Tenant health, lease events, debt covenants, and deal pipeline tracked in spreadsheets and email inboxes." }
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

// NEW: RAG 25.8 Problem Architecture callout + RAG 3.4 pricing signal
s2.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.0, w: 9, h: 0.5, fill: { color: "FFF3CD" }, border: { pt: 1, color: RED } });
s2.addText("Problem Architecture Before Solution: The cost of these gaps compounds as the portfolio scales toward £50M", {
  x: 0.65, y: 5.0, w: 8.7, h: 0.5,
  fontSize: 10, fontFace: "Arial", italic: true, color: NAVY, valign: "middle", margin: 0
});


// ============================================================
// SLIDE 3: PROTOCOL VS PROBABILITY (from XO Orchestration Paradigm doc)
// ============================================================
let s3 = pres.addSlide();
s3.background = { color: NAVY };

s3.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: RED } });
s3.addText("02", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s3.addText("Protocol vs Probability", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: WHITE, margin: 0
});

// Comparison table — from the Aled briefing doc
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
  newSlideStartY: 0,
  align: "left",
  valign: "middle"
});

// Style header row manually by overlaying
s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.05, w: 9, h: 0.4, fill: { color: BLUE } });
s3.addText("", { x: 0.5, y: 1.05, w: 1.8, h: 0.4, fontSize: 10, fontFace: "Arial", bold: true, color: WHITE, margin: 0 });
s3.addText("Standard AI / LLMs", { x: 2.3, y: 1.05, w: 3.6, h: 0.4, fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
s3.addText([
  { text: "The XO", options: { bold: true, color: WHITE, fontSize: 11 } },
  { text: " Executive", options: { bold: true, color: WHITE, fontSize: 11 } }
], { x: 5.9, y: 1.05, w: 3.6, h: 0.4, align: "center", valign: "middle", margin: 0 });

// ENHANCED Constitutional Safety callout (RAG 27.6) with Dr. Mabrouka attribution
s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.0, w: 9, h: 1.3, fill: { color: CARD_BG } });
s3.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.0, w: 0.07, h: 1.3, fill: { color: RED } });

s3.addText([
  { text: "Constitutional Safety — Designed by Dr. Mabrouka Abuhmida", options: { bold: true, color: WHITE, fontSize: 12 } }
], { x: 0.8, y: 4.05, w: 8.5, h: 0.35, margin: 0 });

s3.addText("Brain 1 (Actor) generates the tactical plan. Brain 2 (Critic) evaluates every action against codified constitutional principles—hard limits, not advisory constraints. Every output traceable to a specific rule, precedent, and evidence chain.", {
  x: 0.8, y: 4.4, w: 8.5, h: 0.8,
  fontSize: 9.5, fontFace: "Arial", color: "B0BEC5", valign: "top", margin: 0
});

// NEW positioning line (RAG 27.5)
s3.addText("Every other AI product guesses. We follow your rules.", {
  x: 0.5, y: 5.35, w: 9, h: 0.3,
  fontSize: 10, fontFace: "Arial", italic: true, color: BLUE, margin: 0, align: "center"
});


// ============================================================
// SLIDE 4: THE OODA COMMAND LOOP with L1-L4 Maturity (RAG 24.9)
// ============================================================
let s4 = pres.addSlide();
s4.background = { color: WHITE };

s4.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s4.addText("03", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s4.addText("The XO Command Loop for PINE II", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

// OODA with precise language from the Orchestration Paradigm doc
const ooda = [
  { phase: "OBSERVE", color: BLUE, desc: "24/7 sentinel scanning — Companies House filings, Ofsted ratings, Land Registry, tenant accounts, TISE filings. Data gated by risk classification before cognition." },
  { phase: "ORIENT", color: NAVY, desc: "Mandatory decomposition — converts context into a decision space. Assumptions, options, and risks per option explicitly enumerated. No black-box outputs." },
  { phase: "DECIDE", color: RED, desc: "Executive framing — ranks actions, applies governance rules. Post-governance validation checks justification. Failures trigger automatic ESCALATE to operator." },
  { phase: "ACT", color: GREEN, desc: "Bounded execution via Streamline — prepares tactical workflow, presents to operator to authorise. System executes; human governs. Full audit trail logged." }
];

ooda.forEach((o, i) => {
  const cy = 1.2 + i * 0.95;
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 9, h: 0.85, fill: { color: LIGHT_BG }, shadow: makeCardShadow() });
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 0.07, h: 0.85, fill: { color: o.color } });
  s4.addText(o.phase, { x: 0.8, y: cy + 0.08, w: 1.4, h: 0.35, fontSize: 16, fontFace: "Georgia", bold: true, color: o.color, margin: 0 });
  s4.addText(o.desc, { x: 0.8, y: cy + 0.4, w: 8.5, h: 0.45, fontSize: 9, fontFace: "Arial", color: GREY, margin: 0 });
});

// NEW: RAG 24.9 — L1-L4 Maturity Scale
s4.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.9, w: 9, h: 0.8, fill: { color: LIGHT_BG }, border: { pt: 1, color: BLUE } });
s4.addText("Maturity Roadmap: L1 Monitor → L2 Recommend → L3 Bounded Autonomy → L4 Full Autonomous Operation", {
  x: 0.65, y: 4.95, w: 8.7, h: 0.35,
  fontSize: 10, fontFace: "Arial", bold: true, color: NAVY, margin: 0
});
s4.addText("PINE II starts at L1. You pull us forward as confidence builds.", {
  x: 0.65, y: 5.3, w: 8.7, h: 0.35,
  fontSize: 9, fontFace: "Arial", italic: true, color: GREY, margin: 0
});


// ============================================================
// SLIDE 5: WORKFLOWS — Enhanced with RAG specificity (RAG 27.5, 25.3)
// ============================================================
let s5 = pres.addSlide();
s5.background = { color: NAVY };

s5.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: RED } });
s5.addText("04", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s5.addText("Workflows That Encode Institutional Knowledge", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 24, fontFace: "Georgia", bold: true, color: WHITE, margin: 0
});

const workflows = [
  { title: "Deal Screening & IC Papers", desc: "Codifies PINE I's top-quartile underwriting criteria. Every opportunity scored deterministically—protocol, not probability. IC papers in minutes, not hours.", accent: BLUE },
  { title: "Tenant Health Alerts", desc: "Ofsted + Companies House monitored. 24hr alert on rating downgrade or >20% net asset decline. Compliance overlay pattern—the audit trail IS the deliverable.", accent: RED },
  { title: "Investor Reporting Packs", desc: "Auto-generated quarterly. Director review, sign-off, distribute. Reporting cycle from days to hours. Consistent, audit-ready output every quarter.", accent: GREEN },
  { title: "Entity Compliance Tracker", desc: "All PINE SPVs mapped with directors, filing dates, compliance status. 30/14/7-day deadline alerts. Zero missed filings across every entity.", accent: BLUE },
  { title: "Debt & Covenant Monitor", desc: "All charges tracked—incl. £11.6M TISE loan notes due 2029. LTV, interest cover, maturity profiles monitored. 18-month refinancing early warning.", accent: RED },
  { title: "Portfolio Health Dashboard", desc: "Single-pane board view: WAULT, yield, occupancy, rent roll, pipeline velocity. Board-ready for Hyman, Herd, Bailey, Peirs.", accent: GREEN }
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
// SLIDE 6: BEFORE/AFTER — XO-writing: specificity with RAG 3.8 Blue Ocean callout
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
  { before: "Deal criteria live in Clinton's head after 17+ years", after: "Codified into protocol — every deal scored the same way" },
  { before: "Tenant health checked when something goes wrong", after: "24hr alert on Ofsted downgrade or financial deterioration" },
  { before: "Quarterly reports take days to compile manually", after: "Auto-generated packs: review, sign, distribute in hours" },
  { before: "Entity filings tracked in personal calendars", after: "30/14/7-day automated alerts. Zero missed deadlines." },
  { before: "£11.6M loan notes due 2029 — no forward view", after: "18-month refinancing early warning with LTV tracking" },
  { before: "Board relies on verbal updates and emails", after: "Single dashboard: WAULT, yield, pipeline, compliance" }
];

comparisons.forEach((c, i) => {
  const cy = 1.7 + i * 0.53;
  const bgColor = i % 2 === 0 ? LIGHT_BG : WHITE;
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: cy, w: 4.3, h: 0.48, fill: { color: bgColor } });
  s6.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: cy, w: 4.3, h: 0.48, fill: { color: bgColor } });
  s6.addText(c.before, { x: 0.65, y: cy, w: 4.0, h: 0.48, fontSize: 9, fontFace: "Arial", color: GREY, valign: "middle", margin: 0 });
  s6.addText(c.after, { x: 5.35, y: cy, w: 4.0, h: 0.48, fontSize: 9, fontFace: "Arial", color: NAVY, bold: true, valign: "middle", margin: 0 });
});

s6.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.7, w: 9, h: 0.45, fill: { color: NAVY } });
s6.addText("Estimated 60–70% reduction in manual portfolio administration as the fund scales toward £50M", {
  x: 0.5, y: 4.7, w: 9, h: 0.45,
  fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0
});

// NEW: RAG 3.8 Blue Ocean note
s6.addText("XO sits on top of existing systems — zero rip-and-replace. Data-agnostic architecture.", {
  x: 0.5, y: 5.2, w: 9, h: 0.3,
  fontSize: 9, fontFace: "Arial", italic: true, color: BLUE, align: "center", margin: 0
});


// ============================================================
// SLIDE 7: 21-DAY PROOF OF CONCEPT — Enhanced with RAG 24.5-24.8 language
// ============================================================
let s7 = pres.addSlide();
s7.background = { color: LIGHT_BG };

s7.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fill: { color: NAVY } });
s7.addText("06", { x: 0.5, y: 0.35, w: 0.45, h: 0.45, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });

s7.addText("21-Day Proof of Concept", {
  x: 1.15, y: 0.3, w: 8, h: 0.55,
  fontSize: 26, fontFace: "Georgia", bold: true, color: NAVY, margin: 0
});

const phases = [
  {
    week: "WEEK 1", title: "Capture & Quick Wins", color: BLUE,
    items: [
      "Knowledge Abstraction—extract Clinton's exception taxonomy, resolution procedures, authority matrix into XO protocol",
      "Entity compliance tracker: directors, filings, deadlines",
      "Lease event calendar: rent reviews, break options, expiries",
      "Ofsted tenant health monitoring configured"
    ]
  },
  {
    week: "WEEK 2", title: "Prototype & Validate", color: NAVY,
    items: [
      "XO shadows live operations—parallel run alongside manual process",
      "Debt dashboard: £11.6M TISE notes, mortgage charges, LTV",
      "Investor reporting pack workflow: generate, review, sign, distribute",
      "Deal pipeline tracker with stage-gates"
    ]
  },
  {
    week: "WEEK 3", title: "Deploy & Decide", color: RED,
    items: [
      "Full portfolio dashboard deployed to PINE II board",
      "Catchment area monitoring with demographic data",
      "Sale-and-leaseback proposal generator",
      "Evidence-based business case for full deployment"
    ]
  }
];

phases.forEach((p, i) => {
  const cx = 0.5 + i * 3.15;
  s7.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.1, w: 2.95, h: 3.85, fill: { color: WHITE }, shadow: makeShadow() });
  s7.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.1, w: 2.95, h: 0.7, fill: { color: p.color } });
  s7.addText(p.week, { x: cx + 0.15, y: 1.15, w: 2.65, h: 0.3, fontSize: 11, fontFace: "Arial", bold: true, color: WHITE, margin: 0, transparency: 20 });
  s7.addText(p.title, { x: cx + 0.15, y: 1.42, w: 2.65, h: 0.3, fontSize: 12, fontFace: "Arial", bold: true, color: WHITE, margin: 0 });

  p.items.forEach((item, j) => {
    const iy = 2.0 + j * 0.75;
    s7.addShape(pres.shapes.OVAL, { x: cx + 0.15, y: iy + 0.05, w: 0.1, h: 0.1, fill: { color: p.color } });
    s7.addText(item, { x: cx + 0.35, y: iy - 0.05, w: 2.4, h: 0.7, fontSize: 8.5, fontFace: "Arial", color: NAVY, valign: "top", margin: 0 });
  });
});

// NEW: RAG 24.8 Paywall Strategy footer
s7.addText("Weeks 1–2 are discovery. Commercial engagement begins at prototype sign-off.", {
  x: 0.5, y: 5.15, w: 9, h: 0.3,
  fontSize: 9, fontFace: "Arial", italic: true, color: GREY, align: "center", margin: 0
});


// ============================================================
// SLIDE 8: NEXT STEPS — Enhanced with RAG 3.4 Pricing Strategy
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
  { num: "1", text: "Share portfolio data — lease schedules, tenant list, rent roll, entity structure" },
  { num: "2", text: "Week 1 quick win — entity compliance tracker live within 7 days" },
  { num: "3", text: "21-day pilot — full portfolio health dashboard deployed to the PINE II board" }
];

nextSteps.forEach((ns, i) => {
  const cy = 2.5 + i * 0.7;
  s8.addShape(pres.shapes.OVAL, { x: 0.7, y: cy, w: 0.4, h: 0.4, fill: { color: RED } });
  s8.addText(ns.num, { x: 0.7, y: cy, w: 0.4, h: 0.4, fontSize: 14, fontFace: "Arial", bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s8.addText(ns.text, { x: 1.3, y: cy, w: 7.5, h: 0.4, fontSize: 13, fontFace: "Arial", color: NEAR_WHITE, valign: "middle", margin: 0 });
});

// Success metric + pricing signal (from brand guide: £5K onboarding, £2K/mo)
s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.5, w: 8.6, h: 0.65, fill: { color: CARD_BG } });
s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.5, w: 0.07, h: 0.65, fill: { color: GREEN } });
s8.addText([
  { text: "Success Metric: ", options: { bold: true, color: GREEN, fontSize: 11 } },
  { text: "Key-person dependency resolved without manual intervention. Institutional knowledge encoded into protocol, not people.", options: { color: NEAR_WHITE, fontSize: 11 } }
], { x: 1.0, y: 4.5, w: 8.1, h: 0.65, fontFace: "Arial", valign: "middle", margin: 0 });

// NEW: RAG 3.4 Pricing Strategy
s8.addText([
  { text: "XO is priced against the cost of the problem, ", options: { italic: true, color: "B0BEC5", fontSize: 9 } },
  { text: "not the cost of the technology.", options: { italic: true, color: RED, fontSize: 9 } }
], {
  x: 0.7, y: 5.2, w: 8.6, h: 0.25,
  fontFace: "Arial", margin: 0
});

s8.addText("alan.moore@intellagentic.io", {
  x: 0.7, y: 5.5, w: 5, h: 0.3,
  fontSize: 10, fontFace: "Arial", color: "B0BEC5", margin: 0
});
