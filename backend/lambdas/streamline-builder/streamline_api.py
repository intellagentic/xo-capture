"""
Streamline Schema API client — declarative project creation.
Base URL: https://api-us.streamline.intellistack.ai
Auth: Bearer token (Personal Access Token)
"""

import os
import json
import urllib.request
import urllib.error

API_BASE = os.environ.get('STREAMLINE_API_BASE', 'https://api-us.streamline.intellistack.ai')
API_KEY = os.environ.get('STREAMLINE_API_KEY', '')


def _api(method, path, body=None):
    """Make an authenticated Streamline API call."""
    url = f"{API_BASE}{path}"
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace')
        print(f"Streamline API {method} {path} -> {e.code}: {error_body[:500]}")
        raise Exception(f"Streamline API error {e.code}: {error_body[:200]}")


def create_project(schema):
    """POST /v1/projects — create full project from declarative JSON schema.

    The schema should contain the complete project definition:
    {
        "name": "Project Name",
        "workflows": [{
            "name": "Workflow Name",
            "steps": [...],
            "edges": [...]
        }]
    }

    Returns the created project object with id, url, etc.
    """
    return _api('POST', '/v1/projects', schema)


def get_project(project_id):
    """GET /v1/projects/{id} — retrieve project details."""
    return _api('GET', f'/v1/projects/{project_id}')


def list_projects():
    """GET /v1/projects — list all projects."""
    return _api('GET', '/v1/projects')


def start_webhook_listening(project_id, workflow_id, step_id):
    """Enable webhook listening mode for field binding.
    PATCH the step to set listeningModeEnabled: true."""
    return _api('PATCH', f'/v1/projects/{project_id}/workflows/{workflow_id}/steps/{step_id}', {
        'listeningModeEnabled': True
    })


def send_test_webhook(webhook_url, payload):
    """POST test payload to webhook URL to bind fields."""
    headers = {'Content-Type': 'application/json'}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(f"{webhook_url}?test=true", data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Test webhook failed: {e}")
        return None


def stop_webhook_listening(project_id, workflow_id, step_id):
    """Disable webhook listening mode after field binding."""
    return _api('PATCH', f'/v1/projects/{project_id}/workflows/{workflow_id}/steps/{step_id}', {
        'listeningModeEnabled': False
    })
