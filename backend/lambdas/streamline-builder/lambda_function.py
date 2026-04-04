"""
XO Capture - Streamline Builder Lambda (async pattern)
POST /build-workflow — creates build record, self-invokes async for Bedrock + Streamline API
GET /build-workflow/{build_id} — poll for status
"""

import json
import os
import urllib.parse
import urllib.request
import urllib.error
import boto3
from datetime import datetime, timezone
from auth_helper import require_auth, get_db_connection, CORS_HEADERS, log_activity

from streamline_tools import TOOLS, SYSTEM_PROMPT, build_streamline_schema
from streamline_api import create_project

BEDROCK_REGION = os.environ.get('BEDROCK_REGION', 'eu-west-2')
AWS_BEARER_TOKEN_BEDROCK = os.environ.get('AWS_BEARER_TOKEN_BEDROCK', '')
FUNCTION_NAME = os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'xo-streamline-builder')
BEDROCK_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'

lambda_client = boto3.client('lambda', region_name='eu-west-2')
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
        # Claude provides step definitions — Python builds the actual API schema from templates
        built = build_streamline_schema(tool_input)
        manual_steps = built.pop('_manual_steps', [])
        steps = built.get('workflow', {}).get('steps', [])
        print(f"[SCHEMA] API steps: {len(steps)}, manual steps: {len(manual_steps)}")
        for i, s in enumerate(steps):
            print(f"[SCHEMA] Step {i}: type={s.get('type')}, desc={s.get('description')}")
        if manual_steps:
            print(f"[SCHEMA] Manual: {', '.join(manual_steps)}")
        try:
            result = create_project(built)
            project_id = result.get('id', result.get('_id', ''))
            print(f"[SCHEMA] Created project: {project_id}")
            return {
                'success': True,
                'project_id': str(project_id),
                'project': result,
                'manual_steps': manual_steps,
            }
        except Exception as e:
            print(f"[SCHEMA] API error: {e}")
            return {'success': False, 'error': str(e)}
    return {'error': f'Unknown tool: {tool_name}'}


def lambda_handler(event, context):
    # Async phase — self-invoked with _async flag
    if event.get('_async') and event.get('_build_id'):
        return _run_build_async(event)

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    user, err = require_auth(event)
    if err:
        return err

    path = event.get('path', '')
    method = event.get('httpMethod', '')

    try:
        if method == 'GET' and '/build-workflow/' in path:
            response = _handle_status(event, user)
        elif method == 'POST':
            response = _handle_build_start(event, user)
        else:
            response = {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}
    except Exception as e:
        print(f"Build workflow error: {e}")
        response = {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': str(e)})}

    log_activity(event, response, user)
    return response


def _handle_build_start(event, user):
    """POST /build-workflow — create record, self-invoke async, return immediately."""
    body = json.loads(event.get('body', '{}'))
    client_id = body.get('client_id', '').strip()
    engagement_id = body.get('engagement_id', '').strip() or None
    app_index = body.get('app_index', 0)
    app_data = body.get('app_data', {})

    if not client_id or not app_data.get('title'):
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'client_id and app_data.title are required'})}

    # Get DB client ID
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, company_name, industry, description FROM clients WHERE s3_folder = %s", (client_id,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Client not found'})}

    db_client_id = str(row[0])
    client_name = row[1] or 'Client'
    industry = row[2] or ''
    description = row[3] or ''

    # Create build record
    cur.execute("""
        INSERT INTO workflow_builds (client_id, engagement_id, app_index, app_title, status)
        VALUES (%s, %s, %s, %s, 'building')
        RETURNING id
    """, (db_client_id, engagement_id, app_index, app_data.get('title', '')))
    build_id = str(cur.fetchone()[0])
    conn.commit()
    cur.close()
    conn.close()

    # Self-invoke async
    lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        InvocationType='Event',
        Payload=json.dumps({
            '_async': True,
            '_build_id': build_id,
            'client_id': client_id,
            'db_client_id': db_client_id,
            'client_name': client_name,
            'industry': industry,
            'description': description,
            'app_data': app_data,
        })
    )

    print(f"Build started: {build_id} for {app_data.get('title')} ({client_name})")

    return {
        'statusCode': 202,
        'headers': CORS_HEADERS,
        'body': json.dumps({'build_id': build_id, 'status': 'building'})
    }


def _handle_status(event, user):
    """GET /build-workflow/{build_id} — check build status."""
    path = event.get('path', '')
    build_id = path.split('/build-workflow/')[-1].strip('/')

    if not build_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'build_id required'})}

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT status, streamline_project_id, steps_json, needs_ui_config, error, completed_at
        FROM workflow_builds WHERE id = %s
    """, (build_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Build not found'})}

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'build_id': build_id,
            'status': row[0],
            'project_id': row[1] or None,
            'steps': json.loads(row[2]) if row[2] else [],
            'needs_ui_config': json.loads(row[3]) if row[3] else [],
            'error': row[4] or None,
            'completed_at': row[5].isoformat() if row[5] else None,
        })
    }


def _run_build_async(event):
    """Async phase — run Bedrock + Streamline API, update workflow_builds record."""
    build_id = event['_build_id']
    client_name = event.get('client_name', 'Client')
    industry = event.get('industry', '')
    description = event.get('description', '')
    app_data = event.get('app_data', {})

    print(f"[async] Building: {build_id} — {app_data.get('title')} for {client_name}")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
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

        messages = [{"role": "user", "content": [{"text": user_message}]}]
        max_turns = 5
        project_id = None
        needs_ui_config = []

        for turn in range(max_turns):
            response = _invoke_bedrock(messages, SYSTEM_PROMPT, TOOLS)
            output = response.get('output', {}).get('message', {})
            stop_reason = response.get('stopReason', '')

            messages.append({"role": "assistant", "content": output.get('content', [])})

            if stop_reason == 'tool_use':
                tool_results = []
                for block in output.get('content', []):
                    if block.get('toolUse'):
                        tool_use = block['toolUse']
                        print(f"[async] Tool call: {tool_use['name']}")
                        result = _execute_tool(tool_use['name'], tool_use['input'])
                        if result.get('success') and result.get('project_id'):
                            project_id = result['project_id']
                            needs_ui_config.extend(result.get('manual_steps', []))
                        tool_results.append({
                            "toolResult": {
                                "toolUseId": tool_use['toolUseId'],
                                "content": [{"json": result}]
                            }
                        })
                messages.append({"role": "user", "content": tool_results})
            else:
                for block in output.get('content', []):
                    if block.get('text'):
                        for line in block['text'].split('\n'):
                            if line.strip().startswith('-') and any(kw in line.lower() for kw in ['manual', 'ui config', 'data search', 'deliver data', 'transform']):
                                needs_ui_config.append(line.strip().lstrip('- '))
                break

        # Update record
        if project_id:
            cur.execute("""
                UPDATE workflow_builds SET status = 'complete', streamline_project_id = %s,
                    needs_ui_config = %s, completed_at = NOW()
                WHERE id = %s
            """, (project_id, json.dumps(needs_ui_config), build_id))
            print(f"[async] Build complete: {build_id} → project {project_id}")
        else:
            cur.execute("""
                UPDATE workflow_builds SET status = 'failed', error = 'No project created', completed_at = NOW()
                WHERE id = %s
            """, (build_id,))
            print(f"[async] Build failed: {build_id} — no project created")

        conn.commit()

    except Exception as e:
        print(f"[async] Build error: {build_id} — {e}")
        try:
            cur.execute("UPDATE workflow_builds SET status = 'failed', error = %s, completed_at = NOW() WHERE id = %s", (str(e), build_id))
            conn.commit()
        except Exception:
            pass
    finally:
        cur.close()
        conn.close()
