"""
XO Capture - Streamline Builder Lambda
POST /build-workflow — Claude-orchestrated workflow creation via Bedrock tool-use

Architecture:
  1. Receive app_data from the Results page (title, problem, workflow, integrations, outcome)
  2. Invoke Bedrock Converse with tool-use — Claude generates the Streamline project schema
  3. Execute tool call: POST schema to Streamline Schema API
  4. Return result with project URL and steps needing manual config
"""

import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
import boto3
from datetime import datetime, timezone
from auth_helper import require_auth, get_db_connection, CORS_HEADERS, log_activity

from streamline_tools import TOOLS, SYSTEM_PROMPT
from streamline_api import create_project

BEDROCK_REGION = os.environ.get('BEDROCK_REGION', 'eu-west-2')
AWS_BEARER_TOKEN_BEDROCK = os.environ.get('AWS_BEARER_TOKEN_BEDROCK', '')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'xo-client-data-mv')

# Use Sonnet for speed — schema generation doesn't need Opus
BEDROCK_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'

bedrock_client = None if AWS_BEARER_TOKEN_BEDROCK else boto3.client('bedrock-runtime', region_name=BEDROCK_REGION)


def _invoke_bedrock(messages, system_prompt, tools=None):
    """Call Bedrock Converse API with tool-use support."""
    body = {
        "messages": messages,
        "system": [{"text": system_prompt}],
        "inferenceConfig": {"maxTokens": 8000, "temperature": 0.3},
    }
    if tools:
        body["toolConfig"] = {"tools": tools}

    if AWS_BEARER_TOKEN_BEDROCK:
        encoded_model = urllib.parse.quote(BEDROCK_MODEL_ID, safe='')
        url = f"https://bedrock-runtime.{BEDROCK_REGION}.amazonaws.com/model/{encoded_model}/converse"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': f'Bearer {AWS_BEARER_TOKEN_BEDROCK}'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode('utf-8'))
    else:
        return bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=messages,
            system=[{"text": system_prompt}],
            toolConfig={"tools": tools} if tools else {},
            inferenceConfig={"maxTokens": 8000, "temperature": 0.3}
        )


def _execute_tool(tool_name, tool_input):
    """Execute a tool call and return the result."""
    if tool_name == 'create_streamline_project':
        schema = tool_input.get('schema', {})
        try:
            result = create_project(schema)
            project_id = result.get('id', result.get('_id', ''))
            return {
                'success': True,
                'project_id': str(project_id),
                'project': result,
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
    else:
        return {'error': f'Unknown tool: {tool_name}'}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    user, err = require_auth(event)
    if err:
        return err

    try:
        response = _handle_build(event, user)
    except Exception as e:
        print(f"Build workflow error: {e}")
        response = {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }

    log_activity(event, response, user)
    return response


def _handle_build(event, user):
    """POST /build-workflow — orchestrate workflow creation."""
    body = json.loads(event.get('body', '{}'))
    client_id = body.get('client_id', '').strip()
    engagement_id = body.get('engagement_id', '').strip() or None
    app_index = body.get('app_index', 0)
    app_data = body.get('app_data', {})

    if not client_id or not app_data.get('title'):
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'client_id and app_data.title are required'})
        }

    # Load client context
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT company_name, industry, description FROM clients WHERE s3_folder = %s", (client_id,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Client not found'})}

    client_name = row[0] or 'Client'
    industry = row[1] or ''
    description = row[2] or ''

    # Get DB client ID for tracking
    cur.execute("SELECT id FROM clients WHERE s3_folder = %s", (client_id,))
    db_client_id = str(cur.fetchone()[0])

    # Build the user message for Claude
    workflow_steps = app_data.get('workflow', [])
    if isinstance(workflow_steps, str):
        workflow_steps = [s.strip() for s in workflow_steps.split('→')]

    user_message = f"""Build a Streamline project for this application:

Client: {client_name}
Industry: {industry}
Description: {description}

Application Title: {app_data.get('title', '')}
Problem: {app_data.get('problem', '')}
Workflow Steps: {' → '.join(workflow_steps)}
Integrations: {app_data.get('integrations', '')}
Expected Outcome: {app_data.get('outcome', '')}

Generate the complete Streamline project schema and create it using the create_streamline_project tool.
Name the project: "{client_name} - {app_data.get('title', 'Workflow')}"
Map each workflow step to the correct Streamline step type.
Wire edges to connect steps in sequence.
Report which steps need manual UI configuration."""

    print(f"Building workflow: {app_data.get('title')} for {client_name}")

    # Converse with tool-use loop
    messages = [{"role": "user", "content": [{"text": user_message}]}]
    max_turns = 5
    project_id = None
    project_result = None
    needs_ui_config = []
    steps_created = []

    for turn in range(max_turns):
        response = _invoke_bedrock(messages, SYSTEM_PROMPT, TOOLS)
        output = response.get('output', {}).get('message', {})
        stop_reason = response.get('stopReason', '')

        # Add assistant message to conversation
        messages.append({"role": "assistant", "content": output.get('content', [])})

        if stop_reason == 'tool_use':
            # Process tool calls
            tool_results = []
            for block in output.get('content', []):
                if block.get('toolUse'):
                    tool_use = block['toolUse']
                    tool_name = tool_use['name']
                    tool_input = tool_use['input']
                    tool_id = tool_use['toolUseId']

                    print(f"Tool call: {tool_name}")
                    result = _execute_tool(tool_name, tool_input)

                    if result.get('success') and result.get('project_id'):
                        project_id = result['project_id']
                        project_result = result.get('project', {})

                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_id,
                            "content": [{"json": result}]
                        }
                    })

            messages.append({"role": "user", "content": tool_results})
        else:
            # Claude finished — extract summary from final text
            for block in output.get('content', []):
                if block.get('text'):
                    text = block['text']
                    # Parse out steps needing UI config from Claude's response
                    if 'manual' in text.lower() or 'ui config' in text.lower():
                        for line in text.split('\n'):
                            line_lower = line.lower().strip()
                            if any(kw in line_lower for kw in ['data search', 'deliver data', 'transform', 'manual', 'ui config']):
                                if line.strip() and line.strip().startswith('-'):
                                    needs_ui_config.append(line.strip().lstrip('- '))
            break

    # Store result in workflow_builds table
    try:
        cur.execute("""
            INSERT INTO workflow_builds (client_id, engagement_id, app_index, app_title,
                streamline_project_id, status, steps_json, needs_ui_config, completed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING id
        """, (
            db_client_id,
            engagement_id,
            app_index,
            app_data.get('title', ''),
            project_id or '',
            'complete' if project_id else 'error',
            json.dumps(steps_created),
            json.dumps(needs_ui_config),
        ))
        build_id = str(cur.fetchone()[0])
        conn.commit()
    except Exception as e:
        print(f"Failed to store workflow build: {e}")
        build_id = None
    finally:
        cur.close()
        conn.close()

    if project_id:
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'build_id': build_id,
                'project_id': project_id,
                'project': project_result,
                'needs_ui_config': needs_ui_config,
            })
        }
    else:
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': 'Failed to create Streamline project',
                'build_id': build_id,
            })
        }
