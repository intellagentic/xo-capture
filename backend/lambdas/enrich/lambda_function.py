"""
XO Platform - POST /enrich Lambda
Analyzes uploaded documents using Claude API
"""

import json
import os
import boto3
import io
import csv
from datetime import datetime
from anthropic import Anthropic

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

def lambda_handler(event, context):
    """
    Trigger AI enrichment pipeline

    Expected input:
    {
        "client_id": "client_1234567890_abcd"
    }

    Returns:
    {
        "job_id": "client_1234567890_abcd",
        "status": "processing"
    }
    """

    # Enable CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id', '').strip()

        if not client_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'client_id is required'})
            }

        # Read client metadata
        metadata = read_metadata(client_id)
        company_name = metadata.get('company_name', 'Unknown Company')
        website = metadata.get('website', '')
        contact_name = metadata.get('contact_name', '')
        contact_title = metadata.get('contact_title', '')
        contact_linkedin = metadata.get('contact_linkedin', '')
        industry = metadata.get('industry', '')
        description = metadata.get('description', '')

        # Extract text from uploaded files
        extracted_text = extract_all_files(client_id)

        if not extracted_text:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'No files found to analyze'})
            }

        # Call Claude API with First Party Trick prompt
        print(f"Analyzing {len(extracted_text)} files for client: {client_id}")
        analysis = analyze_with_claude(
            company_name, website, contact_name, contact_title,
            contact_linkedin, industry, description, extracted_text
        )

        # Write results to S3
        results_key = f"{client_id}/results/analysis.json"
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=results_key,
            Body=json.dumps(analysis, indent=2),
            ContentType='application/json'
        )

        print(f"Analysis complete for client: {client_id}")

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'job_id': client_id,
                'status': 'complete'
            })
        }

    except Exception as e:
        print(f"Error during enrichment: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def read_metadata(client_id):
    """Read client metadata from S3"""
    try:
        response = s3_client.get_object(
            Bucket=BUCKET_NAME,
            Key=f"{client_id}/metadata.json"
        )
        return json.loads(response['Body'].read().decode('utf-8'))
    except Exception as e:
        print(f"Error reading metadata: {str(e)}")
        return {}


def extract_all_files(client_id):
    """Extract text from all uploaded files"""
    extracted_text = {}

    try:
        # List all files in uploads folder
        response = s3_client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=f"{client_id}/uploads/"
        )

        if 'Contents' not in response:
            return extracted_text

        for obj in response['Contents']:
            key = obj['Key']
            filename = key.split('/')[-1]

            # Skip folder markers
            if not filename or filename == '':
                continue

            print(f"Processing file: {filename}")

            # Get file from S3
            file_obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
            file_content = file_obj['Body'].read()

            # Extract text based on file type
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

        # Format as text
        text = "CSV Data:\n"
        text += f"Total rows: {len(rows)}\n\n"

        # Include header and sample rows
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

            # Get sample data
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

        # Extract text from first 10 pages
        for i, page in enumerate(pdf.pages[:10]):
            page_text = page.extract_text()
            if page_text:
                text += f"--- Page {i+1} ---\n{page_text}\n\n"

        return text

    except Exception as e:
        print(f"Error parsing PDF: {str(e)}")
        return f"PDF file with {len(file_content)} bytes"


def analyze_with_claude(company_name, website, contact_name, contact_title,
                        contact_linkedin, industry, description, extracted_text):
    """
    Call Claude API with First Party Trick prompt
    Returns structured analysis JSON
    """

    # Build the prompt
    files_summary = "\n\n".join([
        f"=== {filename} ===\n{text[:5000]}"  # Limit each file to 5000 chars
        for filename, text in extracted_text.items()
    ])

    # Build enrichment context
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

    enrichment_section = "\n".join(enrichment_info) if enrichment_info else "Not provided"

    prompt = f"""You are an MBA-level business analyst conducting a First Party Trick analysis. You have been given access to internal documents from a company. Analyze this business and provide strategic insights.

COMPANY INFORMATION:
Company Name: {company_name}
{enrichment_section}

CLIENT DATA (Uploaded Documents):
{files_summary}

TASK:
Analyze this business like an MBA analyst presenting on Monday morning. Provide:

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
        # Call Claude API
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8000,
            temperature=0.7,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        # Parse response
        response_text = message.content[0].text

        # Try to extract JSON from response
        # Claude sometimes wraps JSON in markdown code blocks
        if '```json' in response_text:
            start = response_text.find('```json') + 7
            end = response_text.find('```', start)
            response_text = response_text[start:end].strip()
        elif '```' in response_text:
            start = response_text.find('```') + 3
            end = response_text.find('```', start)
            response_text = response_text[start:end].strip()

        analysis = json.loads(response_text)

        # Add metadata
        analysis['analyzed_at'] = datetime.utcnow().isoformat()
        analysis['analyzed_files'] = list(extracted_text.keys())

        return analysis

    except Exception as e:
        print(f"Error calling Claude API: {str(e)}")
        # Return error structure
        return {
            "status": "error",
            "error": str(e),
            "summary": "Analysis failed",
            "problems": [],
            "schema": {"tables": []},
            "plan": [],
            "sources": []
        }
