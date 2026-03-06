# XO CAPTURE - PROJECT STATUS

**Date:** March 5, 2026
**Project:** XO Capture - Rapid Deployment
**Author:** Ken Scott, Co-Founder & President, Intellagentic
**Status:** Deployed & Operational (v1.56)
**CloudFront URL:** https://d36la414u58rw5.cloudfront.net
**Repository:** https://github.com/intellagentic/xo-quickstart

---

## ARCHITECTURE DIAGRAMS

### 1. System Architecture

```
+-------------------+
|      Browser      |
| (Desktop / Mobile)|
+--------+----------+
         |
         | HTTPS (JWT in Authorization header)
         |
+--------v----------+         +----------------------------------+
|    CloudFront      |         |       API Gateway (REST)         |
|  EWNDD7ESKAW33     |         |  2t9mg17baj.execute-api          |
+--------+----------+         |    .us-west-1.amazonaws          |
         |                     +--+----+----+----+----+----+--+--+
         |                        |    |    |    |    |    |  |
         v                        |    |    |    |    |    |  |
+------------------+              |    |    |    |    |    |  |
| S3: xo-prototype |              |    |    |    |    |    |  |
|    -frontend     |              |    |    |    |    |    |  |
| (index.html,     |              |    |    |    |    |    |  |
|  JS, CSS, logos) |              |    |    |    |    |    |  |
+------------------+              |    |    |    |    |    |  |
                                  v    v    v    v    v    v  v
  +---------+ +--------+ +-------+ +------+ +------+ +------+ +--------+
  |xo-auth  | |xo-     | |xo-    | |xo-   | |xo-   | |xo-  | |xo-     |
  | Lambda  | |clients | |upload | |enrich| |results| |btns | |gdrive  |
  |Python   | |Lambda  | |Lambda | |Lambda| |Lambda | |     | |import  |
  |  3.11   | |        | |       | |      | |       | |     | |Lambda  |
  +----+----+ +---+----+ +---+---+ +--+---+ +--+----+ +--+--+ +---+----+
       |          |           |        |        |         |         |
       |          |           |        v        |         |         v
       |          |           | +----------+    |         |  +-----------+
       |          |           | |Claude    |    |         |  |Google     |
       |          |           | |Opus 4.5  |    |         |  |Drive API  |
       |          |           | |or Sonnet |    |         |  |(OAuth2 +  |
       |          |           | |(user sel)|    |         |  | files)    |
       |          |           | +----+-----+    |         |  +-----+-----+
       |          |           |      |          |         |        |
       v          v           v      v          v         v        v
  +----------------------------------------------------------+
  |              S3: xo-client-data                          |
  |  {client_id}/                                            |
  |    +-- uploads/        (raw files)                       |
  |    +-- extracted/      (parsed text)                     |
  |    +-- results/        (analysis.json)                   |
  +----------------------------------------------------------+
       |          |           |      |          |          |
       v          v           v      v          v          v
  +----------------------------------------------------------+
  |         RDS PostgreSQL 15 (xo_quickstart)                |
  |  db.t3.micro | xo-quickstart-db.xxxxx.rds.amazonaws.com |
  |                                                          |
  |  Tables: users, clients, uploads, enrichments,           |
  |          skills, buttons                                 |
  +----------------------------------------------------------+
```

### 2. Frontend Component Tree

```
App (root)
|
+-- LoginScreen (if !isLoggedIn)
|     +-- Header bar (same as main app: XO logo box, "Rapid Deployment", Intellagentic logo)
|     +-- "Welcome" heading (uppercase, letter-spaced, subtle gray)
|     +-- Google Sign-In button (via Google Identity Services library)
|     +-- "or" divider
|     +-- "Sign in with email instead" link (toggles to email/password form)
|     +-- [Email form] Email field (Mail icon) + Password field (Lock icon) + "Continue" button
|     +-- Forgot Password? link + Reset Password expandable form
|     +-- Error banner (AlertTriangle, red)
|     +-- Google OAuth admin login → dashboard; email/password login → single-client workspace
|
+-- [Authenticated App] (if isLoggedIn)
|
+-- Header
|     +-- Hamburger Menu Button
|     +-- XO Logo Box
|     +-- Title (desktop: "XO Capture" / mobile: "Rapid Prototype")
|     +-- Subtitle: "Client Dashboard" (on dashboard) or company name (in workspace)
|     +-- Intellagentic Logo (right)
|
+-- Sidebar (slide-out, 280px)
|     +-- All Clients   (Building2 icon) -- admin only, navigates to dashboard
|     +-- ---divider---  -- admin only
|     +-- Welcome        (Home icon)
|     +-- Sources        (FolderOpen icon)
|     +-- Enrich         (Sparkles icon)
|     +-- Results        (FileText icon)
|     +-- Skills         (Database icon)
|     +-- ---divider---
|     +-- Configuration  (Settings icon)
|     +-- Branding       (Image icon) -- workspace only (hidden on dashboard)
|     +-- Theme Toggle   (Sun/Moon)
|     +-- Sign Out       (LogOut icon, red)
|
+-- DashboardScreen (admin only, currentScreen === 'dashboard')
|     +-- Header: "All Clients (N)" + "+ New Client" button
|     +-- Grid of client cards (auto-fill, min 300px)
|     |     +-- Client icon (32px, or letter fallback) + Company name (bold) + chevron right
|     |     +-- Industry badge (pill)
|     |     +-- Source count (FolderOpen icon) + enrichment status badge
|     |     +-- Last enriched date (if available)
|     +-- Click card → enters workspace scoped to that client
|     +-- "+ New Client" → opens CompanyInfoModal → creates client → enters workspace
|     +-- Empty state: "No clients yet" + "Create First Client" button
|     +-- Loading state: spinner
|     +-- Error state: retry button
|
+-- CompanyInfoModal
|     +-- Company Name *
|     +-- Website URL
|     +-- Contact Name
|     +-- Contact Title
|     +-- LinkedIn URL
|     +-- Industry
|     +-- Description
|     +-- Immediate Pain Point    <-- NEW (textarea)
|     +-- ---divider---
|     +-- Client Branding (logo + icon upload, thumbnail previews)
|
+-- Screen Router (currentScreen state)
      |
      +-- UploadScreen ("Welcome")
      |     +-- Step Card 1: Domain Expertise  --> opens CompanyInfoModal
      |     +-- Step Card 2: Raw Data          --> drag-and-drop file zone
      |     |     +-- Sources Strip (5 connector pills)
      |     |     |     +-- Upload (red, active)
      |     |     |     +-- Google Drive (blue when connected, triggers OAuth or file picker)
      |     |     |     +-- NotebookLM (grayed out)
      |     |     |     +-- Dropbox (grayed out)
      |     |     |     +-- OneDrive (grayed out)
      |     |     +-- Google Drive File Picker Modal
      |     |           +-- Header (HardDrive icon, title, close)
      |     |           +-- Back button (folder navigation)
      |     |           +-- File list (folders + files, checkable)
      |     |           +-- Footer (selection count, Import Files button)
      |     +-- Step Card 3: Intellagentic Growth  --> upload trigger
      |     +-- Action Buttons Row (from configButtons)
      |     +-- Founder Quotes (Alan Moore, Ken Scott)
      |
      +-- EnrichScreen
      |     +-- Model Badge (purple Opus / blue Sonnet)
      |     +-- Start Enrichment Button
      |     +-- Progress Tracker (5 stages)
      |
      +-- ResultsScreen
      |     +-- Executive Summary
      |     +-- Problems (expandable, severity badges)
      |     +-- Data Schema (expandable tables)
      |     +-- 7/14/21 Action Plan
      |     +-- Sources
      |
      +-- SkillsScreen
      |     +-- Skills List
      |     +-- AddSkillModal (name, content, upload .md)
      |
      +-- ConfigurationScreen
      |     +-- AI Model Selector (radio cards)
      |     |     +-- Claude Opus 4.5 (default, best analysis)
      |     |     +-- Claude Sonnet 4.5 (faster, cheaper)
      |     +-- Theme Toggle (light/dark)
      |     +-- Streamline Webhook (workspace only)
      |     |     +-- "Send to Streamline" toggle (default OFF, per-client)
      |     |     +-- Webhook URL (read-only display)
      |     |     +-- Manual override note
      |     +-- Configure Buttons (drag-and-drop, inline edit)
      |     |     +-- Button Card (grip, icon, label, URL, actions)
      |     |     +-- Inline Editor (label, URL, color grid, icon grid)
      |     |     +-- "+ Add Button"
      |     +-- Live Preview Panel
      |
      +-- BrandingScreen (workspace only)
            +-- Company Logo card (drop zone, preview, replace)
            +-- Company Icon card (drop zone, preview, replace)
            +-- Preview section (header logo mockup, dashboard card icon mockup)
```

### 3. S3 Folder Structure (per client)

```
xo-client-data/
|
+-- client_1709251234_a1b2c3d4/
|     |
|     +-- metadata.json
|     |     {
|     |       "client_id": "client_1709251234_a1b2c3d4",
|     |       "company_name": "Acme Waste Management",
|     |       "website": "https://acme-waste.com",
|     |       "contact_name": "John Doe",
|     |       "contact_title": "CEO",
|     |       "contact_linkedin": "https://linkedin.com/in/johndoe",
|     |       "industry": "Waste Management",
|     |       "description": "Regional waste collection service",
|     |       "pain_point": "Route optimization is killing our margins",
|     |       "created_at": "2026-03-01T00:00:00.000000",
|     |       "status": "active"
|     |     }
|     |
|     +-- uploads/
|     |     +-- customers.csv
|     |     +-- routes.xlsx
|     |     +-- contract.pdf
|     |     +-- meeting-notes.mp3
|     |
|     +-- branding/
|     |     +-- logo.png              (company logo, overwrites on re-upload)
|     |     +-- icon.png              (company icon, overwrites on re-upload)
|     |
|     +-- extracted/                  (future: parsed text output)
|     |     +-- customers.txt
|     |     +-- meeting-notes_transcript.txt
|     |
|     +-- skills/
|     |     +-- waste-management-analysis.md
|     |     +-- route-optimization.md
|     |
|     +-- results/
|           +-- analysis.json         (Claude output: summary, problems,
|                                      schema, plan, sources)
|
+-- client_1709259876_e5f6g7h8/
      +-- ...
```

### 4. Data Flow Diagram (3-step partner journey)

```
STEP 1: NEW PARTNER                    STEP 2: UPLOAD FILES
========================               ========================

+------------------+                   +------------------+
| CompanyInfoModal |                   | Drag-and-Drop    |
| - name *         |                   | File Zone        |
| - website        |                   | (15 file types)  |
| - contact info   |                   +--------+---------+
| - industry       |                            |
| - description    |                            v
| - pain point     |                   +------------------+
+--------+---------+                   | POST /upload     |
         |                             | { client_id,     |
         v                             |   files: [...] } |
+------------------+                   +--------+---------+
| POST /clients    |                            |
| { company_name,  |                            v
|   website,       |                   +------------------+
|   contactName,   |                   | S3 Presigned URL |
|   painPoint, ... }|                  | PUT direct to S3 |
+--------+---------+                   +--------+---------+
         |                                      |
         v                                      v
+------------------+                   +------------------+
| xo-clients       |                   | xo-client-data/  |
| Lambda           |                   |  {id}/uploads/   |
| - generate id    |                   |  +-- file1.csv   |
| - create folders |                   |  +-- file2.pdf   |
| - write metadata |                   +------------------+
+--------+---------+
         |
         v
+------------------+
| xo-client-data/  |
|  {id}/           |
|  +-- metadata.json
|  +-- uploads/    |
|  +-- extracted/  |
|  +-- results/    |
+------------------+


STEP 3: ENRICH + RESULTS
========================

+------------------+         +------------------+
| Click "Start     |         | xo-enrich Lambda |
|  Enrichment"     |         |                  |
+--------+---------+         | 1. Read metadata |
         |                   |    (+ pain point)|
         v                   | 2. List uploads/ |
+------------------+         | 3. Extract text  |
| POST /enrich     |-------->|    (CSV/PDF/XLSX)|
| { client_id }    |         | 4. Read skills/  |
+------------------+         | 5. Build prompt  |
                             |    (pain point = |
                             |     PRIORITY #1) |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             | Claude Opus 4.5  |
                             | (or Sonnet 4.5)  |
                             | - exec summary   |
                             | - problems (3-5) |
                             | - data schema    |
                             | - 7/14/21 plan  |
                             | - sources        |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             | S3: {id}/results/|
                             |  analysis.json   |
                             +--------+---------+
                                      |
         +----------------------------+
         |
         v
+------------------+         +------------------+
| GET /results/{id}|-------->| xo-results       |
|  (poll every 2s) |         | Lambda           |
+------------------+         | - read analysis  |
                             |   .json from S3  |
         +-------------------|                  |
         |                   +------------------+
         v
+------------------+
| ResultsScreen    |
| - Summary        |
| - Problems       |
| - Schema         |
| - Action Plan    |
| - Sources        |
+------------------+
```

### 5. API Gateway Route Map

```
+---------------------------------------------------------------+
|  API Gateway: xo-api                                          |
|  Base: https://2t9mg17baj.execute-api.us-west-1.amazonaws.com |
|  Stage: /prod                                                 |
+---------------------------------------------------------------+
|                                                               |
|  Method   Path             Lambda        Purpose              |
|  ------   ----             ------        -------              |
|  POST     /clients         xo-clients    Create new partner   |
|                                          - validate name      |
|                                          - generate client_id |
|                                          - create S3 folders  |
|                                          - write metadata.json|
|                                            (incl. pain_point) |
|                                                               |
|  POST     /upload          xo-upload     Get presigned URLs   |
|                                          - validate client_id |
|                                          - generate PUT URLs  |
|                                          - 1 hour expiry      |
|                                                               |
|  POST     /enrich          xo-enrich     Trigger AI analysis  |
|                                          - read metadata      |
|                                          - extract file text  |
|                                          - load skills (.md)  |
|                                          - select model (Opus |
|                                            or Sonnet per user)|
|                                          - call Claude API    |
|                                          - prioritize pain pt |
|                                          - write results JSON |
|                                                               |
|  GET      /results/{id}    xo-results    Fetch analysis       |
|                                          - read analysis.json |
|                                          - return JSON or     |
|                                            {status:processing}|
|                                                               |
|  POST     /auth/google     xo-auth       Google OAuth login    |
|                                          - verify ID token     |
|                                          - check allowed emails|
|                                          - upsert user         |
|                                          - return JWT+is_admin |
|                                                               |
|  PUT      /auth/preferences xo-auth      Update user prefs     |
|                                          (model selection)     |
|                                                               |
|  GET      /clients/list   xo-clients    List all clients      |
|                                          - source count        |
|                                          - enrichment status   |
|                                          - last enrichment date|
|                                                               |
|  GET      /gdrive/auth-url xo-gdrive-    Get OAuth consent URL |
|                            import                              |
|                                                               |
|  POST     /gdrive/callback xo-gdrive-   Exchange auth code    |
|                            import        for tokens            |
|                                                               |
|  GET      /gdrive/files   xo-gdrive-    List Drive files      |
|                            import        (folder navigation)   |
|                                                               |
|  POST     /gdrive/import  xo-gdrive-    Download Drive files  |
|                            import        to S3                 |
|                                                               |
|  OPTIONS  (all paths)      (built-in)    CORS preflight       |
|                                          - Allow-Origin: *    |
|                                          - Allow-Headers:     |
|                                            Content-Type       |
+---------------------------------------------------------------+

Request/Response Flow:

  Browser                API Gateway              Lambda              S3
    |                        |                      |                  |
    |-- POST /clients ------>|-- invoke ----------->|                  |
    |                        |                      |-- put metadata ->|
    |                        |                      |-- put folders -->|
    |<-- { client_id } ------|<-- return -----------|                  |
    |                        |                      |                  |
    |-- POST /upload ------->|-- invoke ----------->|                  |
    |                        |                      |-- check meta -->|
    |<-- { upload_urls } ----|<-- presigned URLs ---|                  |
    |                        |                      |                  |
    |-- PUT (presigned) -----|--------------------------------------------->|
    |                        |                      |                  |
    |-- POST /enrich ------->|-- invoke ----------->|                  |
    |                        |                      |-- read meta --->|
    |                        |                      |-- read uploads->|
    |                        |                      |-- read skills ->|
    |                        |                      |-- Claude API    |
    |                        |                      |-- put results ->|
    |<-- { status } ---------|<-- return -----------|                  |
    |                        |                      |                  |
    |-- GET /results/{id} -->|-- invoke ----------->|                  |
    |                        |                      |-- read results->|
    |<-- { analysis } -------|<-- return -----------|                  |
```

---

## FRONTEND

**Framework:** React 18.2.0 + Vite 5.4.14
**Deployment:** S3 static hosting + CloudFront CDN
**Build:** Production optimized bundle (~226 KB JS, 6.8 KB CSS, 37 KB logos)

### Components Structure

```
src/
  App.jsx          -- Main application component
    - LoginScreen             (Invitation branding, single form, auto-create/login)
    - Hamburger Sidebar       (Navigation: Welcome, Sources, Enrich, Results, Skills, Configuration, Branding (workspace only), theme toggle -- all always clickable)
    - CompanyInfoModal        (Partner information form - 8 fields, creates client on save)
    - UploadScreen            (3-step journey with founder quotes, Step 2 links to Sources)
    - SourcesScreen           (Source Library + Add Sources — file CRUD, toggle, replace, delete)
    - EnrichScreen            (AI processing with progress tracking)
    - ResultsScreen           (Analysis display with expandable sections)
    - SkillsScreen            (Skills management - list, add, edit, delete)
    - AddSkillModal           (Skill creation/editing modal)
    - ConfigurationScreen     (Theme toggle, Streamline webhook toggle, AI model, button config, live preview)

  assets/
    - logo-light.png          (White logo for dark backgrounds, 26px header)
    - logo-dark.png           (Dark logo for light backgrounds)

  index.css        -- Global styles and theme tokens
  main.jsx         -- React entry point
```

### Five-Screen Flow

1. **Welcome / Upload Screen** (3-step journey layout with founder testimonials)
   - Header: Hamburger menu (left), XO logo, title, Intellagentic logo (right)
   - Step 1: Domain Expertise -- "New Partner" modal (8 fields: name, website, contact, title, LinkedIn, industry, description, pain point)
   - Step 2: Raw Data -- Compact source count summary with "Manage Sources" link (or "Add Sources" if empty)
     - Sources managed on dedicated Sources screen (see below)
   - Step 3: Intelligent Growth -- Preview of analysis output (grayed until steps 1&2 complete)
   - "Continue to Enrichment" button (replaces "Upload & Continue" — files already uploaded via Sources)

2. **Sources Screen** (NotebookLM-style Source Library)
   - **Top panel — Source Library**: File list with card rows, summary bar (X active · Y total · Z MB)
     - Each card: file type icon, filename, version badge (v2/v3), source pill (Local red / Google Drive blue), file size, date
     - Active/inactive toggle (ToggleLeft/ToggleRight) — dims inactive cards
     - Kebab menu (MoreVertical): Replace, Delete
     - Delete confirmation modal overlay
     - Replace triggers file picker, creates new version with parent_upload_id link
     - Empty state matching Skills screen pattern
   - **Bottom panel — Add Sources**: Drag-and-drop zone with immediate upload on drop
     - Sources strip: Upload (active), Google Drive (OAuth popup), NotebookLM/Dropbox/OneDrive (grayed out)
     - Google Drive file picker modal (moved from UploadScreen)
     - Pending files list with progress indicators
   - Requires clientId (shows "Complete Domain Expertise first" message if missing)
   - Action Buttons Row: Configurable buttons between step cards and quotes (Enrich, Skills by default)
     - Clickable: internal routes navigate, external URLs open in new tab
     - Managed via Configuration screen, rendered with hex colors and glow shadows
   - Founder Quotes: Two editorial pull quotes side-by-side (Alan Moore & Ken Scott)
   - Compact layout: All steps + quotes fit on screen without scrolling (220px card height)

2. **Enrich Screen**
   - Model badge shows current AI model (purple for Opus, blue for Sonnet)
   - "Start Enrichment" button triggers /enrich Lambda with selected model
   - Real-time progress tracking (5 stages: extract, transcribe, research, analyze, complete)
   - Lambda reads skills from S3 and injects into Claude prompt
   - Auto-navigates to results when complete

3. **Results Screen**
   - Executive Summary
   - Problems Identified (expandable cards with severity badges)
   - Proposed Data Schema (expandable tables with column details)
   - 7/14/21 Day Action Plan
   - Data Sources (client data, web enrichment, AI analysis)

4. **Skills Screen** (new)
   - List of domain-specific skills (markdown files from S3)
   - "+ Add Skill" button opens modal
   - Modal: skill name, markdown content (monospace textarea), or upload .md file
   - Each skill can be edited or deleted
   - Skills injected into Claude prompt during enrichment
   - Empty state: "No skills yet. Add your first skill to enhance AI analysis."

5. **Configuration Screen** (fully functional)
   - **AI Model selector**: Radio-button cards for Claude Opus 4.5 (default) and Sonnet 4.5
     - Selection saved per-user to PostgreSQL via PUT /auth/preferences
     - Opus card: purple accent, "Best analysis quality" description
     - Sonnet card: blue accent, "Faster responses, lower cost" description
   - Theme toggle: working light/dark mode with localStorage persistence
   - Configure Buttons: Surgical Trays reference pattern with drag-and-drop reorder
     - Each button card: grip handle, colored icon circle, name, color/icon label, URL, edit/copy/delete icons
     - Inline editing: label, URL, 8-color grid selector with checkmarks, icon grid (30+ icons)
     - "+ Add Button" creates new button and opens inline editor
   - Live Preview: right-side panel renders buttons exactly as they appear on Welcome page
   - Buttons stored in PostgreSQL via /buttons API, synced on login and save
   - Action buttons on Welcome page are clickable:
     - Internal routes (/enrich, /skills, etc.) navigate to that screen
     - External URLs (https://...) open in new tab

### CSS Architecture

**Theme:** Dark header (#1a1a2e), light/dark body via CSS variables, red accent (#dc2626)

**Theme System (CSS Variables):**
- `:root` (light): --bg-body: #f0f0f0, --bg-card: #ffffff, --text-primary: #1a1a1a
- `[data-theme="dark"]`: --bg-body: #0d1117, --bg-card: #161b22, --text-primary: #c9d1d9
- Variables cover: body, cards, inputs, borders, text, shadows, scrollbar
- Theme persisted to localStorage (key: xo-theme), applied via data-theme attribute on body
- Toggle accessible from Configuration screen and hamburger sidebar

**Key Styles:**
- Dark cards with numbered step circles (48px) - compact 220px height
- Horizontal layout: 3 cards in one row, tightly spaced (0.75rem gap)
- Founder quotes: Editorial pull quotes with 3.5rem red quotation marks
- Hamburger sidebar: 280px width, slide-out from left with dark background
- All content fits on screen without scrolling (standard laptop viewport)
- Mobile responsive: cards and quotes stack vertically at <768px
- Mobile header: "XO Capture" swaps to "Rapid Prototype" at ≤768px, version badge hidden
- Touch-friendly buttons: min 44px height
- Modal: full-width on mobile with scrollable body
- Button config cards: slideIn/fadeIn animations, card-hover/btn-hover transitions

---

## AWS INFRASTRUCTURE

### S3 Buckets

**1. xo-prototype-frontend** (us-west-1)
- Purpose: Static website hosting for React app
- Public access: Enabled for CloudFront origin
- Website endpoint: http://xo-prototype-frontend.s3-website-us-west-1.amazonaws.com
- CORS: Configured for API calls
- Files: index.html, assets/index-*.js, assets/index-*.css

**2. xo-client-data** (us-west-1)
- Purpose: Client document storage and analysis results
- Public access: Blocked (private bucket)
- CORS: Enabled for presigned URL uploads
- Structure: See "S3 Folder Structure" section below

### CloudFront Distribution

**Distribution ID:** EWNDD7ESKAW33
**Domain:** d36la414u58rw5.cloudfront.net
**Origin:** xo-prototype-frontend.s3-website-us-west-1.amazonaws.com
**Protocol:** HTTP -> HTTPS redirect
**Cache:** Default 24 hours, gzip compression enabled
**Error Pages:** 404 -> /index.html (for SPA routing)

### API Gateway

**Name:** xo-api
**Type:** REST API
**Region:** us-west-1
**Stage:** prod
**Base URL:** https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod
**CORS:** Enabled on all methods

**Resources:**
- /auth/login (POST) -- authenticate or auto-create user, return JWT + preferred_model
- /auth/google (POST) -- Google OAuth login for admin users (verify ID token, check allowed list)
- /auth/register (POST) -- explicit user registration
- /auth/reset-password (POST) -- reset password (no email verification)
- /auth/preferences (PUT) -- update user preferences (model selection)
- /clients (GET/POST/PUT)
- /clients/list (GET) -- list all clients for user with source count + enrichment stats
- /upload (POST)
- /upload/branding (GET/POST) -- presigned URLs for client logo/icon branding assets
- /enrich (POST)
- /results/{id} (GET)
- /buttons (GET) -- fetch user's buttons
- /buttons/sync (PUT) -- full replace user's buttons
- /gdrive/auth-url (GET) -- Google OAuth consent URL
- /gdrive/callback (POST) -- exchange auth code for tokens
- /gdrive/files (GET) -- list Google Drive files
- /gdrive/import (POST) -- import Drive files to S3

### Lambda Functions

**IAM Role:** xo-lambda-role
- S3 full access to xo-client-data bucket
- CloudWatch Logs write permissions
- Lambda basic execution role

**Functions:** See "Lambda Functions" section below

### RDS PostgreSQL

**Instance:** xo-quickstart-db
**Engine:** PostgreSQL 15
**Class:** db.t3.micro
**Storage:** 20 GB gp3
**Database:** xo_quickstart
**Region:** us-west-1
**Publicly Accessible:** Yes (prototype -- strong password is primary defense)

**Schema (6 tables):**

```
+----------+       +----------+       +----------+
|  users   |<------+  clients |<------+  uploads |
+----------+  1:N  +----------+  1:N  +----------+
| id (PK)  |       | id (PK)  |       | id (PK)  |
| email    |       | user_id  |       | client_id|
| pass_hash|       | company  |       | filename |
| name     |       | website  |       | file_type|
| created  |       | contact* |       | s3_key   |
| gdrive_  |       | industry |       | source   |
|  refresh |       | descript |       | uploaded |
| gdrive_  |       |          |       +----------+
|  conn_at |       |          |
| preferred|       |          |
|  _model  |       |          |
+-----+----+       |          |
      |            | pain_pt  |
      |            | s3_folder|       +----------+
      |            | logo_s3_ |<------+ enrichmts|
      |            |  key     |  1:N  +----------+
      |            | icon_s3_ |
      |            |  key     |
      |            | strmline |
      |            |  _wh_en  |
      |            | 5 new DB |
      |            |  columns |
      |            | status   |       | id (PK)  |
      |            | created  |       | client_id|
      |            | updated  |       | status   |
      |            +-----+----+       | started  |
      |                  |            | completed|
      |                  |            | results  |
      |            +-----v----+       |  _s3_key |
      |            |  skills  |       +----------+
      |            +----------+
      |            | id (PK)  |
      |            | client_id|
      |            | name     |
      |            | content  |
      |            | s3_key   |
      |            | created  |
      |            +----------+
      |
+-----v----+
|  buttons |
+----------+
| id (PK)  |
| user_id  |
| name     |
| icon     |
| color    |
| url      |
| sort_ord |
+----------+
```

### Auth Flow

```
Browser                          API Gateway                Lambda (xo-auth)            PostgreSQL
  |                                  |                            |                        |
  |  POST /auth/login                |                            |                        |
  |  {email, password}               |                            |                        |
  |--------------------------------->|--------------------------->|                        |
  |                                  |                            |  SELECT WHERE email    |
  |                                  |                            |----------------------->|
  |                                  |                            |                        |
  |                                  |                     +------+------+                 |
  |                                  |                     | User found? |                 |
  |                                  |                     +------+------+                 |
  |                                  |                        YES |  NO                    |
  |                                  |               +------------+------------+           |
  |                                  |               |                         |           |
  |                                  |         bcrypt.checkpw()         INSERT new user    |
  |                                  |               |                  (name from email)  |
  |                                  |          pass? |                        |---------->|
  |                                  |           YES  |  NO                    |           |
  |                                  |            |   |                        |           |
  |                                  |    JWT token  401              JWT token (201)      |
  |                                  |    + user     error           + user                |
  |<---------------------------------|<----------(200)               |                     |
  |                                  |                              |                     |
  |  localStorage.setItem(token)     |                              |                     |
  |  onLogin(user, token)            |                              |                     |
```

**5 New DB-Only Columns (no UI yet):**
- `survival_metric_1`, `survival_metric_2` (TEXT)
- `ai_persona` (TEXT)
- `strategic_objective` (TEXT)
- `tone_mode` (VARCHAR 50)

**Schema file:** backend/schema.sql
**Seed script:** backend/seed.py (creates admin user + default buttons)
**Config script:** backend/set-db-config.sh (sets DATABASE_URL + JWT_SECRET on all Lambdas)

### Lambda Layer

**Name:** xo-psycopg2
**Contents:** psycopg2, PyJWT, bcrypt (compiled for Amazon Linux 2023 / Python 3.11)
**Attached to:** All 7 Lambdas

---

## API ENDPOINTS

**Authentication:** All endpoints except POST /auth/login, /auth/register, /auth/reset-password require a JWT Bearer token in the Authorization header.

### POST /auth/login

**Purpose:** Authenticate user and return JWT token. **Auto-creates account** if email doesn't exist.
**Lambda:** xo-auth

**Behavior:**
- If email exists → verify password with bcrypt → return JWT (200)
- If email doesn't exist → create account (name derived from email) → return JWT (201)
- Password must be at least 8 characters for new accounts

**Request:**
```json
{
  "email": "ken.scott@intellagentic.io",
  "password": "XOquickstart2026!"
}
```

**Response (200 existing user / 201 new user):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "ken.scott@intellagentic.io",
    "name": "Ken Scott",
    "preferred_model": "claude-opus-4-5-20250529"
  }
}
```

---

### POST /auth/register

**Purpose:** Explicit user registration (kept for API compatibility; login auto-creates)
**Lambda:** xo-auth

**Request:**
```json
{
  "email": "user@company.com",
  "password": "securepassword",
  "name": "Jane Smith"
}
```

**Response (201):**
```json
{
  "token": "eyJ...",
  "user": { "id": "uuid", "email": "user@company.com", "name": "Jane Smith" }
}
```

**Errors:** 409 if email already exists, 400 if password < 8 characters

---

### POST /auth/reset-password

**Purpose:** Reset user password (prototype: no email verification)
**Lambda:** xo-auth

**Request:**
```json
{
  "email": "ken.scott@intellagentic.io",
  "new_password": "NewSecurePass123"
}
```

**Response (200):**
```json
{"message": "Password reset successfully"}
```

**Errors:** 404 if email not found, 400 if password < 8 characters

---

### PUT /auth/preferences

**Purpose:** Update user preferences (model selection). Requires JWT auth.
**Lambda:** xo-auth

**Request:**
```json
{
  "preferred_model": "claude-opus-4-5-20250529"
}
```

**Allowed models:** `claude-opus-4-5-20250529`, `claude-sonnet-4-20250514`

**Response (200):**
```json
{"preferred_model": "claude-opus-4-5-20250529"}
```

**Errors:** 401 if unauthorized, 400 if invalid model

---

### GET /buttons

**Purpose:** Fetch all buttons for the authenticated user
**Lambda:** xo-buttons

**Response:**
```json
{
  "buttons": [
    {"id": "uuid", "label": "Enrich", "icon": "Sparkles", "color": "#22c55e", "url": "/enrich", "sort_order": 0}
  ]
}
```

---

### PUT /buttons/sync

**Purpose:** Full replace of user's buttons
**Lambda:** xo-buttons

**Request:**
```json
{
  "buttons": [
    {"label": "Enrich", "icon": "Sparkles", "color": "#22c55e", "url": "/enrich", "sort_order": 0}
  ]
}
```

**Response:**
```json
{"status": "synced", "count": 1}
```

---

### GET /gdrive/auth-url

**Purpose:** Get Google OAuth2 consent URL for popup-based authorization
**Lambda:** xo-gdrive-import

**Response (200):**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=...&scope=drive.readonly&access_type=offline&prompt=consent"
}
```

---

### POST /gdrive/callback

**Purpose:** Exchange Google auth code for tokens, store refresh token in DB
**Lambda:** xo-gdrive-import

**Request:**
```json
{
  "code": "4/0AY0e-g7..."
}
```

**Response (200):**
```json
{"connected": true}
```

---

### GET /gdrive/files

**Purpose:** List files in user's Google Drive with folder navigation
**Lambda:** xo-gdrive-import

**Query Params:** `folder_id` (default: `root`)

**Response (200):**
```json
{
  "files": [
    {"id": "abc123", "name": "Reports", "mimeType": "application/vnd.google-apps.folder", "isFolder": true, "isGoogleDoc": false},
    {"id": "def456", "name": "Q4 Analysis.pdf", "mimeType": "application/pdf", "size": 245000, "modifiedTime": "2026-02-28T10:00:00Z", "isFolder": false, "isGoogleDoc": false}
  ],
  "folder_id": "root"
}
```

---

### POST /gdrive/import

**Purpose:** Download selected files from Google Drive and upload to S3
**Lambda:** xo-gdrive-import

**Request:**
```json
{
  "file_ids": ["def456", "ghi789"],
  "client_id": "uuid-of-client"
}
```

**Response (200):**
```json
{
  "imported": 2,
  "files": [
    {"id": "uuid", "name": "Q4 Analysis.pdf", "type": "application/pdf", "s3_key": "s3_folder/uploads/Q4 Analysis.pdf", "source": "google_drive"}
  ]
}
```

---

### POST /clients

**Purpose:** Create new client and S3 folder structure
**Lambda:** xo-clients

**Request:**
```json
{
  "company_name": "Acme Waste Management",
  "website": "https://acme-waste.com",
  "contactName": "John Doe",
  "contactTitle": "CEO",
  "contactLinkedIn": "https://linkedin.com/in/johndoe",
  "industry": "Waste Management",
  "description": "Regional waste collection service",
  "painPoint": "Route optimization is killing our margins"
}
```

**Response:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "status": "created"
}
```

**Sample curl:**
```bash
curl -X POST https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod/clients \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Waste Management",
    "description": "Regional waste collection service",
    "painPoint": "Route optimization is killing our margins"
  }'
```

---

### POST /upload

**Purpose:** Generate presigned S3 URLs for direct file upload
**Lambda:** xo-upload

**Request:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "files": [
    {"name": "customers.csv", "type": "text/csv"},
    {"name": "recording.mp3", "type": "audio/mpeg"}
  ]
}
```

**Response:**
```json
{
  "upload_urls": [
    "https://xo-client-data.s3.amazonaws.com/client_1709251234_a1b2c3d4/uploads/customers.csv?...",
    "https://xo-client-data.s3.amazonaws.com/client_1709251234_a1b2c3d4/uploads/recording.mp3?..."
  ]
}
```

**Sample curl:**
```bash
curl -X POST https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod/upload \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client_1709251234_a1b2c3d4",
    "files": [{"name": "customers.csv", "type": "text/csv"}]
  }'
```

---

### POST /enrich

**Purpose:** Trigger AI analysis of uploaded documents
**Lambda:** xo-enrich

**Request:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "model": "claude-opus-4-5-20250529"
}
```

**Response:**
```json
{
  "job_id": "client_1709251234_a1b2c3d4",
  "status": "complete"
}
```

**Sample curl:**
```bash
curl -X POST https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod/enrich \
  -H "Content-Type: application/json" \
  -d '{"client_id": "client_1709251234_a1b2c3d4"}'
```

---

### GET /results/{id}

**Purpose:** Retrieve analysis results for a client
**Lambda:** xo-results

**Request:** GET /results/client_1709251234_a1b2c3d4

**Response:**
```json
{
  "status": "complete",
  "summary": "Executive summary...",
  "problems": [
    {
      "title": "Route Optimization Inefficiency",
      "severity": "high",
      "evidence": "Evidence from data...",
      "recommendation": "Implement route optimization..."
    }
  ],
  "schema": {
    "tables": [
      {
        "name": "customers",
        "purpose": "Commercial client master data",
        "columns": [
          {"name": "customer_id", "type": "UUID", "description": "Unique identifier"}
        ]
      }
    ]
  },
  "plan": [
    {
      "phase": "30-day",
      "actions": ["action 1", "action 2"]
    }
  ],
  "sources": [
    {"type": "client_data", "reference": "customers.csv (2,487 records)"}
  ]
}
```

**Sample curl:**
```bash
curl https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod/results/client_1709251234_a1b2c3d4
```

---

## S3 FOLDER STRUCTURE

**Bucket:** xo-client-data

**Per-client layout:**
```
{client_id}/
  |
  +-- uploads/              <- Original files uploaded by user
  |     +-- customers.csv
  |     +-- recording.mp3
  |     +-- invoice_data.xlsx
  |
  +-- extracted/            <- Text extracted from files (future use)
  |     +-- customers.txt
  |     +-- recording_transcript.txt
  |
  +-- skills/               <- Domain-specific skills/instructions (markdown)
  |     +-- waste-management-analysis.md
  |     +-- route-optimization.md
  |
  +-- results/              <- Analysis output from Claude
  |     +-- analysis.json
  |
  +-- metadata.json         <- Client information and timestamps
```

**metadata.json structure:**
```json
{
  "client_id": "client_1709251234_a1b2c3d4",
  "company_name": "Acme Waste Management",
  "website": "https://acme-waste.com",
  "contact_name": "John Doe",
  "contact_title": "CEO",
  "contact_linkedin": "https://linkedin.com/in/johndoe",
  "industry": "Waste Management",
  "description": "Regional waste collection service",
  "pain_point": "Route optimization is killing our margins",
  "created_at": "2026-03-01T00:00:00.000000",
  "status": "active"
}
```

---

## LAMBDA FUNCTIONS

All Lambdas require JWT auth (except /auth/login). Auth is provided by `auth_helper.py` (shared module copied into each deploy package). All Lambdas use the `xo-psycopg2` Lambda layer for PostgreSQL, JWT, and bcrypt support. 7 Lambdas total.

**Common Environment Variables (all Lambdas):**
- BUCKET_NAME: xo-client-data
- DATABASE_URL: postgresql://xo_admin:PASSWORD@HOST:5432/xo_quickstart
- JWT_SECRET: (256-bit random secret)

### xo-auth

**Runtime:** Python 3.11
**Memory:** 256 MB
**Timeout:** 30 seconds
**Handler:** lambda_function.lambda_handler

**What it does:**
1. Routes by path: /auth/google, /auth/login, /auth/register, /auth/reset-password, /auth/preferences
2. POST /auth/google: **Google OAuth login** -- verify ID token via Google tokeninfo endpoint, check email against ALLOWED_EMAILS list (4 admin emails), upsert user (sentinel password_hash blocks password login), return JWT with `is_admin=true`
3. POST /auth/login: **Auto-create flow** -- if email exists, verify bcrypt password; if not, create new user (is_admin=false)
4. POST /auth/register: Explicit registration with optional name field
5. POST /auth/reset-password: Updates bcrypt hash directly (prototype, no email verification)
6. PUT /auth/preferences: Update user preferences (preferred_model) -- requires JWT auth
7. Returns JWT (24h expiry, HS256) with user_id, email, name, is_admin
8. Login response includes preferred_model + is_admin flag
9. Name auto-derived from email prefix for auto-created accounts (e.g., ken.scott → Ken Scott)

**Admin Emails (ALLOWED_EMAILS):** alan.moore@intellagentic.io, ken.scott@intellagentic.io, rs@multiversant.com, vn@multiversant.com
**Env Vars:** DATABASE_URL, JWT_SECRET, BUCKET_NAME, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID

**File:** backend/lambdas/auth/lambda_function.py

---

### xo-clients

**Runtime:** Python 3.11
**Memory:** 256 MB
**Timeout:** 30 seconds
**Handler:** lambda_function.lambda_handler

**What it does (method router with 4 handlers):**

1. **GET /clients/list** — List all clients for user with stats (admin dashboard)
   - Returns: company_name, industry, client_id, source_count, enrichment_status, enrichment_date
   - Subqueries: COUNT active uploads, latest enrichment status/date
   - Ordered by updated_at DESC

2. **GET /clients?client_id=X** — Fetch existing client data
   - If client_id provided, fetch by s3_folder; otherwise fetch most recent for user
   - Returns all fields: company_name, website, contactName, contactTitle, contactLinkedIn, industry, description, painPoint, client_id, timestamps

3. **POST /clients** — Create new client
   - Validates company_name, generates unique client_id: `client_{timestamp}_{md5hash}`
   - Creates S3 folder structure: uploads/, extracted/, results/
   - Generates client-config.md in S3, copies default skill template
   - INSERT INTO clients + skills tables
   - Returns client_id (S3 folder) + id (DB UUID)

4. **PUT /clients** — Update existing client
   - Requires client_id in body
   - Updates all fields + updated_at timestamp
   - Regenerates client-config.md in S3

**File:** backend/lambdas/clients/lambda_function.py

---

### xo-upload

**Runtime:** Python 3.11
**Memory:** 256 MB
**Timeout:** 30 seconds
**Handler:** lambda_function.lambda_handler

**What it does (method router with 7 handlers):**

1. **POST /upload** — Original presigned URL flow (auth + client validation)
   - Generates presigned PUT URLs for each file (1 hour expiry)
   - INSERT INTO uploads with file_size column
   - Returns upload_urls + upload_ids

2. **GET /uploads?client_id=X** — List all sources for a client
   - Returns non-deleted uploads ordered by uploaded_at DESC
   - Includes: id, filename, file_type, s3_key, uploaded_at, source, status, file_size, version, parent_upload_id, replaced_at

3. **DELETE /uploads/{id}** — Soft-delete upload
   - Sets status='deleted' in DB
   - Deletes object from S3

4. **PUT /uploads/{id}/toggle** — Toggle active/inactive
   - Flips status between 'active' and 'inactive'

5. **POST /uploads/{id}/replace** — Upload new version
   - Marks parent as status='replaced', replaced_at=NOW()
   - Creates new record with version+1 and parent_upload_id
   - Returns presigned URL for new file

6. **POST /upload/branding** — Generate presigned PUT URL for client logo or icon
   - Accepts: client_id, file_type ("logo" or "icon"), content_type, file_extension
   - Validates ownership, generates S3 key: `{client_id}/branding/{file_type}.{ext}` (overwrites previous)
   - Updates `logo_s3_key` or `icon_s3_key` in clients table
   - Returns: upload_url, s3_key

7. **GET /upload/branding?client_id=X** — Get presigned GET URLs for viewing logo/icon
   - Fetches logo_s3_key and icon_s3_key from clients table
   - Generates presigned GET URLs (1 hour expiry) for each non-null key
   - Returns: logo_url, icon_url, logo_s3_key, icon_s3_key

**File:** backend/lambdas/upload/lambda_function.py

---

### xo-enrich

**Runtime:** Python 3.11
**Memory:** 512 MB
**Timeout:** 300 seconds (5 minutes)
**Handler:** lambda_function.lambda_handler

**Additional Environment Variables:**
- ANTHROPIC_API_KEY: sk-ant-... (set via set-api-key.sh)

**Dependencies:**
- anthropic==0.40.0
- pypdf==5.1.0
- openpyxl==3.1.2

**What it does:**
1. **Auth check** (JWT required)
2. **Reads client metadata from PostgreSQL** (replaces S3 metadata.json)
3. **INSERT INTO enrichments** (status='processing') before analysis
4. **Reads skills from DB** (with S3 fallback for s3_key-only skills)
5. Extracts text from uploaded files in S3:
   - CSV: Parse with csv module, include header + 10 sample rows
   - PDF: Extract text with pypdf (first 10 pages)
   - Excel: Extract with openpyxl (all sheets, first 10 rows each)
   - TXT: Read directly
6. **Model selection**: reads model from request body, falls back to user's DB preference, defaults to Opus 4.5
   - Allowed models: claude-opus-4-5-20250529 (default), claude-sonnet-4-20250514
7. Sends extracted text + company info + pain point to Claude API (using selected model)
8. Uses "First Party Trick" prompt for MBA-level analysis
9. If pain_point present: injects PRIORITY instruction
10. Writes analysis.json to {client_id}/results/ in S3
11. **UPDATE enrichments** (status='complete', results_s3_key)
12. On error: UPDATE enrichments (status='error')

**File:** backend/lambdas/enrich/lambda_function.py
**Deploy:** backend/lambdas/enrich/deploy-enrich.sh

---

### xo-results

**Runtime:** Python 3.11
**Memory:** 256 MB
**Timeout:** 10 seconds
**Handler:** lambda_function.lambda_handler

**What it does:**
1. **Auth check** (JWT required)
2. **Checks enrichments table** for latest status (processing/complete/error)
3. If complete: reads results_s3_key from DB, fetches analysis.json from S3
4. If processing: returns {"status": "processing"}
5. Fallback: direct S3 check if no enrichment record exists

**File:** backend/lambdas/results/lambda_function.py

---

### xo-buttons (NEW)

**Runtime:** Python 3.11
**Memory:** 256 MB
**Timeout:** 30 seconds
**Handler:** lambda_function.lambda_handler

**What it does:**
1. **Auth check** (JWT required)
2. GET /buttons: Returns all buttons for user, ordered by sort_order
3. PUT /buttons/sync: Deletes all user's buttons, inserts new set (full replace)

**File:** backend/lambdas/buttons/lambda_function.py

---

### xo-gdrive-import (NEW)

**Runtime:** Python 3.11
**Memory:** 512 MB
**Timeout:** 120 seconds
**Handler:** lambda_function.lambda_handler

**Additional Environment Variables:**
- GOOGLE_CLIENT_ID: OAuth 2.0 client ID
- GOOGLE_CLIENT_SECRET: OAuth 2.0 client secret
- GOOGLE_REDIRECT_URI: https://d36la414u58rw5.cloudfront.net

**Dependencies:**
- google-auth==2.27.0
- google-auth-oauthlib==1.2.0
- google-api-python-client==2.114.0

**What it does:**
1. **Auth check** (JWT required on all routes)
2. GET /gdrive/auth-url: Generates Google OAuth2 consent URL (offline access, drive.readonly scope)
3. POST /gdrive/callback: Exchanges authorization code for tokens, stores refresh_token in users table
4. GET /gdrive/files: Lists files in user's Google Drive (supports folder_id query param for navigation)
   - Returns folders and files with metadata (name, mimeType, size, modifiedTime)
   - Identifies Google Docs types for export (Docs→PDF, Sheets→CSV, Slides→PDF)
5. POST /gdrive/import: Downloads selected files from Drive, uploads to S3, records in uploads table
   - Google Docs exported automatically (Docs/Slides→PDF, Sheets→CSV)
   - Verifies client ownership before importing (WHERE s3_folder + user_id match)
   - Records each file with `source = 'google_drive'` in uploads table

**OAuth Flow:**
- Frontend opens Google consent URL in popup window
- User authorizes drive.readonly access
- Popup redirects back to CloudFront origin with auth code
- Parent window reads code from popup URL, closes popup
- Frontend sends code to POST /gdrive/callback
- Lambda exchanges code for refresh token, stores in users.google_drive_refresh_token

**File:** backend/lambdas/gdrive/lambda_function.py
**Deploy:** backend/lambdas/gdrive/deploy-gdrive.sh

---

## CLAUDE API INTEGRATION

**Default Model:** claude-sonnet-4-5-20250929 (user-selectable)
**Available Models:** claude-opus-4-6 (best), claude-sonnet-4-5-20250929 (default), claude-haiku-4-5-20251001 (fastest)
**Max Tokens:** 8000
**Temperature:** 0.7
**Model Selection:** Per-user preference stored in PostgreSQL, sent in /enrich request body

### Prompt Structure

**"First Party Trick" Analysis Prompt:**

```
You are an MBA-level business analyst conducting a First Party Trick analysis.
You have been given access to internal documents from a company. Analyze this
business and provide strategic insights.

COMPANY INFORMATION:
Company Name: {company_name}
Company Website: {website}
Primary Contact: {contact_name} ({contact_title})
Contact LinkedIn: {contact_linkedin}
Industry: {industry}
Description: {description}

CLIENT DATA (Uploaded Documents):
{extracted_text_from_files}

TASK:
Analyze this business like an MBA analyst presenting on Monday morning. Provide:

1. EXECUTIVE SUMMARY: 2-3 paragraph overview of the business, operations, and
   financial indicators based on the data provided.

2. PROBLEMS IDENTIFIED: Top 3-5 critical business problems. For each problem:
   - Title (clear, specific)
   - Severity (high/medium/low)
   - Evidence (specific data points from documents)
   - Recommendation (actionable solution)

3. PROPOSED DATA SCHEMA: Design a database schema to manage this business. Include:
   - 3-5 core tables
   - For each table: name, purpose, key columns (name, type, description)
   - Relationships between tables

4. 7/14/21 DAY ACTION PLAN:
   - 7-day: Build and demo -- prototype the solution to the primary pain point, get it on screen, show it live
   - 14-day: Validate and connect -- incorporate feedback, validate data connections, prepare for real deployment
   - 21-day: Deploy or decide -- go live with the solution or make the build/buy decision

OUTPUT FORMAT:
Return ONLY valid JSON in this exact structure:
{
  "status": "complete",
  "summary": "...",
  "problems": [...],
  "schema": {...},
  "plan": [...],
  "sources": [...]
}
```

**Response Parsing:**
- Strips markdown code fences if present (```json ... ```)
- Parses JSON response
- Adds metadata: analyzed_at timestamp, analyzed_files list
- Handles errors gracefully, returns error status if Claude call fails

---

## DEPLOYMENT PROCESS

### Frontend Deployment

**Build:**
```bash
cd /Users/ken_macair_2025/Desktop/xo-prototype
npm run build
```

**Deploy to S3:**
```bash
aws s3 sync dist/ s3://xo-prototype-frontend/ --delete --region us-west-1
```

**Invalidate CloudFront cache:**
```bash
aws cloudfront create-invalidation \
  --distribution-id EWNDD7ESKAW33 \
  --paths "/*"
```

**Complete flow:**
```bash
npm run build && \
aws s3 sync dist/ s3://xo-prototype-frontend/ --delete --region us-west-1 && \
aws cloudfront create-invalidation --distribution-id EWNDD7ESKAW33 --paths "/*"
```

---

### Backend Lambda Deployment

**xo-clients Lambda:**
```bash
cd backend/lambdas/clients
zip -r function.zip lambda_function.py
aws lambda update-function-code \
  --function-name xo-clients \
  --zip-file fileb://function.zip \
  --region us-west-1
```

**xo-upload Lambda:**
```bash
cd backend/lambdas/upload
zip -r function.zip lambda_function.py
aws lambda update-function-code \
  --function-name xo-upload \
  --zip-file fileb://function.zip \
  --region us-west-1
```

**xo-gdrive-import Lambda (with dependencies):**
```bash
cd backend/lambdas/gdrive
./deploy-gdrive.sh
aws lambda update-function-code \
  --function-name xo-gdrive-import \
  --zip-file fileb://function.zip \
  --region us-west-1
```

**xo-enrich Lambda (with dependencies):**
```bash
cd backend/lambdas/enrich
./deploy-enrich.sh
aws lambda update-function-code \
  --function-name xo-enrich \
  --zip-file fileb://function.zip \
  --region us-west-1
```

**xo-results Lambda:**
```bash
cd backend/lambdas/results
zip -r function.zip lambda_function.py
aws lambda update-function-code \
  --function-name xo-results \
  --zip-file fileb://function.zip \
  --region us-west-1
```

**Set Anthropic API Key:**
```bash
cd backend
./set-api-key.sh YOUR_ANTHROPIC_API_KEY
```

---

## FILE TYPES SUPPORTED

**Documents:**
- CSV (.csv)
- Text (.txt)
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)

**Data:**
- JSON (.json)
- XML (.xml)

**Archives:**
- ZIP (.zip)

**Audio:**
- MP3 (.mp3)
- WAV (.wav)
- M4A (.m4a)
- AAC (.aac)

**Total:** 15 file type extensions supported

**Frontend validation:** Both MIME type and file extension checking
**Backend extraction:** CSV, PDF, Excel, TXT currently implemented
**Pending:** Word, PowerPoint, JSON, XML, ZIP, Audio transcription

---

## BUILD HISTORY

**Session Date:** March 3, 2026
**Build Count:** 53 completed builds

**Build Order:**

1. **Project Scaffold** (Step 1)
   - Vite + React 18 setup
   - Base CSS adapted from Surgical Trays reference
   - Color scheme: Dark header (#1a1a2e), light body (#f0f0f0), red accent (#dc2626)
   - Header component with XO branding

2. **Upload Screen** (Step 2)
   - Company information form (name, description)
   - File upload with drag-and-drop
   - File list with remove buttons
   - Upload progress tracking

3. **Audio File Support**
   - Added MP3, WAV, M4A, AAC to supported types
   - Audio icon in file list

4. **Backend Infrastructure** (Step 3-5)
   - S3 bucket: xo-client-data
   - IAM role: xo-lambda-role with S3 permissions
   - Lambda: xo-clients (create client folders)
   - Lambda: xo-upload (presigned URLs)
   - API Gateway: xo-api with CORS
   - Tested end-to-end file upload to S3

5. **Enrich Lambda** (Step 6)
   - Lambda: xo-enrich with Claude API integration
   - Dependencies: anthropic, pypdf, openpyxl
   - Text extraction for CSV, PDF, Excel
   - "First Party Trick" prompt implementation
   - Lambda: xo-results to fetch analysis
   - set-api-key.sh helper script

6. **Frontend API Integration**
   - Connected upload screen to /clients and /upload endpoints
   - Real S3 uploads via presigned URLs
   - Enrich screen with progress tracking
   - Results screen with expandable sections

7. **Company Info Modal** (Step 7)
   - Added enrichment fields: website, contact name, contact title, LinkedIn, industry
   - Modal pattern from reference
   - Stored all fields in metadata.json
   - Updated /enrich Lambda to use enrichment context in Claude prompt

8. **Upload Screen Redesign** (Step 8)
   - Journey-based 3-step visual experience
   - Dark cards on light background
   - Numbered red circles (48px)
   - Embedded drop zone and "New Partner" button within steps
   - Step completion logic with visual feedback

9. **Upload Screen Fixes** (Step 9)
   - Corrected step order: Domain Expertise (1), Raw Data (2), Growth (3)
   - Compact horizontal layout (260px min-height cards)
   - Removed duplicate Domain Expertise card
   - Fixed card numbering
   - All three cards fit on screen without scrolling

10. **Branding Update**
    - Changed "XO Platform" to "XO Quickstart" (later renamed to "XO Capture" in v1.23)
    - Subtitle: "Rapid Prototype"
    - Updated index.html title tag

11. **Expanded File Types**
    - Added: .doc, .docx, .txt, .ppt, .pptx, .json, .xml, .zip
    - Updated drop zone label: "CSV, Excel, Word, PDF, Audio, and more"
    - Total 15 file extensions supported

12. **Mobile Responsive Design**
    - Cards stack vertically on <768px screens
    - Modal adapts to mobile width
    - Touch-friendly buttons (min 44px)
    - Scrollable modal body on mobile

13. **CloudFront Deployment**
    - Created S3 bucket: xo-prototype-frontend
    - Created CloudFront distribution: EWNDD7ESKAW33
    - Deployed production build
    - Public URL: https://d36la414u58rw5.cloudfront.net

14. **Git & GitHub**
    - Initialized git repository
    - Created .gitignore (excludes secrets, node_modules, dist)
    - Created GitHub repo: intellagentic/xo-quickstart
    - Pushed initial commit with full codebase

15. **Hamburger Menu Sidebar** (Session 2 - Feb 28, 2026)
    - Added Menu icon to header (top-left)
    - Slide-out sidebar panel from left (280px width, dark background)
    - Navigation menu items: Upload, Enrich, Results, Configuration
    - Active state highlighting with red accent
    - Close on outside click or X button

16. **Configuration Screen** (Shell Implementation)
    - Theme toggle: Sun/Moon icon with toggle switch (non-functional UI)
    - Configure Buttons section: draggable-looking cards with grip icons
    - Action icons: Copy, Edit, Delete per button card
    - Live Preview section: real-time button rendering preview
    - "+ Add Button" functionality placeholder

17. **Founder Quote Strip**
    - Added two editorial pull quotes below step cards
    - Alan Moore quote: "I wasn't leading. I was typing at 6:00 AM..."
    - Ken Scott quote: "We're business operators first, not technologists..."
    - Large decorative quotation marks (3.5rem, red, Georgia serif)
    - Side-by-side on desktop, stacked on mobile
    - Clean magazine/editorial aesthetic

18. **Intellagentic Logos**
    - Added logo-light.png to header (far right, 26px height)
    - Added logo-dark.png to assets (initially used in footer, later removed)
    - Logos imported as React assets

19. **Vertical Spacing Optimization**
    - Reduced step card height: 260px -> 220px
    - Reduced card padding: 1rem -> 0.875rem
    - Reduced card gap: 1rem -> 0.75rem
    - Reduced quote section margins and padding
    - Reduced quotation mark size: 4rem -> 3.5rem
    - All content now fits on screen without scrolling on standard laptop

20. **Logo Repositioning**
    - Moved Intellagentic logo from left to far right in header
    - Removed footer logo (logo-dark.png no longer displayed at bottom)
    - Final header layout: Hamburger | XO logo | Title | [space] | Intellagentic logo

21. **Skills Management Feature**
    - Added "Skills" menu item to hamburger sidebar (between Results and Configuration)
    - Created SkillsScreen component with skills list view
    - Created AddSkillModal for skill creation/editing
    - Skill modal features: name field, markdown content textarea (monospace), upload .md file option
    - Skills stored in S3 under {client_id}/skills/skill-name.md
    - Updated enrich Lambda to read skills from S3 and inject into Claude prompt
    - Added read_skills() function to Lambda
    - Skills appear as "DOMAIN-SPECIFIC SKILLS & INSTRUCTIONS" section in analysis prompt
    - Each skill can be viewed, edited, or deleted
    - Empty state guidance: "Add your first skill to enhance AI analysis"

22. **Card 3 Readability Improvements** (Session 3 - March 1, 2026)
    - Fixed disabled state opacity: removed layered opacity that made text unreadable
    - Changed background from semi-transparent rgba(26, 26, 46, 0.5) to solid #2a2a3e (lighter gray)
    - Increased text opacity from 30-40% range to 55-70% range for better contrast
    - Added visible border when disabled: 2px solid rgba(100, 100, 100, 0.3)
    - Lightened number circle background: rgba(100, 100, 100, 0.2) -> rgba(150, 150, 150, 0.3)
    - Lightened number circle text: #666 -> #999
    - Card now looks locked/pending rather than invisible (~60% visibility vs ~20%)

23. **Card 3 Branding Update**
    - Changed heading from "INTELLIGENT GROWTH" to "INTELLAGENTIC GROWTH"
    - Reinforces Intellagentic brand positioning
    - Deployed to production via CloudFront

24. **Light/Dark Theme Toggle** (Session 4 - February 28, 2026)
    - Added CSS variable system: `:root` (light) and `[data-theme="dark"]` selectors
    - Variables cover: body background, card background, inputs, borders, text colors, shadows, scrollbar
    - Theme state lifted to App root, applied via `data-theme` attribute on `<body>`
    - Persisted to localStorage (key: `xo-theme`), defaults to light
    - Working toggle in Configuration screen (toggle switch with Sun/Moon icons)
    - Working toggle in hamburger sidebar (bottom section)
    - All hardcoded colors in inline styles replaced with CSS variable references
    - Smooth 0.3s transition on background and color changes

25. **Configuration Screen -- Full Implementation**
    - Replaced shell implementation with Surgical Trays reference pattern
    - Left panel: "CONFIGURE BUTTONS" with "+ Add Button" (blue with glow shadow)
    - Button cards: drag handle (GripVertical), colored icon circle (hex + 20% opacity bg), label, color/icon metadata, URL display (blue text), edit/copy/delete action buttons
    - Inline editing panel (expands below card on edit click): label input, URL input, 8-color grid with checkmarks, 30+ icon grid (10 columns)
    - Drag-and-drop reordering via HTML5 draggable
    - Right panel: "LIVE PREVIEW" renders buttons with hex colors, glow shadows, icons
    - Theme-aware colors via `C` object (bg, surface, border, text, muted)
    - Animations: fadeIn, slideIn on card mount, card-hover/btn-hover transitions

26. **Button Configuration -- URL Field & Click Actions**
    - Added URL field to each button (stored in config, editable inline)
    - Placeholder text: `/enrich, /skills, or https://...`
    - URL displayed on card in blue text (truncated with ellipsis)
    - Welcome page buttons wired up and clickable:
      - Internal routes (`/upload`, `/enrich`, `/results`, `/skills`, `/configuration`) navigate to screen
      - External URLs (`https://...`) open in new tab with noopener/noreferrer
      - "New Partner" button opens company info modal
    - Route map: ROUTE_MAP constant maps URL paths to screen names

27. **Navigation Cleanup**
    - Added "Welcome" as first item in hamburger sidebar (Home icon), navigates to landing page
    - Removed top navigation tabs (Upload, Enrich, Results) -- sidebar handles all navigation
    - Removed "New Partner" and "Upload" from default action buttons (already in step cards 1 & 2)
    - Default action buttons: Enrich (/enrich), Skills (/skills)
    - Bumped localStorage key to `xo-buttons-v2` to reset stale data for all users
    - Button state lifted from ConfigurationScreen to App root (shared between Config and Welcome)

28. **Sidebar Navigation Fix**
    - Removed `disabled={!clientId}` restrictions from Enrich, Results, Skills menu items
    - Removed `opacity: 0.5` and `cursor: 'not-allowed'` on inactive items
    - Changed inactive item color from `rgba(255, 255, 255, 0.7)` to `#ffffff` (full white)
    - All sidebar items always clickable and navigate to their screen
    - Refactored sidebar nav from individual buttons to `.map()` loop over items array
    - Active item highlighted with red text (#dc2626) and red background tint

29. **Mobile Responsive Header**
    - Added `.header-title-desktop` and `.header-title-mobile` spans in header
    - Desktop shows "XO Capture", mobile (≤768px) shows "Rapid Prototype"
    - CSS media query swaps visibility: `.header-title-desktop` hidden, `.header-title-mobile` shown
    - Version badge hidden on mobile to save horizontal space
    - Deployed to production via CloudFront

30. **Immediate Pain Point Field**
    - Added "Immediate Pain Point" textarea to CompanyInfoModal (8th field, after Description)
    - Placeholder: "What's the one problem you need solved right now?"
    - Frontend sends `painPoint` in /clients API call
    - xo-clients Lambda stores as `pain_point` in metadata.json
    - xo-enrich Lambda reads `pain_point` from metadata, includes in enrichment context
    - When pain point is present, Claude prompt gets PRIORITY instruction:
      - Makes pain point the #1 problem in analysis
      - Leads executive summary with it
      - Front-loads 30-day action plan with steps addressing it
    - All three deployments updated: frontend, xo-clients Lambda, xo-enrich Lambda

31. **PostgreSQL Migration + Authentication** (Session 5 - February 28, 2026)
    - **RDS PostgreSQL 15** (db.t3.micro) replaces S3 metadata.json for structured data
    - Schema: 6 tables (users, clients, uploads, enrichments, skills, buttons)
    - 5 new DB columns (survival_metric_1, survival_metric_2, ai_persona, strategic_objective, tone_mode) -- no UI yet
    - **bcrypt auth + JWT tokens** (24h expiry)
    - New Lambda: xo-auth (POST /auth/login)
    - New Lambda: xo-buttons (GET /buttons, PUT /buttons/sync)
    - **Lambda layer** (xo-psycopg2): psycopg2, PyJWT, bcrypt for Python 3.11
    - **Shared auth_helper.py**: JWT verification + DB connection, copied into all Lambda packages
    - All 4 existing Lambdas migrated: auth check, PostgreSQL reads/writes, CORS Authorization header
    - xo-clients: S3 folders + DB INSERT (removed metadata.json write)
    - xo-upload: DB validation replaces S3 head_object, INSERT INTO uploads
    - xo-enrich: reads metadata from DB, enrichment tracking (processing/complete/error), skills from DB with S3 fallback
    - xo-results: checks enrichments table before S3, reads results_s3_key from DB
    - **LoginScreen** adapted from Surgical Trays reference (glassmorphism, slideUp/float animations)
    - XO red (#dc2626) replaces Surgical Trays navy (#325083)
    - Auth state: isLoggedIn, user, authToken in App root
    - Session restore from localStorage on mount (with JWT expiry check)
    - getAuthHeaders() helper on all 5 fetch() call sites
    - Sidebar: user name/email display, Sign Out button (red, LogOut icon)
    - **Buttons migrated to PostgreSQL**: fetchButtons() on login, saveButtons() syncs to API
    - CSS: .error-banner styles, @keyframes slideUp, @keyframes float
    - Deploy: updated deploy.sh (6 Lambdas), deploy-enrich.sh (auth_helper), new set-db-config.sh
    - Seed script: backend/seed.py (ken.scott@intellagentic.io + default buttons)
    - Files: 16 files created/modified

32. **Login Screen Redesign + Auth Enhancements** (Session 6 - February 28, 2026)
    - **Login screen redesign**: dark header / light body aesthetic matching main app
    - Header reuses exact same CSS classes as main app (header, header-inner, logo-box, header-title)
    - "Invitation" heading above form (uppercase, letter-spaced, elegant)
    - **Single form** for both new and returning users (no login/register toggle)
    - Button text: "Continue" (not "Sign In")
    - Helper text below form: "Enter your email and password to get started."
    - White form card on #f5f5f5 background, red focus states on inputs
    - **Auto-create backend**: /auth/login now creates accounts automatically if email doesn't exist
    - New account names derived from email prefix (ken.scott → Ken Scott)
    - Existing users: bcrypt password verification as before
    - **New API endpoints**: POST /auth/register (explicit), POST /auth/reset-password (prototype)
    - API Gateway routes added for /auth/register and /auth/reset-password
    - Lambda permissions configured for all new routes
    - Seed admin email updated to ken.scott@intellagentic.io across all files
    - Frontend build: ~215 KB JS (reduced from ~220 KB by removing mode switching code)

33. **Google Drive Connector** (Session 7 - February 28, 2026)
    - **New Lambda: xo-gdrive-import** (Python 3.11, 512 MB, 120s timeout)
    - 4 routes: GET /gdrive/auth-url, POST /gdrive/callback, GET /gdrive/files, POST /gdrive/import
    - **Google OAuth2 popup flow**: consent URL → popup → redirect → code exchange → refresh token stored in DB
    - Dependencies: google-auth, google-auth-oauthlib, google-api-python-client
    - Google Docs auto-export: Docs/Slides→PDF, Sheets→CSV
    - **DB migration**: 3 new columns (users.google_drive_refresh_token, users.google_drive_connected_at, uploads.source)
    - uploads.source defaults to 'manual', Google Drive imports recorded as 'google_drive'
    - **Frontend Sources strip**: 5 connector pills below drop zone (Upload, Google Drive, NotebookLM, Dropbox, OneDrive)
    - Upload and Google Drive are active connectors; NotebookLM, Dropbox, OneDrive grayed out (future)
    - **Google Drive file picker modal**: dark modal with folder navigation, file selection, import button
    - Folder navigation with back button and breadcrumb stack
    - File count display updated: "3 files selected (1 from Drive)"
    - Upload logic updated: manual files get presigned URLs, imported files skip S3 PUT (already in S3)
    - API Gateway: 4 new routes with OPTIONS, AWS_PROXY integration, Lambda invoke permission
    - Deploy scripts updated: set-db-config.sh (7 Lambdas), deploy.sh notes
    - Frontend build: ~224 KB JS
    - Files: 7 files created/modified

34. **Session Persistence Fix** (Session 8 - March 1, 2026)
    - **Root cause**: `isTokenExpired()` used `atob()` which can fail on JWT URL-safe base64 (`-` and `_` chars)
    - When `atob()` threw, catch block returned `true` (expired) → session silently cleared on restore
    - **Fix 1**: `isTokenExpired()` now converts URL-safe base64 to standard (`-`→`+`, `_`→`/`) and adds padding before `atob()`
    - **Fix 2**: Session restore moved from `useEffect` (async, after first render) to synchronous `useState` initializer
    - Old behavior: App always rendered LoginScreen first, then useEffect restored session on next tick → flash of login screen
    - New behavior: `getInitialAuth()` reads localStorage synchronously before first render → no flash, no race condition
    - `getInitialAuth()` wrapped in try/catch for JSON parse and localStorage errors → graceful fallback to logged-out state
    - Debug confirmed: backend `/auth/login` returns valid tokens, `getAuthHeaders()` sends Bearer token correctly
    - Deployed to production via CloudFront invalidation

35. **Model Selector + Opus Default** (Session 8 - March 1, 2026)
    - **AI Model selector** in Configuration screen: radio-button cards for Opus 4.5 and Sonnet 4.5
    - Opus 4.5 is default (best analysis quality); Sonnet 4.5 available (faster, cheaper)
    - Per-user preference stored in PostgreSQL (`users.preferred_model` column)
    - **DB migration**: `ALTER TABLE users ADD COLUMN preferred_model VARCHAR(100) DEFAULT 'claude-opus-4-5-20250529'`
    - **New API route**: PUT /auth/preferences (validates model against allowed list, updates DB)
    - **xo-auth Lambda updated**: login response includes `preferred_model`, new `handle_preferences` endpoint
    - **xo-enrich Lambda updated**: reads model from request body → user DB preference → default Opus
      - `analyze_with_claude()` now accepts `model` parameter
      - Lambda timeout increased from 120s to 300s (5 minutes) for Opus response times
    - **Frontend**: model selector with purple (Opus) and blue (Sonnet) accent cards
    - **Enrich screen**: model badge in header (purple "Opus 4.5" / blue "Sonnet 4.5")
    - **EnrichScreen** sends `model: preferredModel` in /enrich request body
    - API Gateway: /auth/preferences resource with PUT + OPTIONS, Lambda invoke permissions
    - Frontend build: ~226 KB JS
    - Deployed: xo-auth Lambda, xo-enrich Lambda, frontend, CloudFront invalidation

36. **Audio Transcription + Context Metadata** (Session 9 - March 1, 2026)
    - **AWS Transcribe integration** for MP3, WAV, M4A, AAC, OGG, FLAC, WMA files
    - Audio files now transcribed during enrichment and included in Claude analysis
    - **Async Lambda pattern**: xo-enrich refactored to two-phase execution
      - Phase 1 (synchronous, <2s): auth, validate, create enrichment record, self-invoke async → return immediately
      - Phase 2 (async invocation): extract text → transcribe audio → analyze with Claude → write results
      - Fixes API Gateway 29-second timeout for large enrichments
    - **Stage tracking**: new `enrichments.stage` DB column (extracting → transcribing → researching → analyzing → complete)
      - xo-results Lambda returns `stage` in polling response
      - Frontend stage tracker already wired (5 stages with icons including "Transcribing Audio")
    - **Transcription pipeline**: `find_audio_files()` → `transcribe_single_file()` (poll every 5s, max 240s) → `read_transcribe_output()`
    - Transcripts saved to `{client_id}/extracted/{filename}.transcript.txt`
    - Raw Transcribe output saved to `{client_id}/extracted/.transcribe-output/{filename}.json`
    - **Audio context metadata**: per-audio-file context form in upload screen
      - Date of recording (date picker, defaults to today)
      - Participants (text field, e.g., "Ken Scott, Alan Moore")
      - Context/Topic (text field, e.g., "Weekly strategy call")
      - Saved as `{filename}.context.json` alongside audio in S3 uploads folder
    - **Context-aware transcripts**: enrich Lambda reads context JSON and prepends to each transcript:
      `"Audio Transcript (file.mp3) -- Date: 2026-03-01 -- Participants: Ken, Alan -- Topic: Strategy call"`
    - `extract_all_files()` skips audio files (handled by Transcribe) and `.context.json` files (metadata only)
    - **DB migration**: `ALTER TABLE enrichments ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'extracting'`
    - **IAM**: transcribe:StartTranscriptionJob, transcribe:GetTranscriptionJob, lambda:InvokeFunction (self-invoke)
    - Frontend build: ~229 KB JS
    - Deployed: xo-enrich Lambda, xo-results Lambda, frontend, CloudFront invalidation, DB migration
    - Files: 4 files modified (schema.sql, enrich/lambda_function.py, results/lambda_function.py, App.jsx)

37. **Enrichment Templates, Structured Output, Client Config** (Session 9 - March 1, 2026)
    - **Default skill template** (`backend/templates/default-skill.md`): ships with every new client
      - 5 sections: Context, Focus Areas, Ignore List, Output Format, Authority Boundaries
      - Editable via Skills screen -- customizes how Claude analyzes each client
      - xo-clients Lambda copies `analysis-template.md` to `{client_id}/skills/` on client creation
      - Skill record inserted into DB (skills table) so it appears in Skills screen immediately
    - **Structured output prompt**: complete rewrite of the First Party Trick prompt
      - ASCII architecture diagrams (box-drawing characters) for proposed systems
      - Table-format database schemas (Column | Type | Description)
      - Schema relationships as explicit `table.column -> table.column` declarations
      - Numbered, measurable actions in 7/14/21 day plan
      - Bottom Line section: direct CEO-level summary (what to do, what it costs, what to expect)
      - New JSON fields: `architecture_diagram`, `schema.relationships`, `bottom_line`
    - **Client config** (`{client_id}/client-config.md`): generated on client creation
      - Structured context document from New Partner form inputs
      - Sections: Company Profile, Primary Contact, Immediate Pain Point, Analysis Instructions
      - Injected into every Claude call as persistent context (like CLAUDE.md for each client)
      - Read by enrich Lambda via `read_client_config()` function
    - **Frontend Results screen enhancements**:
      - New "Bottom Line" panel with red accent bar (appears first, after summary)
      - New "Proposed Architecture" panel with monospace pre-formatted ASCII diagram
      - Schema relationships section below table definitions
    - Frontend build: ~231 KB JS
    - Deployed: xo-clients Lambda, xo-enrich Lambda, frontend, CloudFront invalidation
    - Files: 5 files created/modified (default-skill.md, clients/lambda_function.py, enrich/lambda_function.py, App.jsx, CLAUDE.md)

38. **System Skills Layer + Enrichment Info Popover** (Session 9 - March 1, 2026)
    - **System skills** (`backend/system-skills/`): 4 markdown files always injected into every enrichment call
      - `analysis-framework.md` -- Revenue drivers, cost structure, operational bottlenecks, competitive position, risk factors; quantification rules
      - `output-format.md` -- Numbered sections, table schemas, severity ratings, confidence scores, source citations, bottom line format
      - `authority-boundaries.md` -- What to recommend directly vs flag for human review; hard rules (never recommend firing, never give legal advice, caveat financials)
      - `enrichment-process.md` -- Data source hierarchy: client data (ground truth) > context > audio transcripts > web research > inferred patterns
    - **Three-tier skill injection order** in Claude prompt:
      1. System skills (always, bundled with Lambda, not client-visible)
      2. Client config (client-config.md, generated from partner form)
      3. Client/domain skills (editable in Skills screen, customizable per client)
    - `load_system_skills()` reads from `system-skills/` directory bundled in Lambda package
    - `deploy-enrich.sh` updated to copy `system-skills/*.md` into Lambda package
    - **System Skills section in Configuration screen**: read-only admin view showing all 4 system skills with lock icon and descriptions
    - **Enrichment info popover** on Enrich screen:
      - Info icon (circle) next to Start Enrichment button
      - Click shows popover with 6 numbered steps: Extract, Context, Skills, Web Research, AI Analysis, Output
      - Shows current model badge (Opus/Sonnet) with "Change model in Configuration" hint
      - Dismisses on click outside
    - Frontend build: ~235 KB JS
    - Deployed: xo-enrich Lambda (with system-skills), frontend, CloudFront invalidation
    - Files: 8 files created/modified (4 system-skills .md files, deploy-enrich.sh, enrich/lambda_function.py, App.jsx)

39. **Simplified Skill Creation Form** (Session 10 - March 1, 2026)
    - **Replaced raw markdown textarea** in AddSkillModal with structured plain-English form
    - Four guided fields (no markdown knowledge required):
      - "What should the AI focus on?" -- metrics, problems, themes to prioritize
      - "What should the AI ignore or avoid?" -- topics and assumptions to skip
      - "What does success look like?" -- desired outcomes for the analysis
      - "Any industry terms or jargon to know?" -- domain-specific vocabulary
    - Each field has descriptive hints and placeholder examples
    - **Auto-converts to markdown** behind the scenes via `buildMarkdown()` -- user never sees or writes markdown
    - **Edit mode**: parses existing skill markdown back into structured fields via regex section extraction
    - **Upload mode preserved** for power users: "Advanced: Upload .md file" toggle (accepts .md and .txt)
    - Upload shows file loaded confirmation with character count
    - Tip text updated: "Answer in plain English. The AI will use your answers to guide its analysis."
    - Frontend build: ~238 KB JS
    - Deployed: frontend to S3, CloudFront invalidation
    - Files: 1 file modified (App.jsx)

40. **Skills Empty State & Context Text** (Session 10 - March 1, 2026)
    - **Fixed infinite spinner bug**: When `clientId` is falsy, `fetchSkills` never ran so `loading` stayed `true` forever — added `else { setLoading(false) }` fallback
    - **Improved empty state**: Updated message to "No skills yet. Skills guide how the AI analyzes your business. Add your first skill to get started." with an inline + Add Skill button
    - **Added context text** below Skills header: "Skills teach the AI what to focus on, what to ignore, and what success looks like for your business. Think of them as instructions for your analyst."
    - Frontend build: ~238 KB JS
    - Deployed: frontend to S3, CloudFront invalidation
    - Files: 1 file modified (App.jsx)

41. **Design Consistency + Duplicate Button Fix** (Session 10 - March 1, 2026)
    - **Removed duplicate "+ Add Skill" button** from empty state body — only one in header bar
    - **Restructured Skills screen** to match Enrich screen layout pattern:
      - Single `<div className="panel">` wrapping entire screen (was separate header + list panels)
      - `panel-header` with icon + title + badge + action button on right
      - Inner body `<div style={{ padding: '1.25rem' }}>` matching Enrich padding
    - **Empty state now matches Enrich "Ready to Enrich" design**:
      - Centered icon at `size={64}`, red color, `opacity: 0.5` (same as Sparkles icon on Enrich)
      - Bold heading "No Skills Yet" at `1.125rem` / `fontWeight: 600` (same as "Ready to Enrich Your Data")
      - Description text at `0.875rem`, `color: var(--text-secondary)`, `lineHeight: 1.6` (matches Enrich description)
      - Subtle hint: 'Click **+ Add Skill** above to get started.' in muted text
    - **Context text moved** from standalone paragraph into the centered empty state body
    - **Loading state** also redesigned to match: centered spinner icon at 64px, heading "Loading Skills"
    - **Skill cards** use bordered rows within the single panel body (no nested panels)
    - Frontend build: ~238 KB JS
    - Deployed: frontend to S3, CloudFront invalidation
    - Files: 1 file modified (App.jsx)

42. **Enrichment Info Modal** (Session 10 - March 1, 2026)
    - **Replaced clipped popover** with centered modal overlay — enrichment info was opening downward and falling off screen
    - Uses `modal-overlay` class (same as other modals) for consistent backdrop + centering
    - Card: 400px wide, `maxWidth: 90vw`, rounded corners, shadow
    - Header row with title + X close button
    - Same 6-step content, slightly larger text for readability (0.85rem labels, 0.8rem descriptions)
    - Dismiss on click outside (overlay) or X button
    - Model badge + "Change model in Configuration" footer preserved
    - Frontend build: ~239 KB JS
    - Deployed: frontend to S3, CloudFront invalidation
    - Files: 1 file modified (App.jsx)

43. **Source Library** (Session 11 - March 1, 2026)
    - **New SourcesScreen component** (~400 lines): NotebookLM-style source management
      - **Source Library panel**: card list with file type icon, filename, version badge (v2/v3), source pill (Local/Google Drive), file size, date, active/inactive toggle, kebab menu (Replace, Delete)
      - **Add Sources panel**: drag-and-drop zone with immediate upload, sources strip (Upload, Google Drive, NotebookLM, Dropbox, OneDrive), Google Drive picker modal
      - Summary bar: "X active · Y total · Z MB"
      - Delete confirmation modal, replace with version linking
      - Empty state + no-clientId state
    - **Sidebar**: "Sources" added between Welcome and Enrich (FolderOpen icon)
    - **UploadScreen Step 2 refactored**: Full drag-drop zone replaced with compact summary (source count + "Manage Sources" button). Google Drive code moved to SourcesScreen.
    - **CompanyInfoModal**: Now creates client on save (so Sources screen has clientId for uploads)
    - **Upload button renamed** to "Continue to Enrichment" (files already uploaded via Sources)
    - **DB migration**: 5 new columns on uploads table (status, file_size, version, parent_upload_id, replaced_at) + 2 indexes
    - **Upload Lambda rewritten** as method router: POST /upload + GET /uploads + DELETE /uploads/{id} + PUT /uploads/{id}/toggle + POST /uploads/{id}/replace
    - **Enrich Lambda updated**: Queries active S3 keys from DB, passes to extract_all_files, skips inactive/deleted files
    - Frontend build: ~248 KB JS
    - Branch: feature/source-library
    - Files: 4 files modified (App.jsx, schema.sql, upload/lambda_function.py, enrich/lambda_function.py)

44. **UI Polish, Domain Persistence, Source Library Fixes** (Session 12 - March 1, 2026)
    - **Forgot Password**: Added "Forgot Password?" link + reset form on login screen (email, new password, confirm). Uses POST /auth/reset-password.
    - **clientId persistence**: Fixed Source Library "Complete Domain Expertise First" bug -- clientId now persisted to localStorage, cleared on logout.
    - **Domain Expertise persistence**: Clients Lambda rewritten as method router (GET/PUT/POST). Frontend fetches existing client data on login, pre-populates CompanyInfoModal. Save does upsert (PUT if exists, POST if new). API Gateway routes added for GET/PUT /clients.
    - **Welcome screen cleanup**:
      - Removed redundant "Continue to Enrichment" bar from bottom of page
      - Removed duplicate Enrich/Skills buttons from "AI-Powered Business Intelligence" section
      - Moved Enrich (green #22c55e) and Skills (blue #3B82F6) buttons into Intellagentic Growth card (card 3)
      - Skills button above Enrich button
    - **Source Library kebab menu fixes**:
      - Fixed dropdown overflow: overrode `.panel` `overflow:hidden` with inline `overflow:visible`
      - Wrapper uses `position:relative`, dropdown uses `right:0, top:100%`
      - Restyled: white background, dark text (#1a1a1a), subtle border (#e5e7eb), soft box-shadow
      - Added View menu item (opens S3 URL), divider before Delete (red text)
      - Hover states: #f3f4f6 for View/Replace, #fef2f2 for Delete
    - **Connector pills visibility**: Google Drive + coming-soon pills now use CSS variables for theme compatibility
    - **Upload status default**: Upload Lambda explicitly sets `status='active'` on INSERT (both upload and replace handlers). DB column enforced as NOT NULL DEFAULT 'active'. Fixed existing inactive rows.
    - Branch: feature/source-library
    - Files: App.jsx, clients/lambda_function.py, upload/lambda_function.py

45. **Fix xo-enrich Lambda pydantic_core Import Error** (Session 13 - March 2, 2026)
    - **Root cause**: Local `pip3` is Python 3.14 (macOS ARM). `pip3 install -t package/` installed `pydantic_core` compiled as `cpython-314-darwin.so` — wrong Python version (3.14 vs 3.11) and wrong platform (macOS ARM vs Amazon Linux x86_64).
    - **Symptom**: `[ERROR] Runtime.ImportModuleError: Unable to import module 'lambda_function': No module named 'pydantic_core._pydantic_core'` — all enrichment requests failing.
    - **Fix**: Updated `deploy-enrich.sh` to use platform-targeting flags: `--platform manylinux2014_x86_64 --implementation cp --python-version 3.11 --only-binary=:all:`
    - **Result**: `pydantic_core/_pydantic_core.cpython-311-x86_64-linux-gnu.so` — correct binary for Lambda runtime
    - **Also fixed**: `deploy-gdrive.sh` with same platform flags to prevent future issues
    - Deployed xo-enrich Lambda, verified clean INIT and 200 response
    - Files: deploy-enrich.sh, deploy-gdrive.sh

46. **Delete Modal Contrast Fix** (Session 13 - March 2, 2026)
    - **Delete confirmation modal** on Source Library had low-contrast text (CSS variables blending into dark overlay)
    - Fixed with hardcoded light colors (same pattern as kebab menu fix, build #43):
      - Card background: `#ffffff` with `#e5e7eb` border and depth shadow
      - Heading "Delete Source?": `#1a1a1a` (dark black)
      - Description text: `#444444` (dark gray, was `#6b7280`)
      - Cancel button: `#f3f4f6` background, `#333333` text, `#d1d5db` border
      - Delete button: `#ef4444` background, `#ffffff` text
    - Files: App.jsx

47. **Fix xo-enrich Lambda Self-Invoke Permission** (Session 13 - March 2, 2026)
    - **Root cause**: `xo-lambda-role` IAM role missing `lambda:InvokeFunction` permission
    - xo-enrich uses async self-invoke pattern (Phase 1 calls itself for Phase 2) but the IAM policy was never attached
    - Error: `AccessDeniedException: User xo-lambda-role/xo-enrich is not authorized to perform lambda:InvokeFunction`
    - **Fix**: Added inline IAM policy `xo-lambda-invoke` to `xo-lambda-role`:
      - `lambda:InvokeFunction` on `arn:aws:lambda:us-west-1:941377154043:function:xo-enrich`
      - `transcribe:StartTranscriptionJob` + `transcribe:GetTranscriptionJob` on `*`
    - Verified clean execution with no AccessDeniedException

48. **Model ID Update — Opus 4.6, Sonnet 4.5, Haiku 4.5** (Session 13 - March 2, 2026)
    - **Updated all model IDs** across the entire stack (4 files, 14 occurrences):
      - Old default: `claude-opus-4-5-20250529` → New default: `claude-sonnet-4-5-20250929`
      - Old allowed: `[claude-opus-4-5-20250529, claude-sonnet-4-20250514]` → New allowed: `[claude-opus-4-6, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001]`
    - **xo-enrich Lambda**: updated defaults, allowed list, Phase 2 fallback, `analyze_with_claude()` default parameter
    - **xo-auth Lambda**: updated `_success_response` default, DB query COALESCE default, `handle_preferences` allowed list
    - **Frontend (App.jsx)**: updated MODEL_LABELS (3 entries), Configuration selector (3 cards: Opus purple, Sonnet blue, Haiku green), default preferredModel
    - **schema.sql**: updated `preferred_model` column default
    - **Configuration screen** now shows 3 model cards:
      - Claude Opus 4.6 (purple #a855f7) — Best analysis, deeper reasoning
      - Claude Sonnet 4.5 (blue #3b82f6) — Balanced speed and quality (default)
      - Claude Haiku 4.5 (green #22c55e) — Fastest responses, lowest cost
    - Deployed: xo-enrich Lambda, xo-auth Lambda, frontend to S3/CloudFront
    - Files: App.jsx, auth/lambda_function.py, enrich/lambda_function.py, schema.sql

49. **Add .docx Extraction to Enrich Lambda** (Session 13 - March 2, 2026)
    - Enrichment failed when only .docx files uploaded — `extract_text()` returned "Unsupported file type: docx"
    - Added `extract_docx()` function using `python-docx` library: extracts paragraph text + table content (rows with pipe-delimited cells)
    - Added `python-docx==1.1.2` to requirements.txt (package size 7.5MB → 13MB)
    - Updated `extract_text()` routing: `docx`/`doc` extensions → `extract_docx()`
    - Deployed and verified: .docx files now extracted successfully
    - Files: enrich/lambda_function.py, enrich/requirements.txt

50. **Frontend Polling Resilience** (Session 13 - March 2, 2026)
    - Frontend showed "Enrichment Failed" because a single failed poll request killed all polling (zero error tolerance)
    - **Fix 1 — Retry tolerance**: Allows up to 5 consecutive failed poll requests before giving up (resets on success)
    - **Fix 2 — 5-minute max timeout**: Polling stops after 5 minutes with helpful message ("Check Results tab — it may have completed")
    - **Fix 3 — Poll interval**: Changed from 2s to 3s (reduces transient failure chance)
    - **Fix 4 — Results Lambda**: Always sets `results['status'] = 'complete'` on response instead of relying on Claude JSON output
    - Deployed: xo-results Lambda + frontend to S3/CloudFront
    - Files: App.jsx, results/lambda_function.py

51. **Fix Claude JSON Truncation — max_tokens + JSON Repair** (Session 13 - March 2, 2026)
    - **Root cause**: `max_tokens=8000` too small for analysis response. Claude's ~28K char response hit the token limit mid-JSON-string, producing `Unterminated string starting at: line 179 column 18 (char 28618)`. Error handler wrote empty results to S3.
    - **Fix 1 — Increased `max_tokens`**: 8000 → 16000 (primary fix — 16K tokens ≈ 64K chars, well above typical responses)
    - **Fix 2 — JSON repair function** (`_repair_truncated_json`): Safety net that closes unclosed strings, strips trailing commas, closes unclosed `[]`/`{}` brackets in correct order. Recovers partial analysis instead of returning empty results.
    - **Fix 3 — Better logging**: Logs `Claude response: {len} chars, stop_reason={stop_reason}` to CloudWatch for debugging truncation vs completion
    - Deployed xo-enrich Lambda
    - Files: enrich/lambda_function.py

52. **Google OAuth Login + Multi-Client Admin Dashboard** (Session 14 - March 3, 2026)
    - **Google OAuth login** for admin users via Google Identity Services (GIS) library
      - Frontend: Google Sign-In button as primary, "Sign in with email instead" link for fallback
      - Backend: `POST /auth/google` — verifies Google ID token via Google's tokeninfo endpoint (stdlib `urllib`, no new deps)
      - Hardcoded `ALLOWED_EMAILS` list: 4 admin emails (alan.moore@intellagentic.io, ken.scott@intellagentic.io, rs@multiversant.com, vn@multiversant.com)
      - Google users created with sentinel `password_hash='google-oauth-no-password'` (blocks password login)
      - JWT includes `is_admin` flag; frontend uses it to show dashboard vs single-client flow
    - **Admin Dashboard** (`DashboardScreen` component)
      - Fetches `GET /clients/list` — returns all clients with source count, enrichment status/date
      - Grid of client cards: company name, industry badge, source count, enrichment status badge (none/processing/complete/error), last enrichment date
      - Click card → fetches full client data, enters workspace scoped to that client
      - "+ New Client" button → opens CompanyInfoModal → creates client → enters workspace
      - Empty state, loading state, error state with retry
    - **Sidebar update**: "All Clients" (Building2 icon) at top for admin users, with divider
    - **Header subtitle**: "Client Dashboard" when on dashboard, company name in workspace
    - **API Gateway**: Added `/auth/google` (POST+OPTIONS → xo-auth), `/clients/list` (GET+OPTIONS → xo-clients), deployed to prod
    - **GOOGLE_CLIENT_ID** env var added to xo-auth Lambda (same value from xo-gdrive-import)
    - Self-serve email/password login preserved — non-admin users go straight to single-client workspace
    - Files: auth/lambda_function.py, clients/lambda_function.py, shared/auth_helper.py, App.jsx

53. **Add vn@multiversant.com to Allowed Admin Emails** (Session 14 - March 3, 2026)
    - Added Vamsi Nama (vn@multiversant.com) to ALLOWED_EMAILS list in xo-auth Lambda
    - Redeployed xo-auth Lambda
    - Files: auth/lambda_function.py

54. **Client Logo & Icon Branding** (Session 15 - March 3, 2026)
    - **Database**: Added `logo_s3_key` and `icon_s3_key` VARCHAR(500) columns to clients table
    - **Upload Lambda** — 2 new endpoints:
      - `POST /upload/branding` — presigned PUT URL for logo or icon, stores S3 key in clients table
      - `GET /upload/branding?client_id=X` — presigned GET URLs for viewing logo/icon
      - Validates content type (PNG, JPG, SVG, WebP), overwrites previous on re-upload
    - **Clients Lambda** — presigned URLs generated server-side:
      - `GET /clients/list` returns `icon_url` per client (presigned GET, 1h expiry) for dashboard cards
      - `GET /clients` returns `logo_url` and `icon_url` for workspace header
    - **Enrich Lambda** — webhook payload updated:
      - `client_logo_url` and `client_icon_url` (direct S3 URLs) added to Streamline webhook
      - Both `_run_enrichment_pipeline` and `_handle_send_to_streamline` include branding
    - **Frontend (App.jsx)**:
      - **CompanyInfoModal** — "Client Branding" section with drag-and-drop/click upload zones for logo (400x100px) and icon (128x128px), thumbnail previews, 2MB client-side validation
      - **Dashboard cards** — 32x32px client icon to left of company name, letter-in-circle fallback
      - **Workspace header** — client logo (20px height) next to company name in subtitle
      - `companyData` state extended with `logoUrl`/`iconUrl`, populated from API responses
    - S3 folder structure: `{client_id}/branding/logo.{ext}` and `{client_id}/branding/icon.{ext}`
    - **Deployment needed**: SQL migration, 3 Lambdas (upload, clients, enrich), API Gateway route `/upload/branding` (GET+POST+OPTIONS), frontend build
    - Files: schema.sql, upload/lambda_function.py, clients/lambda_function.py, enrich/lambda_function.py, App.jsx

55. **Branding Screen — Dedicated Sidebar Page** (Session 15 - March 3, 2026)
    - Moved branding upload from hidden-in-modal to a **dedicated BrandingScreen** component
    - **Sidebar**: Added "Branding" item (Image icon) between Configuration and Light/Dark Mode toggle
      - Only visible when inside a client workspace (hidden on All Clients dashboard)
    - **BrandingScreen** (full page, max-width 700px centered):
      - Company Logo card — large drop zone with drag-and-drop + click-to-browse, preview after upload, "Click or drop to replace" hint
      - Company Icon card — same pattern, square format
      - Preview section (appears after upload): header logo mockup (dark bar with XO box + logo), dashboard card icon mockup (icon + company name)
      - No-client empty state: "No Client Selected" with guidance message
    - Branding upload still also available in CompanyInfoModal (compact version at bottom)
    - Deployed frontend to S3/CloudFront
    - Files: App.jsx

56. **Streamline Webhook Toggle** (Session 15 - March 3, 2026)
    - **Database**: Added `streamline_webhook_enabled BOOLEAN DEFAULT FALSE` to clients table
    - **Clients Lambda**:
      - `GET /clients` returns `streamline_webhook_enabled` in response
      - `PUT /clients` accepts and persists `streamline_webhook_enabled` (optional field, only updated if present)
    - **Enrich Lambda**:
      - Reads `streamline_webhook_enabled` from clients table in `_run_enrichment_pipeline`
      - Only fires `_send_streamline_webhook()` if flag is true
      - Logs "Streamline webhook disabled for client" when skipped
      - `POST /send-to-streamline` (manual button) unaffected — always works as manual override
    - **Frontend (ConfigurationScreen)**:
      - "Streamline Webhook" panel (Send icon) between System Skills and Configure Buttons
      - Toggle switch: "Send to Streamline" with description, default OFF
      - Persists immediately to DB via `PUT /clients` on toggle
      - Webhook URL displayed read-only below toggle
      - Note: "Send to Streamline button on Results screen works regardless of this toggle"
      - Only shown when inside a client workspace (requires `clientId`)
    - Deployed frontend to S3/CloudFront
    - Files: schema.sql, clients/lambda_function.py, enrich/lambda_function.py, App.jsx

57. **Backend Deployment — Branding + Webhook** (Session 16 - March 3, 2026)
    - **SQL Migration**: Ran 3 ALTER TABLE statements via Python/psycopg2 (logo_s3_key, icon_s3_key, streamline_webhook_enabled)
    - **Lambda Deployments**:
      - xo-clients: Updated with branding presigned URLs + webhook toggle fields
      - xo-upload: Updated with `handle_branding_upload()` and `handle_branding_get()` endpoints
      - xo-enrich: Updated with branding in webhook payload + webhook enabled check
    - **API Gateway**: Created `/upload/branding` resource with POST, GET, OPTIONS methods → xo-upload Lambda
    - Added Lambda invoke permission for API Gateway → xo-upload on branding route
    - Deployed API Gateway to prod stage
    - All v1.25–v1.27 backend changes now live

58. **Client Context Bar** (Session 17 - March 3, 2026)
    - Added secondary context bar below the main "XO Capture" header, visible only inside client workspaces
    - **Left side**: "Back to All Clients" link with ChevronLeft icon → navigates to dashboard
    - **Right side**: Client icon (28px with letter fallback), company name (bold), industry pill badge
    - Conditionally rendered: hidden on dashboard, shown when `clientId` is set
    - Simplified header subtitle: removed duplicate company name/logo from main header; shows "Domain Partner Onboarding" in workspace
    - Reused existing patterns: icon fallback from dashboard cards, `navigateTo()`, `companyData` state
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

59. **Client Banner & Header Cleanup** (Session 17 - March 3, 2026)
    - **Header**: Renamed "XO Capture" → "Capture" (XO logo-box already present, text was redundant)
    - **Header subtitle**: Removed entirely in workspace view; only shows "Client Dashboard" on dashboard
    - **Removed context bar** from session 58 — replaced with in-page client identity banner
    - **Client Identity Banner**: Rendered inside `<main>` above screen content (between header and dark cards)
      - Client logo (44px, `companyData.logoUrl`) or letter fallback (44px dark circle, red letter)
      - Company name (1.25rem, bold)
      - "Client Workspace" label below in subtle text
    - Navigation back to dashboard remains in sidebar ("All Clients")
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

60. **Client Banner — Logo-only mode** (Session 17 - March 3, 2026)
    - **With logo**: Shows only the logo image + "Client Workspace" subtitle (no company name text — logo speaks for itself)
    - **Without logo**: Shows letter fallback icon + company name (bold) + "Client Workspace" subtitle
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

61. **Contact Email & Phone Fields** (Session 17 - March 3, 2026)
    - **Frontend**: Added "Contact Email" (email input) and "Contact Phone" (text input for international formats like +44, +1) to Domain Expertise form, between Contact Title and LinkedIn
    - **Database**: Added `contact_email VARCHAR(500)` and `contact_phone VARCHAR(100)` columns to clients table via migration
    - **Clients Lambda**: GET returns `contactEmail`/`contactPhone`, PUT/POST persist both fields, `generate_client_config()` includes email/phone in Primary Contact section
    - **Enrich Lambda**: Reads `contact_email`/`contact_phone` from DB, passes to Streamline webhook as `client_email`/`client_phone`
    - **Schema**: Added ALTER TABLE statements in `schema.sql`
    - Files: `src/App.jsx`, `backend/lambdas/clients/lambda_function.py`, `backend/lambdas/enrich/lambda_function.py`, `backend/schema.sql`
    - Deployed: frontend (S3/CloudFront), xo-clients Lambda, xo-enrich Lambda

62. **Fix xo-clients Lambda — missing auth_helper** (Session 17 - March 3, 2026)
    - **Root cause**: Session 61 deploy zipped only `clients/` directory, missing `auth_helper.py` from `backend/lambdas/shared/`
    - Lambda failed with `Runtime.ImportModuleError: No module named 'auth_helper'`
    - **Fix**: Copied `auth_helper.py` into zip alongside `lambda_function.py`, redeployed
    - Verified: Lambda returns 401 (correct — no auth token in test), no more import errors
    - Dashboard `/clients/list` endpoint restored

63. **Client Banner — show uploaded icon/logo** (Session 17 - March 3, 2026)
    - Banner now uses priority: logo → icon → letter fallback (previously skipped icon)
    - Branding upload state refresh already working (both CompanyInfoModal and BrandingScreen call `setCompanyData` after upload)
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

64. **Video/Audio File Support** (Session 17 - March 3, 2026)
    - **Frontend**: Added `.mp4`, `.webm` to file picker accept list; helper text now reads "Video, Audio"
    - **Enrich Lambda**: Added `mp4`, `webm` to `AUDIO_EXTENSIONS` set and `media_format_map` — routed through existing AWS Transcribe pipeline
    - **Transcribe poll timeout**: 240s → 360s (large video files can take 2–5 min)
    - **Lambda timeout**: 300s → 600s (10 min, accommodates transcription + Claude analysis)
    - Existing pipeline already handles: Transcribe job start, poll, transcript extraction, filename labeling, inclusion in Claude prompt
    - Files: `src/App.jsx`, `backend/lambdas/enrich/lambda_function.py`
    - Deployed: frontend (S3/CloudFront), xo-enrich Lambda, Lambda timeout config

65. **Delete Client from Dashboard** (Session 17 - March 3, 2026)
    - **Frontend**: Trash icon on each client card (gray → red on hover), confirmation modal with hardcoded contrast colors (#1a1a1a heading, #444 description), Cancel + Delete buttons matching source delete style
    - **Backend**: New `handle_delete_client()` in clients Lambda — verifies ownership, deletes from DB (cascades to uploads, enrichments, skills), deletes entire S3 folder via paginated delete
    - **API Gateway**: Added DELETE method on `/clients` resource → xo-clients Lambda proxy integration + invoke permission, deployed to prod
    - Files: `src/App.jsx`, `backend/lambdas/clients/lambda_function.py`
    - Deployed: frontend (S3/CloudFront), xo-clients Lambda, API Gateway

66. **Remove "XO" from sidebar header** (Session 17 - March 3, 2026)
    - Removed redundant XO logo-box from sidebar header — now shows user name + email only
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

67. **Multi-Contact Support Per Client** (Session 18 - March 3, 2026)
    - **Database**: Added `contacts_json TEXT` column to clients table — stores JSON array of contacts
    - **Clients Lambda**: GET returns `contacts` array (with legacy fallback from `contact_*` columns); PUT/POST accept `contacts` array and sync `contacts[0]` to legacy columns for backward compat; `generate_client_config()` renders all contacts with "Primary Contact" / "Contact 2" / etc. headings
    - **Enrich Lambda**: Phase 2 reads `contacts_json` with legacy fallback; `analyze_with_claude()` includes all contacts in prompt enrichment info; `_send_streamline_webhook()` sends both legacy flat fields (from primary) and full `contacts` array
    - **Frontend**: `companyData` state uses `contacts: []` array instead of flat `contactName`/`contactTitle`/etc. fields; CompanyInfoModal renders dynamic contact cards with Add/Remove; each card has 2-column grid (Name, Title, Email, Phone) + full-width LinkedIn; "Primary Contact" badge on first card; empty state with dashed border prompt
    - **Backward compatible**: Existing clients with only legacy `contact_*` columns appear as a single primary contact card when opened
    - Files: `backend/schema.sql`, `backend/lambdas/clients/lambda_function.py`, `backend/lambdas/enrich/lambda_function.py`, `src/App.jsx`
    - Deployed: DB migration (RDS), xo-clients Lambda, xo-enrich Lambda, frontend (S3/CloudFront)

68. **Workspace Two-Column Split View** (Session 19 - March 3, 2026)
    - **Layout**: Replaced 3-column horizontal card grid with permanent two-column split layout (38% left / 62% right)
    - **Left Column — Client Profile Card**: Logo/icon/letter avatar, company name + industry badge, website link, all contacts inline (name, title, email, phone) with "Primary" badge on first contact, Add Contact + Edit Details buttons
    - **Right Column — Workflow Cards**: Raw Data and Intellagentic Growth cards stacked vertically with horizontal badge+content layout; step badges renumbered 1 & 2
    - **Removed**: Domain Expertise card (functionality moved to profile card)
    - **Responsive**: flexWrap wrap with minWidth constraints — stacks vertically on narrow viewports
    - **Empty state**: Left column shows "New Partner" button when no client configured
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

69. **Inline Partner Information Form + Domain Expertise Card Restored** (Session 19 - March 3, 2026)
    - **Left Column**: Replaced read-only profile card with always-visible, editable Partner Information form — Company Name, Website URL, Industry, Description, Pain Point fields + Contacts section with Add/Remove (2-col grid: Name, Title, Email, Phone + LinkedIn) + Save button with loading state
    - **Right Column**: Restored Domain Expertise card as first card (step 1, "The Filter") showing company name/industry when saved; Raw Data card (step 2); Intellagentic Growth card (step 3) — all three stacked vertically
    - **No modal needed**: Partner info is edited directly in the left column; form state syncs from companyData on client switch
    - Props added: `setCompanyData` and `onClientCreate` passed to UploadScreen for inline save
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

70. **Light Theme for Partner Information Form** (Session 19 - March 3, 2026)
    - **Left column restyled**: White background (#ffffff), light gray border (#e0e0e0), dark text (#111827) — visually distinct from dark workflow cards on right
    - **Inputs**: Light gray background (#f9fafb) with gray borders (#d1d5db); labels in muted gray (#6b7280)
    - **Contacts**: Cards use #f9fafb background with #e5e7eb borders; inner inputs white with gray borders
    - **Divider**: Changed from semi-transparent white to #e5e7eb
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

71. **Screenshot Tip, Text Input Source, Partner Form Autosave** (Session 20 - March 4, 2026)
    - **Screenshot tip**: Added tip below file drop zone — "You can screenshot WhatsApp messages, text conversations, or any screen and drop them in as images." PNG, JPG, JPEG, WEBP added to valid upload extensions and file picker accept list
    - **Text input source**: New "Paste Text Source" section in Add Sources panel — source label field + large textarea + "Add Source" button; creates a `.txt` file in S3 (named from label + timestamp) via presigned URL upload, included in enrichment like any other upload
    - **Partner form autosave**: All form fields (Company Name, Website, Industry, Description, Pain Point, all contact inputs) trigger `autoSave` on blur; Save button replaced with subtle "Saving..." spinner / green "Saved" checkmark indicator that fades after 2 seconds; form state syncs on client switch
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

72. **Organization Profile Rename + First/Last Name Split** (Session 20 - March 4, 2026)
    - **Renamed**: "Partner Information" → "Organization Profile" in left column header
    - **Contact name split**: Single `name` field replaced with `firstName`/`lastName` (side by side) across all forms (UploadScreen left column, CompanyInfoModal dashboard form)
    - **Migration**: Frontend `migrateContact()` helper splits legacy `name` on first space; Clients Lambda migrates contacts on-the-fly in GET response; no DB ALTER needed (contacts stored as JSON in `contacts_json` TEXT column)
    - **Clients Lambda**: Legacy `contact_name` column synced as combined `firstName + lastName`; `generate_client_config` renders combined name; legacy fallback splits `contact_name` into first/last
    - **Enrich Lambda**: Streamline webhook payload now sends `first_name`/`last_name` per contact in array + `client_contact_first_name`/`client_contact_last_name` as top-level flat fields; backward-compatible `name` and `display` fields retained
    - Files: `src/App.jsx`, `backend/lambdas/clients/lambda_function.py`, `backend/lambdas/enrich/lambda_function.py`
    - Deployed: frontend (S3/CloudFront), xo-clients Lambda, xo-enrich Lambda

73. **Move Founder Quotes into Right Column** (Session 20 - March 4, 2026)
    - Moved Alan Moore and Ken Scott quotes from full-width section below layout into the right column, below the Intellagentic Growth card
    - 2-column grid within the right column; slightly smaller font sizes to fit narrower space
    - Keeps everything visible on laptop without scrolling past the left column form
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

74. **Organization Address Support** (Session 21 - March 5, 2026)
    - **Multi-address support** for Organization Profile — same JSON array pattern as contacts
    - Each address: Label, Address Line 1, Address Line 2, City, State/Province, Postal Code, Country
    - **Database**: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS addresses_json TEXT` — stores JSON array, first element = primary address
    - **Clients Lambda**: GET returns `addresses` array; PUT/POST accept and store `addresses`; `generate_client_config()` renders addresses section in client-config.md
    - **Enrich Lambda**: Both enrichment paths read `addresses_json` from DB; Streamline webhook payload includes `addresses` array
    - **Frontend (UploadScreen)**: `formAddresses` state with add/update/remove handlers; address cards with Label full-width, Address 1 & 2 full-width, City+State side-by-side, Postal Code+Country side-by-side; autosave on blur; syncs on client switch
    - **Frontend (CompanyInfoModal)**: Matching address UI with Add Address button, same field layout, included in handleSave
    - Layout: Address 1 and 2 full width; City and State side by side; Postal Code and Country side by side
    - First address labeled "Primary Address", subsequent "Address 2, 3..."
    - Files: `backend/schema.sql`, `backend/lambdas/clients/lambda_function.py`, `backend/lambdas/enrich/lambda_function.py`, `src/App.jsx`
    - Deployed: frontend (S3/CloudFront), xo-clients Lambda, xo-enrich Lambda, DB migration

75. **Contacts & Addresses Expand/Collapse** (Session 21 - March 5, 2026)
    - **Primary always visible**: Primary Contact and Primary Address cards always shown expanded in Organization Profile
    - **Collapsible extras**: Additional contacts/addresses hidden by default behind clickable links: "View X more contacts" / "View X more addresses" (red text, ChevronDown icon)
    - **Toggle**: Clicking expands to show all; clicking again collapses ("Hide X more contacts/addresses" with ChevronUp icon)
    - **Add button always visible**: "+ Add" button stays accessible regardless of expanded/collapsed state
    - Proper index preservation: uses ternary `null` pattern in `.map()` to maintain original array indices for update/remove handlers
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

76. **Company Name on Contact Cards** (Session 21 - March 5, 2026)
    - Each contact card now displays company/organization name as a read-only row between Name and Title
    - **Layout order**: First Name + Last Name → Company Name (gray, read-only) → Title → Email + Phone → LinkedIn
    - Company name sourced from Organization Profile's Company Name field (`formData.name` in UploadScreen, `localData.name` in CompanyInfoModal)
    - Only shown when company name is populated; hidden otherwise
    - Applied to both UploadScreen left column and CompanyInfoModal
    - Also added expand/collapse to CompanyInfoModal contacts and addresses (matching UploadScreen pattern from v1.44)
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

77. **Login Screen Header Fix** (Session 21 - March 5, 2026)
    - Changed login screen header from "Rapid Deployment" to "Capture" + "Rapid Prototype" badge, matching the logged-in header exactly
    - Single file change: `src/App.jsx`
    - Deployed frontend to S3/CloudFront

78. **Mobile Responsive Workspace Layout** (Session 21 - March 5, 2026)
    - Two-column workspace layout now stacks vertically on screens ≤768px
    - Organization Profile card goes full width on top, three workflow cards full width below
    - Added CSS classes (`workspace-columns`, `workspace-col-left`, `workspace-col-right`) with `@media (max-width: 768px)` breakpoint using `flex-direction: column`
    - Desktop unchanged: side-by-side 38%/62% split
    - Files: `src/App.jsx`, `src/index.css`
    - Deployed frontend to S3/CloudFront

79. **Mobile Overflow Fix, System Skills Layout, Per-Client Webhook URL** (Session 22 - March 5, 2026)
    - **Mobile overflow fix**: `.panel` gets `max-width: 100%; overflow: hidden; box-sizing: border-box` at ≤768px; skill card flex children get `minWidth: 0` and `wordBreak: 'break-word'`
    - **System Skills full-width on mobile**: Added `system-skill-grid` className with CSS to force `flex-direction: column` and full-width children; description text wraps instead of `nowrap`
    - **Per-client webhook URL**: New `streamline_webhook_url VARCHAR(1000)` column in clients table; clients Lambda GET returns it, PUT accepts it; enrich Lambda uses per-client URL with env var fallback; frontend replaces read-only display with editable `<input>` that saves onBlur with saving/saved indicator
    - Auto-migration runs on clients Lambda cold start
    - Files: `src/App.jsx`, `src/index.css`, `backend/schema.sql`, `backend/lambdas/clients/lambda_function.py`, `backend/lambdas/enrich/lambda_function.py`
    - Deployed frontend to S3/CloudFront + both Lambdas

80. **Admin Cross-User Client Access** (Session 22 - March 5, 2026)
    - Admin users (`is_admin` JWT flag) can now see and manage ALL clients, not just their own
    - `/clients/list` (GET): admins get all clients across all users; non-admins still filtered by `user_id`
    - `/clients?client_id=X` (GET): admins skip `user_id` filter, can load any client's full data
    - `/clients` (PUT): admins can update any client regardless of owner
    - `/clients` (DELETE): admins can delete any client regardless of owner
    - Fixed bug where clicking a client card on the dashboard showed blank workspace for clients created by other users
    - Non-admin users unchanged — still restricted to their own clients
    - Files: `backend/lambdas/clients/lambda_function.py`
    - Deployed xo-clients Lambda

81. **Fix Enrichment Lambda sniffio Import Error** (Session 22 - March 5, 2026)
    - Enrichment was failing at cold start: `No module named 'sniffio'` (a dependency of the Anthropic SDK)
    - Root cause: `sniffio` module directory was missing from deployment package — only `.dist-info` metadata was present
    - Installed `sniffio` into `package/` directory
    - Also fixed zip build process: was zipping with `package/` prefix (modules at `package/sniffio/`) instead of zipping from inside `package/` (modules at `sniffio/` root level, matching `deploy-enrich.sh`)
    - Verified cold start succeeds with OPTIONS invoke returning 200
    - Files: `backend/lambdas/enrich/package/sniffio/` (new module)
    - Deployed xo-enrich Lambda

---

## PENDING ITEMS

### Immediate Enhancements

1. ~~**Audio Transcription**~~ **DONE (v1.9)** -- AWS Transcribe, context metadata, transcript extraction pipeline

2. **Web Enrichment**
   - Research company website (if provided)
   - Look up contact on LinkedIn (if provided)
   - Industry benchmarking data
   - Incorporate findings into Claude prompt

3. **Additional File Type Extraction**
   - ~~Word (.doc, .docx) -> python-docx library~~ **DONE (v1.22)** -- extract_docx() with paragraph + table extraction
   - PowerPoint (.ppt, .pptx) -> python-pptx library
   - JSON (.json) -> parse and summarize structure
   - XML (.xml) -> parse and extract key data
   - ZIP (.zip) -> extract and process contents

### Advanced Features

4. ~~**Async Job Processing**~~ **DONE (v1.9)** -- Lambda self-invoke async pattern, DB stage tracking, frontend polling

5. **Richie's Encryption**
   - End-to-end encryption for uploaded files
   - Client-side encryption before S3 upload
   - Decrypt in Lambda for processing
   - Store encrypted results

6. **RAG Integration**
   - Vector embeddings for uploaded documents
   - Pinecone/Weaviate for vector storage
   - Semantic search across client data
   - Follow-up questions on analysis

7. **Multi-Domain Templates**
   - Pre-built prompts for common verticals
   - Waste management, healthcare, hospitality, retail
   - Industry-specific schema recommendations
   - Vertical-specific KPIs and benchmarks

8. **Export & Sharing**
   - PDF export of analysis results
   - Email report delivery
   - Shareable links (time-limited)
   - ~~White-label branding options~~ **PARTIALLY DONE (v1.25)** -- client logo + icon upload, dashboard icons, workspace header logo

---

## BOTTOM LINE

**What Works Today:**

The XO Capture prototype is **fully operational** and deployed to production. A domain partner can:

1. Visit https://d36la414u58rw5.cloudfront.net
2. Sign in with Google (admin users) or email/password (self-serve). Admin users see a multi-client dashboard.
3. Fill out company information (8 fields including pain point and enrichment targets)
4. Upload business documents (15 file types supported) or import from Google Drive
5. Add context metadata for audio files (date, participants, topic)
6. Choose AI model in Configuration (Sonnet 4.5 default, Opus 4.6, or Haiku 4.5)
7. Click "Start Enrichment" and watch AI process their data (async with live stage tracking)
8. Receive structured MBA-level business analysis:
   - Executive summary of their business
   - 3-5 critical problems identified with evidence and recommendations
   - ASCII architecture diagram for proposed system
   - Proposed database schema (tables with columns, types, relationships)
   - 7/14/21 day action plan (Build & Demo → Validate & Connect → Deploy or Decide)
   - Bottom line summary (CEO-level: what to do first, cost, expected outcome)
   - Source attribution

**Technology Stack:**
- Frontend: React 18 + Vite, deployed to S3/CloudFront
- Backend: 7 Python Lambdas behind API Gateway (+ xo-psycopg2 layer)
- Database: PostgreSQL 15 on RDS (db.t3.micro) -- 6 tables
- Auth: Google OAuth (admin) + bcrypt password (self-serve) + JWT tokens (24h expiry, is_admin flag)
- AI: Claude Sonnet 4.5 (default), Opus 4.6, or Haiku 4.5 (user-selectable) via Anthropic API
- Storage: S3 with folder-per-client structure (files + analysis.json)
- Transcription: AWS Transcribe for audio files (MP3, WAV, M4A, AAC, OGG, FLAC, WMA)
- Integrations: Google Drive (OAuth2 connector with file picker)
- Region: us-west-1 (AWS)

**What's Not Built Yet:**
- Web enrichment (URLs collected but not researched)
- UI for 5 new DB fields (survival metrics, AI persona, strategic objective, tone mode)

**Performance:**
- Upload: Instant (direct to S3 via presigned URLs)
- Enrichment: 30-90 seconds depending on file count and size
- Results: Instant retrieval from S3

**Cost Estimate (100 clients/month):**
- RDS db.t3.micro: ~$15/month
- S3: ~$5 (5GB average)
- Lambda: ~$2
- API Gateway: ~$3.50
- Claude API: $10-50 (variable based on document size)
- **Total: $35-75/month** for prototype usage

**Repository:** All code is version-controlled at https://github.com/intellagentic/xo-quickstart with proper .gitignore to exclude secrets.

**v1.51 — Dashboard Filters: Industry Pills + Domain Partner Dropdown**
- Dashboard now has industry pill filters (horizontal row, red when active) with client counts per industry
- Admin users see a partner dropdown to filter by which user created the client (only shown when 2+ distinct partners exist)
- Filters are AND-combined; header count updates to show filtered total
- Empty filter state shows "No clients match" message with a Clear Filters button
- Backend `/clients/list` now returns `owner_name` via LEFT JOIN on users table

**v1.52 — 7/14/21 Day Action Plan (replaces 30/60/90)**
- Enrichment prompt now produces a 7/14/21 day action plan instead of 30/60/90
- Phases: 7-day (Build & Demo), 14-day (Validate & Connect), 21-day (Deploy or Decide)
- Frontend results heading updated to "7/14/21 Day Action Plan"
- Pain point priority now front-loads the 7-day phase
- Existing results still render correctly (frontend displays phase labels dynamically)

**v1.56 — Partner View vs Client View (role separation)**
- Frontend-only conditional rendering based on existing `isAdmin` flag
- **Admin (Google OAuth):** All screens, all buttons, "Partner Workspace" subtitle, founder quotes, Download Prototype Spec + Send to Streamline
- **Client (email/password):** Welcome + Sources + Results only in sidebar. No Enrich, Skills, Configuration, or Branding screens
- Header subtitle shows "Partner Workspace" for admins, company name or "My Workspace" for clients
- Welcome Step 3 for clients: results status indicator (Awaiting Analysis / Analysis in Progress / Results Ready) replaces Skills + Enrich buttons
- Founder quotes hidden for client users
- ResultsScreen: Download Prototype Spec and Send to Streamline buttons hidden for clients
- Screen access guards prevent non-admin navigation to admin-only screens with auto-redirect fallback

**v1.55 — Narrower sidebar layout**
- Sidebar width reduced from 280px to 220px so main content stays visible
- Overlay opacity lightened (50% to 25%) to keep workspace context
- Tightened padding, font sizes (0.9rem to 0.8rem), icon sizes (20px to 17px), and gaps across all sidebar items
- Theme toggle switch scaled down, text-overflow ellipsis on header name/email
- All icons use flexShrink: 0 to prevent compression at narrow width

**v1.54 — Rapid Prototype Spec Generator**
- New `xo-rapid-prototype` Lambda generates a Claude Code-ready markdown build spec from enrichment results + client metadata
- "Download Prototype Spec" red button on Results screen (next to Send to Streamline) triggers .md file download
- Spec includes: client context, problem analysis, features, database schema, seed data instructions, tech stack, UI layout, API endpoints, build sequence checklist
- "Rapid Prototype" added as default configurable button (Download icon, red, routes to results)
- Download icon added to ICON_MAP for configurable buttons
- API Gateway: GET /rapid-prototype/{id} with CORS OPTIONS

**v1.53 — Global System Skills (DB-managed, admin-editable)**
- System skills (analysis-framework, output-format, authority-boundaries, enrichment-process) are now first-class DB entities
- `skills.client_id` is now nullable: NULL = system skill (global), set = client skill
- Auto-migration seeds 4 system skills into DB on Lambda cold start + copies .md files to S3 `_system/skills/`
- New `/skills` API endpoints: GET (combined or system-only), POST, PUT, DELETE with admin gating for system scope
- Skills screen shows system skills (blue "System" badge) at top, then client skills (gray "Client" badge) with divider
- Admins can create/edit/delete system skills; non-admins see them read-only
- Add Skill modal has scope selector for admins: "This client only" vs "System (all clients)"
- Enrich Lambda reads system skills from DB first, falls back to bundled files if DB empty
- Configuration screen system skills panel now dynamically fetches from API instead of hardcoded list

**Next Step:** Web enrichment (company website + LinkedIn research), UI for 5 new DB fields (survival metrics, AI persona, strategic objective, tone mode).

---

**END OF PROJECT STATUS**
