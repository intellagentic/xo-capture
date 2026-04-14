# XO Prototype Platform Skill

This skill defines the exact buildable specification for the XO Prototype
platform layer. When Claude Code reads this file, it builds the entire
platform -- layout, configuration, theming, webhook integration, data
tables, action buttons, seed data -- without asking a single question.

This replaces the generic "Screen: dashboard/view, Components: Data table,
filters, action buttons, API: CRUD endpoints" sections in PROTOTYPE-SPEC.md
with exact component specs, CSS values, and implementation patterns.

================================================================
1. FILE STRUCTURE
================================================================

```
{project}/
  CLAUDE.md
  PROJECT-STATUS.md
  index.html
  vite.config.js
  package.json
  src/
    main.jsx                      -- React mount + style imports
    App.jsx                       -- router, reducer, contexts, localStorage
    data/
      seedData.js                 -- all synthetic data
    assets/
      invite.png                  -- XO invite image
      intellistack-logo.svg       -- Intellistack logo (currentColor text)
      intellistack-logo.png       -- Intellistack logo (original)
    components/
      Layout.jsx                  -- fixed header + sidebar + outlet + fixed footer + modals
      Sidebar.jsx                 -- nav links + XO logo badge + "before" trigger
      Dashboard.jsx               -- Console: stat cards + workflow table + activity feed
      WorkflowDetail.jsx          -- VQD grid + opportunity table
      RecordDetail.jsx            -- error cards with action buttons + bulk actions
      ConfigurationPage.jsx       -- Streamline URL + Sync/Independent + button config
      ButtonConfig.jsx            -- button editor/preview/ActionButtons strip
      ActivityFeed.jsx            -- timestamped event stream
      StatCard.jsx                -- metric card with delta
      ComplianceGauge.jsx         -- animated SVG circular gauge
      StatusBadge.jsx             -- colored pill (workflow status)
      SeverityBadge.jsx           -- colored pill (error severity)
      DataTable.jsx               -- sortable/filterable table with fixed layout
      ErrorCard.jsx               -- error detail with 3 action buttons + card states
      Toast.jsx                   -- notification toast
    styles/
      theme.css                   -- CSS custom properties + [data-theme="dark"]
      layout.css                  -- grid, sidebar, fixed header, content area
      components.css              -- all component styles
      animations.css              -- keyframe animations
```

================================================================
2. LAYOUT COMPONENT (Layout.jsx)
================================================================

The Layout wraps all routes via React Router Outlet.

STRUCTURE:
```
<div className="app-layout">
  <Sidebar onShowBefore={...} />
  <main className="main-area">
    <header className="top-header"> ... </header>
    <div className="content-area"> <Outlet /> </div>
  </main>
  <div (fixed footer)> ... </div>
  {invite modal}
  {before/after modal}
</div>
```

FIXED HEADER (position: fixed, top: 0, left: 240px, right: 0, z-index: 50):
  Height: ~48px (padding: 12px 24px)
  Background: var(--card-bg)
  Border-bottom: 1px solid var(--border)

  Left side:
    - h2 "{ProductName} Operations" (15px, weight 600)

  Right side (display: flex, align-items: center, gap: 12px):
    - Intellistack logo: inline SVG (144x19 viewBox, rendered at height 18px)
      Flag bars use original colors (#FF982E, #89E1C9, #F1D053, #F181FF, #EB5639)
      Text paths use fill="currentColor" so they adapt to theme
      Wrap in style={{ color: 'var(--text-primary)' }}
    - Dark/light toggle button: 40x40px, border-radius 8px, border: 1px solid var(--border)
      Sun icon (18px) in dark mode, Moon icon (18px) in light mode
    - Bell icon (18px, color: var(--text-muted))
    - Client badge: flex row, padding 6px 12px, border-radius var(--radius)
      Client avatar: 28x28px circle, background var(--primary), white text (initials)
      Client name text (13px, weight 500)

DARK SIDEBAR (position: fixed, width: 240px, top: 0, bottom: 0):
  Background: var(--sidebar-bg) = #0F172A

  Brand section (padding: 20px 16px, border-bottom: 1px solid rgba(255,255,255,0.08)):
    XO logo badge: 28x28px, border-radius 6px, background #EF4444,
      white text "XO" (11px, weight 800, letter-spacing -0.02em)
    Product name: h1 (18px, weight 700, letter-spacing -0.02em, white)
    "Powered by XO | Intellagentic" (10px, var(--text-muted))

  Nav section (padding: 16px 8px, flex: 1):
    Each link: display flex, align-items center, gap 10px,
      padding 10px 12px, border-radius var(--radius-sm),
      font-size 14px, weight 500
    Active: background var(--primary), color white
    Hover: background var(--sidebar-hover), color white
    Icons: 18px Lucide icons

    Standard nav items:
      - Console (LayoutDashboard) -> /
      - Activity Log (Activity) -> /activity
      - RLHF Insights (Brain) -> /rlhf
      - Configuration (Sliders) -> /configuration

    Bottom item with margin-top 28px:
      - "How {ClientName} did this before" (FileSpreadsheet)
        onClick triggers before/after modal (not a route)

  Footer section (padding: 16px, border-top: 1px solid rgba(255,255,255,0.08)):
    "XO Capture ID" + capture ID value (11px, var(--text-muted))

FIXED FOOTER (position: fixed, bottom: 0, left: 0, right: 0, z-index: 10):
  Background: #0F172A (solid dark blue, fully opaque)
  Padding: 10px 0
  Text: centered, 13px, color #CBD5E1
  Content: "<span style color #EF4444 fontWeight 700>XO</span> clears the path. You decide. Streamline acts."
  Clickable (pointer cursor, pointerEvents auto) -- opens invite modal

CONTENT AREA:
  padding: 24px
  padding-top: 72px (offset for fixed header)
  min-width: 0
  overflow-x: auto

================================================================
3. CONFIGURATION PAGE (ConfigurationPage.jsx)
================================================================

Props: buttons, setButtons, isDark, streamlineUrl, setStreamlineUrl,
       routingMode, setRoutingMode

All state persists to localStorage via App.jsx useEffect hooks.
localStorage keys: datacheckr-buttons, datacheckr-streamline-url,
  datacheckr-routing-mode, datacheckr-theme

SECTION 1: System Configuration Header
  Panel component: background C.surface, border 1px solid C.border,
    border-radius 12px, box-shadow 0 1px 2px rgba(0,0,0,0.05)
  PanelHeader: Settings icon (20px, red #ef4444), "System Configuration"
  Subtitle: "{ClientName} -- {ProductName}" (13px, C.muted)

SECTION 2: Streamline Integration
  PanelHeader: Send icon (red), "Streamline Integration"
  Description: "Streamline orchestrates workflows internally..."

  Sync/Independent toggle:
    Row: flex, space-between, padding 16px, border 1px solid C.border, border-radius 10px
    Left: dynamic label ("Sync" or "Independent") + description text
    Right: "Sync" label (11px) + toggle switch (52x28px, border-radius 14px,
      knob 22x22px) + "Independent" label (11px)
    Toggle off (sync) = gray #e5e5e5, toggle on (independent) = blue #3b82f6

  Shared URL field (visible in Sync mode only):
    Container: padding 10px 14px, background C.muted + "10", border-radius 8px
    Label: "STREAMLINE WORKFLOW URL" (11px, uppercase, letter-spacing 0.05em)
    Input: type url, monospace font, 13px, full width
    Helper text: mentions action_type query parameter

  Send to Streamline toggle:
    Same row layout as Sync toggle
    Toggle color: red #dc2626 when enabled, gray #e5e5e5 when disabled

SECTION 3: Button Builder (two-column grid, gap 28px)

  Left: ButtonEditorPanel
    Header: "CONFIGURE BUTTONS" (16px, uppercase, C.muted) + "+ Add Button" (blue #3b82f6)

    Each button card (draggable):
      Container: padding 16px, background C.surface, border 2px solid C.border
        (blue #3b82f6 when editing), border-radius 12px, cursor grab
      Row: GripVertical icon (18px) + colored icon circle (36x36px, color+20 background)
        + label (15px, weight 600) + color/icon meta (12px) + "Sync" badge (if synced)
        + edit/copy/delete buttons (32x32px each)
      URL display: shown when NOT synced (11px, blue, ellipsis overflow)

      Expanded edit state:
        Label input: full width, padding 8px 12px
        "Include in Sync" toggle (visible in Sync mode): 40x22px mini toggle
        Webhook URL input (visible when NOT synced or in Independent mode):
          placeholder "https://hooks.streamline.com/{product}/..."
        Color picker: 8-column grid, 36px height swatches
          Colors: Blue #3b82f6, Green #22c55e, Red #ef4444, Purple #a855f7,
            Orange #f97316, Pink #ec4899, Cyan #06b6d4, Gray #334155
          Selected: 2px solid border in color, Check icon centered
        Icon picker: 10-column grid, aspect-ratio 1
          Selected: 2px solid border in button color, tinted background
          All Lucide icons: Zap, Heart, Star, Send, Check, X, Edit2, Save,
            Home, Settings, User, Bell, Search, Calendar, Mail, Phone,
            MapPin, Upload, Play, ExternalLink, FileText, Globe, Package,
            CheckCircle2, Building2, Sparkles, Database, AlertCircle,
            AlertTriangle, TrendingUp, Clock, Download, ShieldCheck, RotateCcw

  Right: ButtonPreviewPanel
    Header: "SYSTEM BUTTONS PREVIEW" (16px, uppercase, C.muted)
    Container: padding 20px, border 2px solid C.border, border-radius 16px, min-height 200px
    Rendered buttons: inline-flex, padding 12px 24px, border-radius 10px,
      box-shadow 0 4px 12px color+40

DEFAULT BUTTON DEFINITIONS:
  { id: 1, label: 'Run QA Check',    icon: 'ShieldCheck',  color: '#3b82f6', actionType: 'run_qa_check',  syncEnabled: true }
  { id: 2, label: 'Escalate',        icon: 'Send',         color: '#3b82f6', actionType: 'escalate',      syncEnabled: true }
  { id: 3, label: 'Confirm & Close', icon: 'CheckCircle2', color: '#22c55e', actionType: 'confirm_close', syncEnabled: true }
  { id: 4, label: 'Dismiss',         icon: 'RotateCcw',    color: '#ef4444', actionType: 'dismiss',       syncEnabled: true }

================================================================
4. STREAMLINE WEBHOOK INTEGRATION
================================================================

METHOD: window.open(url, '_blank')
  Opens the Streamline URL in a new browser tab.
  The user sees the Streamline form step and interacts with it.
  No background fetch, no CORS issues.

CONSOLE/WORKFLOW BUTTONS (from ActionButtons component):
  URL: button.url + query params
  Query params: action_type, source=datacheckr, timestamp
  Flow: click -> confirm modal -> window.open -> toast "opened in Streamline"

ERROR CARD BUTTONS (from ErrorCard component):
  URL: streamlineUrl (from context) + query params
  Query params:
    action_type     -- run_qa_check | escalate | confirm_close | dismiss
    opportunity_name -- full opportunity name
    field_name      -- Salesforce field (e.g. CloseDate, Amount)
    error_category  -- Date | Value | Duplicate | Missing | Format | Logic
    severity        -- ProbablyBad | DefinitelyBad
    current_value   -- the flagged value
    issue           -- human-readable description
    owner_response  -- text from the input field
    workflow_id     -- QA workflow ID
  Flow: click -> confirm modal -> window.open -> toast -> card state update

BULK ACTIONS (from RecordDetail):
  Opens one new tab per unresolved error using same URL pattern.
  Then updates all card states locally.

CARD STATES AFTER ACTION:
  confirm_close -> "Resolved"  (green #22c55e, CheckCircle icon)
                   Updates compliance score via RESOLVE_RECORD dispatch
  escalate      -> "Escalated" (blue #3b82f6, AlertCircle icon)
                   Does NOT affect compliance score
  dismiss       -> "Dismissed" (gray #6B7280, XCircle icon)
                   Does NOT affect compliance score

SYNC VS INDEPENDENT URL RESOLUTION:
  Sync mode: all buttons with syncEnabled=true share the global streamlineUrl.
    action_type differentiates the action.
  Independent mode: each button uses its own .url property.
  Mix and match: in Sync mode, buttons with syncEnabled=false use their own URL.

NORMALIZED action_type VALUES (use these exact strings in Streamline):
  run_qa_check   -- Run QA Check button
  escalate       -- Escalate button
  confirm_close  -- Confirm & Close button
  dismiss        -- Dismiss button

CONFIRMATION MODAL (shown before every action):
  Fixed overlay (inset 0, rgba(0,0,0,0.5), z-index 200)
  White card (max-width 400px, padding 24px, border-radius 16px)
  Title: button label
  Description: action-specific text
  Error context: field name, category, severity
  Buttons: Cancel (outlined) + Action (colored, matches button color)

================================================================
5. CONSOLE VIEW TEMPLATE (Dashboard.jsx)
================================================================

This is the main operational view at route /.

HEADER: inherited from Layout (fixed top bar)

ACTION BUTTONS ROW (margin-bottom 20px):
  ActionButtons component renders configured buttons from context.
  Each button: inline-flex, padding 10px 20px, min-width 170px, border-radius 10px
  Colors from button config. Box-shadow: 0 4px 12px color+40.

STAT CARDS ROW (grid, 4 columns, gap 16px, margin-bottom 24px):
  Card 1: "ACTIVE QA WORKFLOWS" -- count (large number)
  Card 2: "OVERALL COMPLIANCE" -- percentage + ComplianceGauge (inline, 80px)
  Card 3: "RECORDS UNDER REVIEW" -- count
  Card 4: "ERRORS RESOLVED THIS WEEK" -- count + delta trend

  StatCard component:
    Props: label, value, delta, deltaLabel, children
    label: 12px, uppercase, letter-spacing 0.05em, var(--text-muted)
    value: 28px, weight 700, var(--text-primary)
    delta: 12px, TrendingUp/TrendingDown icon, green/red

MAIN GRID (dashboard-grid: 1fr 320px, gap 24px):
  Left: DataTable (QA Workflows)
    Title: "QA Workflows"
    Search: "Search by name, ID, or owner..."
    Filter: status dropdown (All, Initiated, Pending_Owner_Action, Cleared, Closed)
    Columns with widths:
      Opportunities (30%) -- bold label + monospace ID below
      Status (14%) -- StatusBadge pill
      Owner (16%) -- text
      Errors (8%) -- monospace number
      Score (12%) -- ComplianceGauge (80px)
      Export (10%) -- date string
    Rows clickable -> navigate to /workflow/:id
    table-layout: fixed, overflow-x: auto

  Right: ActivityFeed
    Title: "Recent Activity"
    Items with type-based icons:
      correction -> FileEdit (blue bg)
      score -> TrendingUp (green bg)
      clearance -> ShieldCheck (green bg)
      initiated -> PlayCircle (blue bg)
      rlhf -> Brain (purple bg)
    Each item: icon (32x32px circle) + text (13px) + relative time (11px)

DataTable COMPONENT SPEC:
  Props: title, columns, data, onRowClick, searchPlaceholder,
    searchFields, filterField, filterOptions, rowClassName
  columns[]: { key, label, width?, render?, sortable? }
  State: search, filter, sortKey, sortDir
  Features: search across multiple fields, single-field filter,
    click-to-sort with direction toggle, custom render functions

ComplianceGauge COMPONENT SPEC:
  Props: score (0-100), large (boolean)
  SVG circle: radius 32 (small) / 48 (large)
  Conic progress: stroke-dasharray/dashoffset animation
  Color: >=90 green, >=75 amber, <75 red
  Center text: score% (16px small, 24px large)
  Animated: score transitions from 0 on mount (1s ease-out)

================================================================
6. DETAIL VIEW TEMPLATE (WorkflowDetail.jsx)
================================================================

Route: /workflow/:id

BREADCRUMB: Console > {workflow.label}
  Links back to / and shows current workflow name.
  Font: 13px, gap 8px, ChevronRight separators.

HEADER CARD (workflow-header):
  flex, space-between, flex-wrap, gap 20px, padding 24px
  Left: h2 with workflow label (20px, weight 700) + StatusBadge
    Meta row: monospace workflow ID (12px) + User icon + owner +
      Calendar icon + export date + FileText icon + record count
  Right: ComplianceGauge (large, 120px)

ACTION BUTTONS ROW (same as Console)

VQD CLASSIFICATION GRID (vqd-grid):
  Header: "Error Classification (VQD Breakdown)" (15px, weight 600)
  Table columns: Category | Good | Probably Bad | Definitely Bad | Total
  Rows: Date, Value, Duplicate, Missing, Format, Logic
  Cell styling:
    good: green text
    probably-bad: amber bg (#FFFBEB), brown text (#B45309), clickable
    definitely-bad: red bg (#FEF2F2), dark red text (#B91C1C), clickable
    total: muted text
  Summary row: "Total flagged errors: N (X Probably Bad, Y Definitely Bad)"

CHILD RECORDS TABLE (DataTable):
  Title: "Opportunity Records"
  Columns: Opportunity Name, Account, Amount (monospace $), Stage,
    Close Date, QA Status (StatusBadge), Errors (monospace, colored),
    Actions ("View Errors" button)
  Rows with errors: border-left 3px solid var(--severity-probably-bad)
  Clickable rows navigate to /workflow/:id/record/:oppId

================================================================
7. RECORD ACTION VIEW TEMPLATE (RecordDetail.jsx)
================================================================

Route: /workflow/:id/record/:oppId

BREADCRUMB: Console > {workflowId} > {opportunity.name}

RECORD HEADER CARD:
  Top row: h2 opportunity name (20px) + StatusBadge
  Subtitle: account name (14px, muted)
  Field grid (auto-fit, minmax 160px): Amount, Stage, Close Date, Owner, QA Status
  Each field: dt (11px, uppercase, muted) + dd (14px, weight 500)

ERROR CARDS (one per error, margin-bottom 16px each):
  Header row: field name h4 (monospace) + category-tag badge + SeverityBadge
  Details grid: "Current value:" + code element, "Issue:" + description
  Owner response: text input (full width, placeholder "Provide context or correction...")
  Three action buttons (inline, gap 8px, each min-width 150px):
    Confirm & Close -- green #22c55e, ShieldCheck icon, actionType: confirm_close
    Escalate -- blue #3b82f6, Send icon, actionType: escalate
    Dismiss -- red #ef4444, RotateCcw icon, actionType: dismiss

  Card states (after action):
    confirm_close: opacity 0.7, green border, green bg, "Resolved" + CheckCircle
    escalate: opacity 0.7, blue border, blue bg, "Escalated" + AlertCircle
    dismiss: opacity 0.7, gray border, gray bg, "Dismissed" + XCircle

BULK ACTION BAR (action-bar, border-top 1px solid var(--border)):
  Three buttons (min-width 170px, padding 12px 24px, border-radius 10px):
    Confirm & Close All -- green, ShieldCheck
    Escalate All -- blue, Send
    Dismiss All -- red, RotateCcw
  + "Back to Workflow" link (btn-secondary)
  Hidden when all errors are actioned; replaced with "Back to Workflow" btn-primary.

  Bulk confirmation modal before firing (same pattern as single card).
  Bulk actions open one new tab per unresolved error.

================================================================
8. SEED DATA STRUCTURE
================================================================

File: src/data/seedData.js
All data is synthetic. Export named arrays/objects.

WORKFLOWS (minimum 8 records):
  export const workflows = [
    { id: 'QA-2026-MMDD', label: 'Account1 / Account2 / Account3',
      status: 'Initiated'|'Pending_Owner_Action'|'Cleared'|'Closed',
      owner: 'Full Name', errorCount: N, complianceScore: 0-100,
      exportDate: 'YYYY-MM-DD', recordCount: N }
  ]

  Distribution: 2-3 Cleared, 2 Pending, 2 Initiated, 1 Closed.
  Labels: slash-separated account names from child opportunities.
  Realistic owner names (diverse, professional).

OPPORTUNITIES (minimum 25 records, 3-5 per workflow):
  export const opportunities = [
    { id: 'OPP-NNN', workflowId: 'QA-2026-MMDD',
      name: 'Company Name - Engagement Type',
      account: 'Company Name', amount: N, stage: 'Salesforce Stage',
      closeDate: 'YYYY-MM-DD', owner: 'Full Name',
      qaStatus: 'Unchecked'|'Under Review'|'QA Cleared',
      errors: [...] }
  ]

  Use realistic consulting/professional services names.
  Stages: Prospecting, Qualification, Needs Analysis, Proposal,
    Negotiation, Closed Won, Closed Lost.
  Amounts: $65K-$820K range, realistic for consulting.
  Cleared workflows have empty errors arrays.
  Active workflows have 2-5 errors per opportunity.

ERRORS (per opportunity):
  { id: 'ERR-OPP-N', field: 'SalesforceFieldName',
    category: 'Date'|'Value'|'Duplicate'|'Missing'|'Format'|'Logic',
    severity: 'Probably Bad'|'Definitely Bad',
    currentValue: 'displayed value', issue: 'human-readable description',
    ownerResponse: '', resolved: false }

  Distribution: ~85% Good (no error), ~10% Probably Bad, ~5% Definitely Bad.
  Realistic error examples per category documented in brief.

VQD MATRIX (for workflows with errors):
  export const vqdMatrix = {
    'QA-2026-MMDD': {
      Date:      { Good: N, ProbablyBad: N, DefinitelyBad: N },
      Value:     { Good: N, ProbablyBad: N, DefinitelyBad: N },
      Duplicate: { Good: N, ProbablyBad: N, DefinitelyBad: N },
      Missing:   { Good: N, ProbablyBad: N, DefinitelyBad: N },
      Format:    { Good: N, ProbablyBad: N, DefinitelyBad: N },
      Logic:     { Good: N, ProbablyBad: N, DefinitelyBad: N },
    }
  }

RLHF LOG (minimum 16 entries):
  export const rlhfLog = [
    { id: 'RLHF-NNN', timestamp: ISO8601, workflowId: 'QA-...',
      signal: 'positive'|'negative', category: '...', description: '...',
      owner: 'Full Name' }
  ]
  ~92% positive, ~8% negative.

ACTIVITY FEED (minimum 15 entries):
  export const activityFeed = [
    { id: 'ACT-NNN', type: 'correction'|'score'|'clearance'|'initiated'|'rlhf',
      message: 'Human-readable event description', timestamp: ISO8601 }
  ]
  Spanning ~5 days, mixed types, most recent first.

================================================================
9. THEME SYSTEM
================================================================

IMPLEMENTATION: CSS custom properties on :root, overridden by [data-theme="dark"].
Toggle: data-theme attribute on <html> element.
Stored in localStorage('datacheckr-theme').
Toggled via useCallback in App.jsx, passed as isDark prop to Layout.

LIGHT MODE (:root):
  --primary: #1E3A5F
  --primary-light: #2A4F7F
  --primary-dark: #152B47
  --severity-good: #22C55E
  --severity-good-bg: #F0FDF4
  --severity-probably-bad: #F59E0B
  --severity-probably-bad-bg: #FFFBEB
  --severity-definitely-bad: #EF4444
  --severity-definitely-bad-bg: #FEF2F2
  --status-initiated: #3B82F6
  --status-initiated-bg: #EFF6FF
  --status-pending: #F59E0B
  --status-pending-bg: #FFFBEB
  --status-cleared: #22C55E
  --status-cleared-bg: #F0FDF4
  --status-closed: #6B7280
  --status-closed-bg: #F3F4F6
  --sidebar-bg: #0F172A
  --sidebar-text: #CBD5E1
  --sidebar-text-active: #FFFFFF
  --sidebar-hover: #1E293B
  --content-bg: #F8FAFC
  --card-bg: #FFFFFF
  --card-border: #E2E8F0
  --text-primary: #0F172A
  --text-secondary: #475569
  --text-muted: #94A3B8
  --border: #E2E8F0
  --border-focus: #3B82F6
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)
  --radius: 8px
  --radius-sm: 4px
  --radius-lg: 12px
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace

DARK MODE ([data-theme="dark"]):
  --primary: #3B82F6
  --primary-light: #60A5FA
  --primary-dark: #1E3A5F
  --sidebar-bg: #0B0F19
  --sidebar-hover: #151B2B
  --content-bg: #0d1117
  --card-bg: #161b22
  --card-border: #30363d
  --text-primary: #e6edf3
  --text-secondary: #8b949e
  --text-muted: #656d76
  --border: #30363d
  --border-focus: #58a6ff
  --severity-good-bg: rgba(34,197,94,0.12)
  --severity-probably-bad-bg: rgba(245,158,11,0.12)
  --severity-definitely-bad-bg: rgba(239,68,68,0.12)
  --status-initiated-bg: rgba(59,130,246,0.15)
  --status-pending-bg: rgba(245,158,11,0.15)
  --status-cleared-bg: rgba(34,197,94,0.15)
  --status-closed-bg: rgba(107,114,128,0.15)
  --shadow-sm/md/lg: increased opacity (0.2/0.3/0.4)

INLINE THEME COLORS (for ButtonConfig/ConfigurationPage inline styles):
  getThemeColors(isDark) returns:
    bg:      isDark ? '#0d1117' : '#f6f8fa'
    surface: isDark ? '#161b22' : '#ffffff'
    border:  isDark ? '#30363d' : '#d0d7de'
    text:    isDark ? '#e6edf3' : '#1f2328'
    muted:   isDark ? '#8b949e' : '#656d76'

GOOGLE FONTS IMPORT (top of theme.css):
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

GLOBAL RESET:
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font-sans); background: var(--content-bg);
    color: var(--text-primary); transition: background 0.2s, color 0.2s; }

================================================================
10. INVITE MODAL
================================================================

Triggered by: clicking the footer tagline text.
Managed in: Layout.jsx state (showInvite).
Dismiss: click outside overlay, press Escape, or click X button.

OVERLAY: position fixed, inset 0, background rgba(0,0,0,0.7),
  display flex, align-items center, justify-content center, z-index 200

MODAL CONTAINER: position relative, animation modalIn 0.2s ease

CLOSE BUTTON: position absolute, top -12px, right -12px, 28x28px,
  border-radius 50%, background #0F172A, color white, X icon (14px)

IMAGE: <img> from src/assets/invite.png, width 350px, border-radius 12px,
  box-shadow 0 20px 60px rgba(0,0,0,0.4)

ESCAPE HANDLER: useEffect adds keydown listener for "Escape" when modal is open.

================================================================
11. ROUTING
================================================================

React Router v6. BrowserRouter wrapping Routes.
All routes under a shared Layout element (renders Sidebar + Header + Outlet).

  /                              -> Console (Dashboard.jsx)
  /workflow/:id                  -> WorkflowDetail.jsx
  /workflow/:id/record/:oppId    -> RecordDetail.jsx
  /configuration                 -> ConfigurationPage.jsx
  /activity                      -> (nav link exists, page not yet built)
  /rlhf                          -> (nav link exists, page not yet built)

CloudFront custom error response: 404 -> /index.html with 200 status (SPA deep links).

================================================================
12. DEPLOY TEMPLATE
================================================================

TECH: React 18 + Vite 8 + React Router v6.
Dependencies: react, react-dom, react-router-dom, lucide-react.
Dev: @vitejs/plugin-react, vite, eslint.

BUILD: npm run build -> dist/

S3 BUCKET:
  Name: {product}-prototype (e.g. datacheckr-prototype)
  Region: eu-west-2 (or project-specific)
  Static website hosting: enabled
  Index document: index.html
  Error document: index.html
  Public read bucket policy
  Public access block: disabled

CLOUDFRONT:
  Custom origin pointing to S3 website endpoint (HTTP only)
  Viewer protocol: redirect-to-https
  Compress: enabled
  Price class: PriceClass_100
  Custom error response: 404 -> /index.html, 200 status, 10s TTL
  Default TTL: 86400

DEPLOY COMMANDS:
  npm run build
  aws s3 sync dist/ s3://{BUCKET}/ --delete --profile {PROFILE}
  aws cloudfront create-invalidation --distribution-id {DIST_ID} --paths "/*" --profile {PROFILE}

GIT WORKFLOW:
  Always work on feature branches. Never commit directly to main.
  Branch naming: feature/, fix/, docs/
  Merge to main via --no-ff merge commit when work is verified.
  Push branch, push main after merge.

================================================================
13. PROJECT-STATUS.md TEMPLATE
================================================================

ASCII-only. No emojis. Use -- for dashes, not unicode.

REQUIRED SECTIONS:
  # PROJECT-STATUS.md -- {ProductName} Prototype
  # Initial prototype architecture generated by XO Capture
  # (Capture ID: {capture_id}).
  # Client: {ClientName}
  # Author: Ken Scott, Co-Founder & President, Intellagentic
  # Last updated: {date}

  WHAT THIS IS -- 2-3 paragraph overview
  ARCHITECTURE -- ASCII art diagram showing Browser -> S3/CloudFront +
    Streamline -> Lambdas -> PostgreSQL
  TECH STACK -- Frontend + Backend + Database + Hosting
  FILE STRUCTURE -- full tree with descriptions
  COMPONENT MAP -- tree showing component hierarchy
  ROUTING -- table of routes, components, purposes
  STREAMLINE WEBHOOK INTEGRATION -- action_type values, URL pattern,
    card states, Sync/Independent
  CONFIGURABLE BUTTONS SYSTEM -- Configuration page layout, defaults
  SEED DATA SCHEMA -- all entities, fields, relationships
  DATABASE -- ER diagram in ASCII art, table descriptions, indexes
  LAMBDA API -- endpoints with request/response JSON payloads
  DEPLOY -- infrastructure IDs, config, commands
  BUILD HISTORY -- chronological entries
  PENDING ITEMS -- checklist
  BOTTOM LINE -- live URL, demo script, closing statement

================================================================
14. CLAUDE.md TEMPLATE
================================================================

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code)
when working with code in this repository.

## Build and Development

  npm run dev        # Vite dev server (localhost:5173)
  npm run build      # Production build to dist/
  npm run preview    # Preview production build locally
  npm run lint       # ESLint

## Deploy

Frontend:
  npm run build
  aws s3 sync dist/ s3://{BUCKET}/ --delete --profile {PROFILE}
  aws cloudfront create-invalidation --distribution-id {DIST_ID} --paths "/*" --profile {PROFILE}

Lambda (update a function):
  cd lambda/{function} && zip -j /tmp/{function}.zip handler.py ../shared/db.py
  aws lambda update-function-code --function-name {function} \
    --zip-file fileb:///tmp/{function}.zip --region {REGION} --profile {PROFILE}

## Git Workflow

Always work on feature branches. Never commit directly to main.
Branch naming: feature/, fix/, docs/.
Merge to main via merge commit when work is verified.

Do not add "Co-authored-by: Claude" to git commits in this repo.

## Architecture

[Brief description of state management, theme system, routing,
webhook integration, button configuration system]

## Seed Data Schema

[Key relationships between data entities]

## Client Context

- Client: {ClientName}
- Product: {ProductName}
- Platform: Intellagentic XO
- XO Capture ID: {capture_id}
```

================================================================
END OF SKILL
================================================================

This skill is a drop-in replacement for the generic UI sections in
PROTOTYPE-SPEC.md. When Claude Code reads this file alongside the
client brief (CLAUDE-CODE-BRIEF-{PRODUCT}-FINAL.md), it builds
the entire platform layer -- layout, configuration, theming, webhook
integration, data tables, action buttons, seed data -- with zero
back and forth.

XO clears the path. You decide. Streamline acts.