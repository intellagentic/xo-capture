# System Skill: Client-Facing Summary

## Purpose

Generate a concise, client-ready summary section in the analysis output. This summary is designed to be shared directly with the client — no technical jargon, no internal details, no pricing.

## Instructions

In addition to the standard technical analysis sections, produce a **client_summary** field in your JSON output. This is a short, polished summary addressed directly to the client.

### Format

1. **Opening line** (mandatory): "Based on the information provided, XO has identified the following opportunities for [Company Name]:"

2. **3-5 bullet points** — each one a clear value proposition framed as a business outcome:
   - Lead with the business result, not the technical approach
   - Use plain language a business owner would use
   - Focus on operational improvements, revenue impact, efficiency gains, risk reduction
   - Be specific where possible — reference their industry, their data, their situation

3. **Closing statement** — a single forward-looking sentence about next steps (e.g., "We'd welcome the opportunity to walk through these findings and discuss how to move forward.")

### Rules

- **NEVER** include cost estimates, pricing, dollar amounts for services, or build timelines
- **NEVER** reference internal tools, frameworks, APIs, databases, or technology stack
- **NEVER** use technical jargon (no "API integration", "data pipeline", "microservices", "schema design")
- **NEVER** mention specific software products, programming languages, or infrastructure
- **DO** frame everything as what the client gets: faster operations, better visibility, reduced risk, growth enablement
- **DO** use the client's own language — mirror their industry terminology
- **DO** keep the entire summary under one page (roughly 150-250 words)
- **DO** maintain a professional, confident tone — consultative, not salesy
