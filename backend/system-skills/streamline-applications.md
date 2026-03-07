# System Skill: Streamline Applications

## Purpose

Evaluate the client's pain points, business description, and enrichment results to identify practical workflow automation applications using Intellistack Streamline. Output a **streamline_applications** field in your JSON results — a client-ready section recommending 3-5 specific Streamline workflows ranked by ease of implementation and business impact.

## About Intellistack Streamline

Streamline is a workflow automation platform that connects people, documents, data, and systems. It enables organizations to digitize and automate business processes without custom software development.

### Workflow Steps (Building Blocks)

| Step | Capabilities |
|------|-------------|
| **Forms** | Digital forms for data capture; supports logic, calculations, field validation, conditional visibility, assignments to specific users/roles |
| **Documents** | Dynamic document generation from DOCX templates; overlay PDFs with data; field mapping; merge multiple documents into a single output |
| **Collaboration** | Document review, commenting, and redlining before signature — contract lifecycle management (CLM) module |
| **Sign** | Electronic signatures — legally binding eSignatures embedded in workflow |
| **Notifications** | Email and SMS delivery of documents, status updates, reminders, and alerts at any workflow stage |
| **Logic** | Conditional routing and branching — route workflows down different paths based on data values, approvals, or business rules |
| **Transform** | AI-powered data transformation — reformat, summarize, classify, extract, or generate content using AI within a workflow |
| **Data Search** | Query external data sources in real time — acts as a live data fabric connecting to databases, APIs, and cloud services |
| **Deliver Data** | Push data to external systems — write records, update CRMs, sync databases |
| **Extract Data from Files** | AI document extraction (Document AI) — pull structured data from unstructured documents like invoices, contracts, and forms |
| **Incoming Webhook** | Trigger workflows from external systems — any system can kick off a Streamline workflow via HTTP POST |
| **Outbound Webhook** | Send data to external systems when a workflow reaches a specific step — real-time event-driven integrations |

### Integrations

| Integration | Use Case |
|-------------|----------|
| **Salesforce** | Managed package with automated triggers — launch workflows from Salesforce events, sync data back |
| **Google Drive** | Read/write files, attach documents, store outputs |
| **Google Sheets** | Read/write spreadsheet data, use as lightweight data source |
| **Google Calendar** | Schedule events, manage appointments within workflows |
| **Amazon S3** | Store and retrieve files from S3 buckets |
| **Dropbox** | File storage and retrieval |
| **OneDrive** | Microsoft file storage integration |
| **SharePoint** | Document libraries, enterprise content management |
| **Excel Online** | Read/write Excel workbooks in the cloud |
| **Slack** | Send notifications, request approvals, post updates to channels |
| **SendGrid** | Transactional email delivery |
| **SMTP** | Direct email sending via SMTP server |
| **SFTP** | Secure file transfer to/from external servers |
| **Twilio** | SMS and voice notifications |
| **Microsoft Outlook** | Email delivery and calendar integration |

## Instructions

Using the client's pain points, business description, industry context, and the full enrichment analysis, identify **3-5 practical Streamline workflow applications** that could address their specific needs.

### For Each Application, Provide

1. **Application title** — a short, descriptive name (e.g., "Automated Client Onboarding")
2. **Business problem** — describe the pain point it solves using the client's own language and context
3. **Streamline workflow** — which steps would be used (reference the step names above)
4. **Integrations** — which integrations apply to their existing tools and systems
5. **Operational outcome** — what changes for them day-to-day; be specific about time saved, errors eliminated, visibility gained

### Output Format

The `streamline_applications` field should be a text string with this structure:

```
Based on [Company Name]'s operational needs, Streamline can automate the following workflows:

**1. [Application Title]**
Problem: [Business problem in their language]
Workflow: [Step names used — e.g., Forms → Logic → Documents → Sign → Notifications]
Integrations: [Applicable integrations — e.g., Salesforce, Google Drive, Slack]
Outcome: [What changes day-to-day]

**2. [Application Title]**
...

These applications are ordered by ease of implementation — the first items can typically be live within days, not weeks.
```

### Rules

- **Rank by ease of implementation and business impact** — low-hanging fruit first
- **Focus on practical, achievable workflows** — not aspirational transformations
- **Use plain business language** — no technical jargon, no "API endpoints", no "data pipelines"
- **NEVER** include cost estimates, pricing, dollar amounts, or implementation timelines
- **NEVER** reference programming languages, code, databases, or infrastructure
- **DO** reference the client's specific pain points, industry terminology, and business context
- **DO** connect each application to a real problem identified in the enrichment analysis
- **DO** mention which of their existing tools/systems integrate (if known from their data)
- **DO** keep the entire section under 400 words
- **DO** maintain a consultative, professional tone — helpful, not salesy
