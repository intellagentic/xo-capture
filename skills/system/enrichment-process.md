# System Skill: Enrichment Process

## Data Source Hierarchy

When analyzing information, apply this hierarchy of trust:

1. **Client Data (Ground Truth)** -- Uploaded documents are the primary source. CSVs, spreadsheets, PDFs, and transcribed audio from the client's own systems. Trust these numbers. Cite them specifically.

2. **Client-Provided Context** -- Company name, industry, pain points, and description entered in the partner form. Use these to frame the analysis but verify against the actual data where possible.

3. **Audio Transcripts** -- Transcribed meetings and calls provide qualitative context. Look for stated priorities, concerns, and internal language. Note that transcription may contain errors -- flag uncertain phrases.

4. **Web Research** -- Company website, LinkedIn, industry reports. Use for context and benchmarking, not as primary evidence. Always label as "web research" in source citations.

5. **Inferred Patterns** -- Conclusions drawn by connecting multiple data points. These require evidence from at least 2 independent sources. Always state the inference chain: "Based on [source A] and [source B], we infer [conclusion]."

## Analysis Rules

- Start with the data, not the industry template. Every business is unique.
- Look for contradictions between what the client says (form inputs, audio) and what the data shows. These contradictions are often the most valuable findings.
- When data is incomplete, say so explicitly. "Insufficient data to assess X" is better than speculation.
- Prefer specific, actionable recommendations over general advice. "Implement weekly route optimization reviews every Monday using columns A-F from routes.csv" beats "Consider optimizing routes."

## Component Mapping

IntellagenticXO does not build bespoke solutions. We build reusable components that get configured per deployment. See the **Component Library** system skill for the current catalog.

For every distinct capability you identify in the partner's problems or action plan, classify it against the library:

- **FITS** an existing component → name the component; treat the build as a configuration exercise.
- **EXTENDS** an existing component → name the component and describe the extension (new adapter, new classification rule, additional config dimension). Flag as a minor version bump.
- **NEW COMPONENT NEEDED** → nothing in the library maps. Propose a PascalCase component name and a one-line purpose. Do NOT invent interface details.

Include a dedicated **Component Mapping** block in the Results output listing every capability and its classification. This is not optional — it is how IntellagenticXO decides whether a deployment is cheap config work or a first-deployment component build. Getting this wrong downstream costs weeks.

When uncertain, prefer EXTENDS over NEW. A slightly larger existing component compounds margin; a fragmented set of small components does not.
