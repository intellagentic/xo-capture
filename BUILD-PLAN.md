# XO Rapid Prototype -- Build Plan

Date: February 28, 2026

## Three Screens

1. Upload -- partner drops in documents (CSV, Excel, PDF). Company name, brief description.
2. Enrich -- one button. System sends data to Claude for analysis, enriches with web research. Real-time progress.
3. Results -- AI-generated output: problems identified, proposed data schema, action plan. The First Party Trick.

## Build -- 2 Days

### Track 1: Frontend

| Step | What | Hours |
|------|------|-------|
| 1 | Create clean repo. Copy Vite config, modal system, CSS tokens from ./reference/. Rebrand. | 1-2 |
| 2 | Upload screen: drag-and-drop file zone, company name field, description textarea. Files go to S3 via presigned URL. | 2-3 |
| 3 | Enrich button + progress screen. Fires Lambda that calls Claude API. Show real-time status. | 2-3 |
| 4 | Results screen. Renders AI output: analysis summary, problems, proposed schema, plan. Card-based, expandable. | 3-4 |
| 5 | Deploy to S3 + CloudFront. Test end-to-end. | 1 |

### Track 2: Backend

| Step | What | Hours |
|------|------|-------|
| 1 | Lambda: /clients. Creates folder in S3 for the partner. Returns client_id. | 1 |
| 2 | Lambda: /upload. Presigned URLs for client S3 folder. Text extraction from PDFs/Excel/CSV. | 2 |
| 3 | Lambda: /enrich. Reads extracted text, calls Claude API, runs web enrichment. Writes results to S3. | 3-4 |
| 4 | Claude prompt: First Party Trick. MBA-level analysis, identify problems, propose schema, action plan. | 2-3 |
| 5 | Lambda: /results. Reads from client results folder. Returns structured JSON. | 1 |

## API Contract

POST /clients          { company_name, description } -> { client_id }
POST /upload           { client_id, files: [{ name, type }] } -> { upload_urls: [...] }
POST /enrich           { client_id } -> { job_id, status: 'processing' }
GET  /results/:id      -> { status, summary, problems, schema, plan, sources }

## Results JSON Shape

{
  "status": "complete",
  "summary": "executive summary of findings",
  "problems": [
    { "title": "", "severity": "high|medium|low", "evidence": "", "recommendation": "" }
  ],
  "schema": {
    "tables": [
      { "name": "", "purpose": "", "columns": [{ "name": "", "type": "", "description": "" }] }
    ],
    "relationships": []
  },
  "plan": [
    { "phase": "30-day|60-day|90-day", "actions": [] }
  ],
  "sources": [
    { "type": "client_data|web_enrichment|ai_analysis", "reference": "" }
  ]
}

## First Party Trick -- Claude Prompt

Context: Company name, description, industry vertical
Client Data: Extracted text from all uploaded documents
Web Enrichment: Company website, leadership, tech stack, market position, competitors, regulatory
Instructions: Analyze this business. Top 3-5 problems. Operational patterns. Financial indicators. Propose a data schema. 30/60/90 day plan. Write like an MBA analyst presenting Monday morning.
Output: Structured JSON per Results shape above.

## Future (Not Now)
- Richie's per-client encryption component
- Richie's RAG layer (swap in for Claude-direct when ready)
- Questionnaire / discovery layer
- Multi-user auth
- Export to PDF
