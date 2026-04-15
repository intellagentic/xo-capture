"""
XO Platform - GET /rapid-prototype/:id Lambda
Generates a Claude Code-ready markdown build specification
from enrichment results + client metadata.
"""

import json
import os
import re
from datetime import datetime
import boto3
from auth_helper import require_auth, get_db_connection, CORS_HEADERS, log_activity
try:
    from crypto_helper import unwrap_client_key, decrypt_s3_body, maybe_decrypt_s3_body
except ImportError:
    def unwrap_client_key(x): return None
    def decrypt_s3_body(k, b): return b if isinstance(b, str) else b.decode('utf-8', errors='replace') if b else ''
    def maybe_decrypt_s3_body(k, b, enabled=True): return decrypt_s3_body(k, b)

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data-mv')


def lambda_handler(event, context):
    """
    Generate a rapid prototype spec for a client.

    Path parameter: client_id (s3_folder)

    Returns markdown file as attachment.
    """

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Auth check
    user, err = require_auth(event)
    if err:
        log_activity(event, err)
        return err

    response = _handle_prototype(event, user)
    log_activity(event, response, user)
    return response


def _handle_prototype(event, user):
    try:
        path_params = event.get('pathParameters', {})
        client_id = path_params.get('id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        # Query client metadata from DB
        conn = get_db_connection()
        cur = conn.cursor()

        if user.get('is_admin'):
            cur.execute("""
                SELECT company_name, website_url, contact_name, contact_title,
                       industry, description, pain_point, encryption_key
                FROM clients
                WHERE s3_folder = %s
            """, (client_id,))
        else:
            cur.execute("""
                SELECT company_name, website_url, contact_name, contact_title,
                       industry, description, pain_point, encryption_key
                FROM clients
                WHERE s3_folder = %s AND user_id = %s
            """, (client_id, user['user_id']))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }

        ck = unwrap_client_key(row[7]) if row[7] else None

        company_name = row[0] or 'Unknown Company'
        website_url = row[1] or ''
        contact_name = row[2] or ''
        contact_title = row[3] or ''
        industry = row[4] or ''
        description = row[5] or ''
        pain_point = row[6] or ''

        # Read analysis.json from S3 (decrypt with client key)
        s3_key = f"{client_id}/results/analysis.json"
        try:
            response = s3_client.get_object(Bucket=BUCKET_NAME, Key=s3_key)
            raw = response['Body'].read()
            decrypted = maybe_decrypt_s3_body(ck, raw)
            analysis = json.loads(decrypted)
        except s3_client.exceptions.NoSuchKey:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No analysis results found. Run enrichment first.'})
            }

        # Build the markdown spec
        md = build_spec(
            client_id=client_id,
            company_name=company_name,
            website_url=website_url,
            contact_name=contact_name,
            contact_title=contact_title,
            industry=industry,
            description=description,
            pain_point=pain_point,
            analysis=analysis
        )

        # Return as markdown attachment
        response_headers = {
            **CORS_HEADERS,
            'Content-Type': 'text/markdown',
            'Content-Disposition': 'attachment; filename=PROTOTYPE-SPEC.md'
        }

        return {
            'statusCode': 200,
            'headers': response_headers,
            'body': md
        }

    except Exception as e:
        print(f"Error generating prototype spec: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def build_spec(client_id, company_name, website_url, contact_name,
               contact_title, industry, description, pain_point, analysis):
    """Build the full markdown prototype spec."""

    today = datetime.utcnow().strftime('%Y-%m-%d')
    problems = analysis.get('problems', [])
    schema = analysis.get('schema', {})
    tables = schema.get('tables', [])
    relationships = schema.get('relationships', [])
    plan = analysis.get('plan', [])
    sources = analysis.get('sources', [])

    lines = []

    # Title
    lines.append(f"# {company_name} -- Rapid Prototype Spec")
    lines.append("")

    # Metadata
    lines.append(f"- **Capture ID:** {client_id}")
    lines.append(f"- **Generated:** {today}")
    pain_short = (pain_point[:200] + '...') if len(pain_point or '') > 200 else (pain_point or '')
    lines.append(f"- **Pain Point Target:** {pain_short}")
    lines.append("")

    # WHAT THIS IS
    lines.append("## WHAT THIS IS")
    lines.append("")
    lines.append(f"A rapid prototype that demonstrates how IntellagenticXO addresses {company_name}'s priority operational pain points.")
    lines.append("")

    # THE CLIENT
    lines.append("## THE CLIENT")
    lines.append("")
    lines.append(f"- **Company:** {company_name}")
    if industry:
        lines.append(f"- **Industry:** {industry}")
    if description:
        lines.append(f"- **Description:** {description}")
    if contact_name:
        lines.append(f"- **Contact:** {contact_name}")
    if contact_title:
        lines.append(f"- **Title:** {contact_title}")
    if website_url:
        lines.append(f"- **Website:** {website_url}")
    lines.append("")

    # THE PROBLEM
    lines.append("## THE PROBLEM")
    lines.append("")
    summary_text = analysis.get('summary', '')
    if not summary_text and problems:
        summary_text = problems[0].get('evidence', '')
    if summary_text:
        lines.append(f"**Overview:** {summary_text}")
        lines.append("")

    if problems:
        # Sort by severity -- critical first
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        sorted_problems = sorted(
            problems,
            key=lambda p: severity_order.get(p.get('severity', 'low'), 4)
        )

        primary = sorted_problems[0]
        lines.append(f"**Primary Problem ({primary.get('severity', 'high').upper()}):** {primary.get('title', '')}")
        lines.append("")
        if primary.get('evidence'):
            lines.append(f"**Evidence:** {primary['evidence']}")
            lines.append("")
        if primary.get('recommendation'):
            lines.append(f"**Recommendation:** {primary['recommendation']}")
            lines.append("")

        if len(sorted_problems) > 1:
            lines.append("**Additional Context:**")
            for p in sorted_problems[1:]:
                sev = p.get('severity', '').upper()
                title = p.get('title', '')
                lines.append(f"- [{sev}] {title}")
            lines.append("")

    # PROPOSED ARCHITECTURE
    arch_diagram = analysis.get('architecture_diagram', '')
    if arch_diagram:
        lines.append("## PROPOSED ARCHITECTURE")
        lines.append("")
        lines.append("```")
        lines.append(arch_diagram)
        lines.append("```")
        lines.append("")

    # COMPONENT REUSE MAP
    component_mapping = analysis.get('component_mapping', {})
    if component_mapping and (component_mapping.get('fits') or component_mapping.get('extends') or component_mapping.get('new_components')):
        lines.append("## COMPONENT REUSE MAP")
        lines.append("")
        lines.append("Before building anything new, check what IntellagenticXO already has.")
        lines.append("")
        if component_mapping.get('summary_line'):
            lines.append(f"**{component_mapping['summary_line']}**")
            lines.append("")
        for fit in component_mapping.get('fits', []):
            lines.append(f"### FITS -- {fit.get('component', '')} {fit.get('version', '')}")
            lines.append(f"- Capability: {fit.get('capability', '')}")
            lines.append(f"- Action: deploy existing component with config")
            if fit.get('config_notes'):
                lines.append(f"- Config notes: {fit['config_notes']}")
            lines.append("")
        for ext in component_mapping.get('extends', []):
            lines.append(f"### EXTENDS -- {ext.get('component', '')} {ext.get('from_version', '')} -> {ext.get('to_version', '')}")
            lines.append(f"- Capability added: {ext.get('capability', '')}")
            if ext.get('extension_notes'):
                lines.append(f"- Extension notes: {ext['extension_notes']}")
            lines.append("")
        for new_comp in component_mapping.get('new_components', []):
            lines.append(f"### NEW COMPONENT NEEDED -- {new_comp.get('proposed_name', '')}")
            lines.append(f"- Purpose: {new_comp.get('purpose', '')}")
            if new_comp.get('justification'):
                lines.append(f"- Justification: {new_comp['justification']}")
            lines.append(f"- Action: scaffold in 01_Components/{new_comp.get('proposed_name', '')}/; this deployment funds its v1 build")
            lines.append("")

    # WHAT TO BUILD
    lines.append("## WHAT TO BUILD")
    lines.append("")

    day7_actions = []
    day14_actions = []
    day21_actions = []

    for item in plan:
        phase = item.get('phase', '')
        actions = item.get('actions', [])
        if '7' in phase:
            day7_actions = actions
        elif '14' in phase:
            day14_actions = actions
        elif '21' in phase:
            day21_actions = actions

    if day7_actions:
        lines.append("### Core Features (Week 1 -- Build These)")
        lines.append("")
        for i, action in enumerate(day7_actions, 1):
            raw = action.split('. ', 1)[-1] if '. ' in action else action
            tag_match = re.match(r'^\[[^\]]+\]', raw)
            tag = tag_match.group(0) + ' ' if tag_match else ''
            stripped = re.sub(r'^\[[^\]]+\]\s*', '', raw).strip()
            title = stripped[:60].rsplit(' ', 1)[0] + '...' if len(stripped) > 60 else stripped
            lines.append(f"**Feature {i}: {tag}{title}**")
            lines.append("")
            if len(stripped) > 60:
                lines.append(f"_{stripped}_")
                lines.append("")
            lines.append(f"- Screen: dashboard/view for this feature")
            lines.append(f"- Components: Data table, filters, action buttons")
            lines.append(f"- API: CRUD endpoints")
            lines.append("")

    if day14_actions or day21_actions:
        lines.append("### Weeks 2-3 (Validate & Decide)")
        lines.append("")
        for action in day14_actions:
            lines.append(f"- [Week 2] {action}")
        for action in day21_actions:
            lines.append(f"- [Week 3] {action}")
        lines.append("")

    # DATABASE SCHEMA
    lines.append("## DATABASE SCHEMA")
    lines.append("")

    if tables:
        for table in tables:
            table_name = table.get('name', 'unknown')
            lines.append(f"### {table_name}")
            lines.append("")
            lines.append("| Column | Type | Description |")
            lines.append("|--------|------|-------------|")
            for col in table.get('columns', []):
                col_name = col.get('name', '')
                col_type = col.get('type', '')
                col_desc = col.get('description', '')
                lines.append(f"| {col_name} | {col_type} | {col_desc} |")
            lines.append("")

        if relationships:
            lines.append("### Relationships")
            lines.append("")
            for rel in relationships:
                lines.append(f"- {rel}")
            lines.append("")
    else:
        lines.append("No schema tables defined. Build schema based on the problems and features above.")
        lines.append("")

    # SEED DATA
    lines.append("## SEED DATA")
    lines.append("")
    lines.append("Generate synthetic seed data for all tables above. Base it on these data sources:")
    lines.append("")
    if sources:
        seen = set()
        for source in sources:
            src_type = source.get('type', 'unknown')
            src_ref = source.get('reference', source.get('name', source.get('filename', 'unknown')))
            key = f"{src_type}:{src_ref}"
            if key not in seen:
                seen.add(key)
                lines.append(f"- [{src_type}] {src_ref}")
    else:
        lines.append("- No specific sources identified. Use industry-appropriate sample data.")
    lines.append("")
    lines.append("Create at least 20 realistic records per table. Use industry-appropriate terminology.")
    lines.append("")

    # TECH STACK
    lines.append("## TECH STACK")
    lines.append("")
    lines.append("- **Frontend:** React 18 + Vite 5 (single-page app)")
    lines.append("- **Backend:** Python (Flask for local dev, AWS Lambda for production)")
    lines.append("- **Database:** PostgreSQL 15")
    lines.append("- **Styling:** CSS custom properties, dark/light theme support")
    lines.append("- **Icons:** Lucide React")
    lines.append("")

    # UI LAYOUT
    lines.append("## UI LAYOUT")
    lines.append("")
    lines.append("### Dashboard Screen")
    lines.append("")
    lines.append("- Top row: 4 stat cards (key metrics from seed data)")
    lines.append("- Main area: Data table with sortable columns, search, filters")
    lines.append("- Sidebar: Quick actions, recent activity")
    lines.append("")

    if day7_actions:
        for i, action in enumerate(day7_actions, 1):
            raw = action.split('. ', 1)[-1] if '. ' in action else action
            stripped = re.sub(r'^\[[^\]]+\]\s*', '', raw).strip()
            title = stripped[:60].rsplit(' ', 1)[0] + '...' if len(stripped) > 60 else stripped
            lines.append(f"### {title}")
            lines.append("")
            lines.append(f"- List view with filterable table")
            lines.append(f"- Detail view with edit form")
            lines.append(f"- Create/edit modal")
            lines.append("")

    # API ENDPOINTS
    lines.append("## API ENDPOINTS")
    lines.append("")

    if tables:
        for table in tables:
            table_name = table.get('name', 'unknown')
            lines.append(f"### {table_name}")
            lines.append("")
            lines.append(f"- `GET /api/{table_name}` -- List all (with pagination, filters)")
            lines.append(f"- `GET /api/{table_name}/:id` -- Get one by ID")
            lines.append(f"- `POST /api/{table_name}` -- Create new")
            lines.append(f"- `PUT /api/{table_name}/:id` -- Update existing")
            lines.append(f"- `DELETE /api/{table_name}/:id` -- Delete")
            lines.append("")

    lines.append("### Custom Endpoints")
    lines.append("")
    lines.append("- `GET /api/dashboard/stats` -- Aggregate metrics for dashboard cards")
    lines.append("- `GET /api/search?q=` -- Global search across all entities")
    lines.append("")

    # BUILD SEQUENCE
    lines.append("## BUILD SEQUENCE")
    lines.append("")
    lines.append("### Phase 1: Database")
    lines.append("- [ ] Create PostgreSQL database and tables")
    lines.append("- [ ] Run seed data script")
    lines.append("- [ ] Verify all relationships and constraints")
    lines.append("")
    lines.append("### Phase 2: API")
    lines.append("- [ ] Set up Flask app with CORS")
    lines.append("- [ ] Implement CRUD endpoints for each table")
    lines.append("- [ ] Add dashboard stats endpoint")
    lines.append("- [ ] Test all endpoints with seed data")
    lines.append("")
    lines.append("### Phase 3: Frontend")
    lines.append("- [ ] Scaffold React + Vite project")
    lines.append("- [ ] Build dashboard with stat cards and data table")
    lines.append("- [ ] Build detail/edit screens for each entity")
    lines.append("- [ ] Connect to API, add loading states and error handling")
    lines.append("")
    lines.append("### Phase 4: Verify")
    lines.append("- [ ] End-to-end walkthrough of all screens")
    lines.append("- [ ] Verify CRUD operations work correctly")
    lines.append("- [ ] Check responsive layout")
    lines.append("- [ ] Prepare 4-minute demo script")
    lines.append("")

    # BOTTOM LINE
    lines.append("## BOTTOM LINE")
    lines.append("")
    if contact_name:
        lines.append(f"This prototype demonstrates to {contact_name} that {company_name}'s operational priorities can be addressed with software -- fast, specific, and measurable.")
    else:
        lines.append(f"This prototype demonstrates that {company_name}'s operational priorities can be addressed with software -- fast, specific, and measurable.")
    lines.append("")
    lines.append("The demo walkthrough should take 4 minutes:")
    lines.append("1. Show the dashboard with real-looking data")
    lines.append("2. Click into a detail record, edit a field, save")
    lines.append("3. Create a new record from scratch")
    lines.append("4. Show how the dashboard stats update")
    lines.append("")

    # Footer
    lines.append("---")
    lines.append(f"Intellagentic | XO Capture | {client_id}")
    lines.append("")

    return '\n'.join(lines)
