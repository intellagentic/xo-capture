# System Skill: Component Library

_Auto-generated from `01_Components/*/README.md` in the IntellagenticXO Drive workspace._
_Last refreshed: 2026-04-15_
_Do not hand-edit — regenerate with `python3 ~/dev/workspace-check/gen_component_library.py`._

## Purpose

You have access to a library of reusable components that IntellagenticXO has already built or is actively building. When analyzing a partner's documents and requirements, your first job is to check every capability the partner describes against this library.

## Mapping rule

For each distinct capability the partner needs, classify it based on whether the component exists in this library:

1. **[EXISTING]** — Component entry exists in the library AND is `v1_shipped` AND this deployment uses it as-is with no changes. Deployment is a configuration exercise.
2. **[EXTEND]** — Component entry exists in the library (any status: `spec`, `in_build`, or `v1_shipped`) AND this deployment builds against it -- drives v1 build, adds a carrier, adds a capability, extends an interface. Spec-phase components in the library are always [EXTEND], never [NEW].
3. **[NEW]** — NO entry exists in the library. The component must be proposed, named, and scaffolded from scratch. Only [NEW] components can be deferred to Phase 2.

**The key distinction:** `[NEW]` means "no library scaffolding exists." `[EXTEND]` means "library entry exists; this deployment builds against it." A component in `spec` phase has a library entry with a README, interface sketches, and deployment context -- it is [EXTEND], not [NEW].

**Tag lookup rule:**
- Component name found in the library below → `[EXISTING]` (if shipped and deploying as-is) or `[EXTEND]` (if any work needed, regardless of component status)
- Component name NOT found below → `[NEW]` (propose a PascalCase name and one-line purpose)

**Tag format:** Use exactly `[EXISTING]`, `[EXTEND]`, or `[NEW]`. These are verbatim literals. No variants: no `[EXTENDS]`, `[FITS]`, `[EXISTS]`, `[EXTENDED]`, `[EXISTING - v1]`, `[EXISTING/EXTEND]`, `[NEW COMPONENT]`. Three tags, three strings, no exceptions.

Always state which of the three applies, name the component (if any), and explain the mapping. When a new component is needed, propose a name and a one-line purpose.

## Streamline convention

Streamline is a **platform layer**, not a component. It provides workflow orchestration that components plug into. In the architecture diagram:

- Streamline appears as a **layer label** (e.g., "Streamline Workflow Layer"), not as a tagged component box.
- Individual workflows inside the Streamline layer (e.g., "Exception Triage Workflow", "Invoice Reconciliation Workflow") are **configured, not built**. They do NOT carry `[NEW]` tags.
- Only tag a Streamline box with `[EXISTING]` if the diagram explicitly names "Streamline" as a standalone integration point. Never tag it `[NEW]`.
- If a capability requires a new Streamline workflow, classify the **component that feeds the workflow** (e.g., ExceptionEngine `[EXTEND]`), not the workflow itself.

## Output expectation

In the `component_mapping` JSON field, classify every capability and populate `summary_line`. In the `architecture_diagram` ASCII output, tag each named component box with `[EXISTING]`, `[EXTEND]`, or `[NEW]`. Do NOT include a summary caption inside the `architecture_diagram` field — the caption is appended programmatically from `component_mapping.summary_line`.

In the Results section, include a **Component Mapping** block that lists every capability identified and its classification. This is as important as the Problems and Action Plan blocks — it's how IntellagenticXO decides whether a deployment is mostly configuration (cheap, fast) or requires new component work (slower, first-deployment-funds-build).

## The library

### CarrierGate

Unified multi-carrier API abstraction. Normalises rate quoting, label generation, tracking events, and manifesting across every supported carrier behind a single interface.

**Why it exists**

Every logistics operator we work with deals with the same problem: 5+ carrier APIs, each with different auth, different schemas, different rate limits, different deprecation timelines. CarrierGate is the layer that makes the rest of our stack carrier-agnostic.

**Status:** `spec`

**v1 — spec phase.** Spec inputs:
- [Origin scan (InXpress feasibility)](spec/v1_origin_scan.docx)
- [Aggregator vs direct analysis](spec/Aggregator_vs_Direct.md)
- Per-carrier reference: [00_Knowledge/Carriers/_INDEX.md](../../00_Knowledge/Carriers/_INDEX.md)

**Carriers covered (v1 target)**

Tier 1 (build-now): DHL Express, DHL eCommerce, DHL Parcel UK, FedEx, UPS, Royal Mail v3
Tier 2 (phase 2): DPD, Aramex, Yodel
Legacy / consolidating: TNT (under FedEx), Parcelforce (decommissioned → Royal Mail v3)

**Interface contract (sketch)**

- `rate(shipment) → quote[]`
- `label(shipment, service) → label`
- `track(tracking_number) → events[]`
- `manifest(shipments[]) → manifest`
- `pickup(window) → confirmation`

All inputs/outputs normalised; carrier-specific quirks handled in adapters.

**Hard dates affecting v1**

- **1 June 2026** — FedEx legacy SOAP sunset (forces v1 to be REST/OAuth2 native)
- **31 Dec 2025** — Parcelforce standalone API decommissioned (already gone; route via Royal Mail v3)

**First deployment**

[InXpress_POC](../../02_Prospects/InXpress/Deployments/InXpress_POC/) — Canterbury franchise, Julian Ford (prospect, pre-signing). Drives v1 carrier coverage priorities.

### ExceptionEngine

Daily shipment exception detection + CS triage dashboard. Sits on top of CarrierGate. Pulls all active shipments at start of day, classifies each (On Track / Delayed / Exception / Delivered), and produces a prioritised triage view for customer service.

**Why it exists**

Logistics operators discover exceptions by manually checking carrier portals one parcel at a time. By the time CS arrives at 09:00, a delay has been brewing for hours. ExceptionEngine inverts the model: machine watches overnight, humans triage exceptions instead of hunting for them.

**Status:** `spec`

**v1 — spec phase.** Spec input:
- [Origin spec (InXpress prototype)](spec/v1_origin_spec.md) — XO Capture output

**Core capabilities (v1)**

- 06:00 daily data pull via CarrierGate (or scrape/Aftership for clients without API access)
- Normalised `tracking_events` schema, carrier-agnostic
- Classification rules engine: On Track / Delayed / Exception / Delivered / Customs Hold
- Severity scoring: HIGH / MEDIUM / LOW
- Exception dashboard with suggested resolution per case
- Optional: customer-facing status dashboard
- Audit log with confidence scores + human override tracking

**Dependencies**

- **CarrierGate** for carrier data ingestion (or scrape adapter for clients without API access)
- PostgreSQL for shipments/events/exceptions/audit storage

**First deployment**

[InXpress_POC](../../02_Prospects/InXpress/Deployments/InXpress_POC/) — Canterbury franchise, 100–150 parcels/day (prospect, pre-signing).

---

## What to do when the library is incomplete

If the partner describes a capability that doesn't map cleanly to any component above:

- Name the gap explicitly in your Component Mapping block.
- Propose a component name (PascalCase, noun-phrase) and a one-line purpose.
- Do NOT invent interface details or claim the component exists.
- Flag it as `NEW COMPONENT NEEDED` so IntellagenticXO can scaffold it in `01_Components/` and treat this deployment as its v1 build funder.

## Ingestion path decision rule

When classifying a data source, decide between Streamline and an XO component:

- **Streamline connector** — use when the source has a first-class Streamline integration: Salesforce, Redox, Postgres, MySQL, mainstream SaaS with documented connectors. Ingestion is a Streamline workflow configuration, NOT a new component. Do not tag as [NEW] or [EXTEND].
- **XO component** — use when the source is an edge case: scraped portals, custom aggregators, non-standard APIs, carrier-specific or domain-specific dialects. Build or extend an XO component. Tag [NEW] or [EXTEND] per the existing status rule.

Division of responsibility:
- Streamline owns transport, standard connectors, PII classification at ingress, and transient workflow execution.
- XO components own persistent state, domain normalisation, and multi-day/historical logic.
- Even when Streamline ingests, persistent data belongs in an XO component's store. Streamline holds data only during workflow execution.

For each data source in the client analysis, ask: "Does Streamline have a first-class connector for this?" If yes, ingestion is Streamline config. If no, it's an XO component.
