"""
Shared fixtures for XO Platform Lambda regression tests.
"""

import sys
import os
import json
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

# Add shared modules to path
LAMBDAS_DIR = os.path.join(os.path.dirname(__file__), '..')
TESTS_DIR = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(LAMBDAS_DIR, 'shared'))
sys.path.insert(0, TESTS_DIR)


# ── Event builders ──

def make_event(method='GET', path='/', body=None, query_params=None,
               path_params=None, headers=None, resource=None):
    event = {
        'httpMethod': method,
        'path': path,
        'resource': resource or path,
        'headers': headers or {},
        'queryStringParameters': query_params,
        'pathParameters': path_params,
    }
    if body is not None:
        event['body'] = json.dumps(body) if isinstance(body, dict) else body
    return event


def make_authed_event(method='GET', path='/', body=None, query_params=None,
                      path_params=None, token='Bearer test-jwt-token', resource=None):
    return make_event(
        method=method, path=path, body=body, query_params=query_params,
        path_params=path_params, resource=resource,
        headers={'Authorization': token}
    )


# ── Common user dicts ──

ADMIN_USER = {
    'user_id': 'admin-uuid-001', 'email': 'admin@test.com', 'name': 'Admin User',
    'role': 'admin', 'is_admin': True, 'is_account': False, 'is_client': False,
    'account_id': None, 'client_id': None,
}

PARTNER_USER = {
    'user_id': 'partner-uuid-002', 'email': 'partner@test.com', 'name': 'Partner User',
    'role': 'partner', 'is_admin': False, 'is_account': True, 'is_client': False,
    'account_id': 42, 'client_id': None,
}

CLIENT_USER = {
    'user_id': 'client-uuid-003', 'email': 'client@test.com', 'name': 'Client User',
    'role': 'client', 'is_admin': False, 'is_account': False, 'is_client': True,
    'account_id': None, 'client_id': 'client_123_abc',
}

REGULAR_USER = {
    'user_id': 'user-uuid-004', 'email': 'user@test.com', 'name': 'Regular User',
    'role': 'client', 'is_admin': False, 'is_account': False, 'is_client': False,
    'account_id': None, 'client_id': None,
}


# ── Assertions ──

def assert_status(response, code):
    assert response['statusCode'] == code, f"Expected {code}, got {response['statusCode']}: {response.get('body', '')}"


def parse_body(response):
    return json.loads(response['body'])


# ── Fixtures ──

@pytest.fixture
def admin_user():
    return ADMIN_USER.copy()

@pytest.fixture
def partner_user():
    return PARTNER_USER.copy()

@pytest.fixture
def client_user():
    return CLIENT_USER.copy()

@pytest.fixture
def regular_user():
    return REGULAR_USER.copy()
