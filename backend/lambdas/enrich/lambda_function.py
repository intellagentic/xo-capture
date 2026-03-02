"""
XO Platform - POST /enrich Lambda
Analyzes uploaded documents using Claude API.
Reads metadata from PostgreSQL, tracks enrichment in DB.
"""

import json
import os
import boto3
import io
import csv
from datetime import datetime, timezone
from anthropic import Anthropic
from auth_helper import require_auth, get_db_connection, CORS_HEADERS

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


def lambda_handler(event, context):
    """
    Trigger AI enrichment pipeline.

    Expected input:
    {
        "client_id": "client_1234567890_abcd"
    }

    Returns:
    {
        "job_id": "client_1234567890_abcd",
        "status": "complete"
    }
    """

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Auth check
    user, err = require_auth(event)
    if err:
        return err

    conn = None
    enrichment_id = None

    try:
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id', '').strip()
        requested_model = body.get('model', '')

        if not client_id:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'client_id is required'})
            }

        # Read client metadata from DB
        conn = get_db_connection()
        cur = conn.cursor()

        # Also read user's preferred_model as fallback
        cur.execute(
            "SELECT COALESCE(preferred_model, 'claude-opus-4-5-20250529') FROM users WHERE id = %s",
            (user['user_id'],)
        )
        user_row = cur.fetchone()
        db_model = user_row[0] if user_row else 'claude-opus-4-5-20250529'

        # Priority: request body > user preference > default
        allowed_models = ['claude-opus-4-5-20250529', 'claude-sonnet-4-20250514']
        model_to_use = requested_model if requested_model in allowed_models else db_model
        print(f"Using model: {model_to_use}")

        cur.execute("""
            SELECT company_name, website_url, contact_name, contact_title,
                   contact_linkedin, industry, description, pain_point, id
            FROM clients
            WHERE s3_folder = %s AND user_id = %s
        """, (client_id, user['user_id']))

        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Client not found'})
            }

        company_name = row[0] or 'Unknown Company'
        website = row[1] or ''
        contact_name = row[2] or ''
        contact_title = row[3] or ''
        contact_linkedin = row[4] or ''
        industry = row[5] or ''
        description = row[6] or ''
        pain_point = row[7] or ''
        db_client_id = row[8]

        # Create enrichment tracking record
        cur.execute("""
            INSERT INTO enrichments (client_id, status)
            VALUES (%s, 'processing')
            RETURNING id
        """, (str(db_client_id),))
        enrichment_id = cur.fetchone()[0]
        conn.commit()

        # Read skills from DB (with S3 fallback)
        skills = read_skills_from_db(cur, db_client_id, client_id)
        print(f"Loaded {len(skills)} skills for client: {client_id}")

        cur.close()

        # Extract text from uploaded files (still from S3)
        extracted_text = extract_all_files(client_id)

        if not extracted_text:
            # Update enrichment status to error
            cur2 = conn.cursor()
            cur2.execute("""
                UPDATE enrichments SET status = 'error', completed_at = NOW()
                WHERE id = %s
            """, (str(enrichment_id),))
            conn.commit()
            cur2.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'No files found to analyze'})
            }

        # Call Claude API with First Party Trick prompt
        print(f"Analyzing {len(extracted_text)} files for client: {client_id}")
        analysis = analyze_with_claude(
            company_name, website, contact_name, contact_title,
            contact_linkedin, industry, description, pain_point, extracted_text, skills,
            model=model_to_use
        )

        # Write results to S3
        results_key = f"{client_id}/results/analysis.json"
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=results_key,
            Body=json.dumps(analysis, indent=2),
            ContentType='application/json'
        )

        # Update enrichment status to complete
        cur3 = conn.cursor()
        cur3.execute("""
            UPDATE enrichments
            SET status = 'complete', completed_at = NOW(), results_s3_key = %s
            WHERE id = %s
        """, (results_key, str(enrichment_id)))
        conn.commit()
        cur3.close()
        conn.close()

        print(f"Analysis complete for client: {client_id}")

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'job_id': client_id,
                'status': 'complete'
            })
        }

    except Exception as e:
        print(f"Error during enrichment: {str(e)}")
        import traceback
        traceback.print_exc()

        # Update enrichment status to error if we have a record
        if conn and enrichment_id:
            try:
                cur_err = conn.cursor()
                cur_err.execute("""
                    UPDATE enrichments SET status = 'error', completed_at = NOW()
                    WHERE id = %s
                """, (str(enrichment_id),))
                conn.commit()
                cur_err.close()
            except Exception:
                pass

        if conn:
            try:
                conn.close()
            except Exception:
                pass

        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def read_skills_from_db(cur, db_client_id, client_id):
    """Read skills from DB, with S3 fallback for s3_key-only skills."""
    skills = []

    try:
        cur.execute("""
            SELECT name, content, s3_key FROM skills WHERE client_id = %s
        """, (str(db_client_id),))

        for row in cur.fetchall():
            name, content, s3_key = row

            if content:
                skills.append({'name': name, 'content': content})
            elif s3_key:
                # Fallback: read from S3
                try:
                    file_obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=s3_key)
                    skill_content = file_obj['Body'].read().decode('utf-8')
                    skills.append({'name': name, 'content': skill_content})
                except Exception as e:
                    print(f"Error reading skill from S3 ({s3_key}): {e}")

    except Exception as e:
        print(f"Error reading skills from DB: {e}")
        # Fallback to S3 listing
        skills = read_skills_from_s3(client_id)

    return skills


def read_skills_from_s3(client_id):
    """Fallback: Read all skill files from S3 skills folder."""
    skills = []

    try:
        response = s3_client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=f"{client_id}/skills/"
        )

        if 'Contents' not in response:
            return skills

        for obj in response['Contents']:
            key = obj['Key']
            filename = key.split('/')[-1]

            if not filename or not filename.endswith('.md'):
                continue

            file_obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
            skill_content = file_obj['Body'].read().decode('utf-8')
            skills.append({
                'name': filename.replace('.md', ''),
                'content': skill_content
            })

    except Exception as e:
        print(f"Error reading skills from S3: {e}")

    return skills


def extract_all_files(client_id):
    """Extract text from all uploaded files"""
    extracted_text = {}

    try:
        response = s3_client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=f"{client_id}/uploads/"
        )

        if 'Contents' not in response:
            return extracted_text

        for obj in response['Contents']:
            key = obj['Key']
            filename = key.split('/')[-1]

            if not filename or filename == '':
                continue

            print(f"Processing file: {filename}")

            file_obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
            file_content = file_obj['Body'].read()

            text = extract_text(filename, file_content)
            if text:
                extracted_text[filename] = text

    except Exception as e:
        print(f"Error extracting files: {str(e)}")

    return extracted_text


def extract_text(filename, file_content):
    """Extract text from different file types"""
    ext = filename.lower().split('.')[-1]

    try:
        if ext == 'csv':
            return extract_csv(file_content)
        elif ext == 'txt':
            return file_content.decode('utf-8')
        elif ext in ['xlsx', 'xls']:
            return extract_excel(file_content)
        elif ext == 'pdf':
            return extract_pdf(file_content)
        else:
            print(f"Unsupported file type: {ext}")
            return None

    except Exception as e:
        print(f"Error extracting {filename}: {str(e)}")
        return None


def extract_csv(file_content):
    """Extract text from CSV file"""
    try:
        content = file_content.decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)

        text = "CSV Data:\n"
        text += f"Total rows: {len(rows)}\n\n"

        if rows:
            text += "Header: " + ", ".join(rows[0]) + "\n\n"
            text += "Sample data (first 10 rows):\n"
            for i, row in enumerate(rows[1:11]):
                text += f"Row {i+1}: " + ", ".join(row) + "\n"

        return text

    except Exception as e:
        print(f"Error parsing CSV: {str(e)}")
        return str(file_content[:1000])


def extract_excel(file_content):
    """Extract text from Excel file"""
    try:
        import openpyxl
        from io import BytesIO

        wb = openpyxl.load_workbook(BytesIO(file_content), data_only=True)
        text = "Excel Data:\n\n"

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            text += f"Sheet: {sheet_name}\n"
            text += f"Rows: {sheet.max_row}, Columns: {sheet.max_column}\n\n"

            text += "Sample data (first 10 rows):\n"
            for i, row in enumerate(sheet.iter_rows(max_row=10, values_only=True)):
                text += f"Row {i+1}: " + ", ".join([str(cell) if cell else "" for cell in row]) + "\n"
            text += "\n"

        return text

    except Exception as e:
        print(f"Error parsing Excel: {str(e)}")
        return f"Excel file with {len(file_content)} bytes"


def extract_pdf(file_content):
    """Extract text from PDF file"""
    try:
        from pypdf import PdfReader
        from io import BytesIO

        pdf = PdfReader(BytesIO(file_content))
        text = f"PDF Document ({len(pdf.pages)} pages):\n\n"

        for i, page in enumerate(pdf.pages[:10]):
            page_text = page.extract_text()
            if page_text:
                text += f"--- Page {i+1} ---\n{page_text}\n\n"

        return text

    except Exception as e:
        print(f"Error parsing PDF: {str(e)}")
        return f"PDF file with {len(file_content)} bytes"


def analyze_with_claude(company_name, website, contact_name, contact_title,
                        contact_linkedin, industry, description, pain_point, extracted_text, skills=None,
                        model='claude-opus-4-5-20250529'):
    """
    Call Claude API with First Party Trick prompt.
    Returns structured analysis JSON.
    """

    files_summary = "\n\n".join([
        f"=== {filename} ===\n{text[:5000]}"
        for filename, text in extracted_text.items()
    ])

    enrichment_info = []
    if website:
        enrichment_info.append(f"Company Website: {website}")
    if contact_name:
        enrichment_info.append(f"Primary Contact: {contact_name}" + (f" ({contact_title})" if contact_title else ""))
    if contact_linkedin:
        enrichment_info.append(f"Contact LinkedIn: {contact_linkedin}")
    if industry:
        enrichment_info.append(f"Industry: {industry}")
    if description:
        enrichment_info.append(f"Description: {description}")
    if pain_point:
        enrichment_info.append(f"Immediate Pain Point: {pain_point}")

    enrichment_section = "\n".join(enrichment_info) if enrichment_info else "Not provided"

    skills_section = ""
    if skills and len(skills) > 0:
        skills_section = "\n\nDOMAIN-SPECIFIC SKILLS & INSTRUCTIONS:\n"
        skills_section += "The following skills provide domain-specific knowledge and analysis instructions. Use these to enhance your analysis:\n\n"
        for skill in skills:
            skills_section += f"=== SKILL: {skill['name']} ===\n{skill['content']}\n\n"

    pain_point_section = ""
    if pain_point:
        pain_point_section = f"\n\nPRIORITY: The client has identified this as their immediate pain point: '{pain_point}'. Make this the #1 problem in your analysis. Lead the executive summary with it, ensure it appears first in the problems list with specific evidence and a concrete recommendation, and front-load the 30-day action plan with steps that directly address it."

    prompt = f"""You are an MBA-level business analyst conducting a First Party Trick analysis. You have been given access to internal documents from a company. Analyze this business and provide strategic insights.

COMPANY INFORMATION:
Company Name: {company_name}
{enrichment_section}

CLIENT DATA (Uploaded Documents):
{files_summary}
{skills_section}
TASK:
Analyze this business like an MBA analyst presenting on Monday morning.{pain_point_section}

Provide:

1. EXECUTIVE SUMMARY: 2-3 paragraph overview of the business, operations, and financial indicators based on the data provided.

2. PROBLEMS IDENTIFIED: Top 3-5 critical business problems. For each problem:
   - Title (clear, specific)
   - Severity (high/medium/low)
   - Evidence (specific data points from documents)
   - Recommendation (actionable solution)

3. PROPOSED DATA SCHEMA: Design a database schema to manage this business. Include:
   - 3-5 core tables
   - For each table: name, purpose, key columns (name, type, description)
   - Relationships between tables

4. 30/60/90 DAY ACTION PLAN:
   - 30-day: Immediate actions to stabilize and assess
   - 60-day: Quick wins and process improvements
   - 90-day: Strategic initiatives and measurement

OUTPUT FORMAT:
Return ONLY valid JSON in this exact structure:
{{
  "status": "complete",
  "summary": "executive summary text...",
  "problems": [
    {{
      "title": "Problem Title",
      "severity": "high|medium|low",
      "evidence": "specific evidence from data...",
      "recommendation": "actionable recommendation..."
    }}
  ],
  "schema": {{
    "tables": [
      {{
        "name": "table_name",
        "purpose": "what this table stores",
        "columns": [
          {{"name": "column_name", "type": "data_type", "description": "what it stores"}}
        ]
      }}
    ]
  }},
  "plan": [
    {{
      "phase": "30-day",
      "actions": ["action 1", "action 2", "action 3"]
    }},
    {{
      "phase": "60-day",
      "actions": ["action 1", "action 2", "action 3"]
    }},
    {{
      "phase": "90-day",
      "actions": ["action 1", "action 2", "action 3"]
    }}
  ],
  "sources": [
    {{"type": "client_data", "reference": "filename or data source"}}
  ]
}}

Be specific. Use actual data from the documents. Think like a management consultant."""

    try:
        message = anthropic_client.messages.create(
            model=model,
            max_tokens=8000,
            temperature=0.7,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text

        if '```json' in response_text:
            start = response_text.find('```json') + 7
            end = response_text.find('```', start)
            response_text = response_text[start:end].strip()
        elif '```' in response_text:
            start = response_text.find('```') + 3
            end = response_text.find('```', start)
            response_text = response_text[start:end].strip()

        analysis = json.loads(response_text)

        analysis['analyzed_at'] = datetime.now(timezone.utc).isoformat()
        analysis['analyzed_files'] = list(extracted_text.keys())

        return analysis

    except Exception as e:
        print(f"Error calling Claude API: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "summary": "Analysis failed",
            "problems": [],
            "schema": {"tables": []},
            "plan": [],
            "sources": []
        }
