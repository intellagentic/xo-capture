"""
Shared helper functions and constants for test modules.
Import this from test files: from test_helpers import ...
"""

import json


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


def assert_status(response, code):
    assert response['statusCode'] == code, f"Expected {code}, got {response['statusCode']}: {response.get('body', '')}"


def parse_body(response):
    return json.loads(response['body'])


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

# NOTE: is_client mirrors `role == 'client'` from auth/_make_token. All
# multi-tenant non-admin roles have users.role='client' in the DB, so their
# JWTs carry is_client=True. The differentiator from a legacy token-scoped
# user is the client_id claim (legacy: present; multi-tenant: absent).
SUPER_ADMIN_USER = {
    'user_id': 'super-admin-uuid', 'email': 'super@test.com', 'name': 'Super Admin',
    'role': 'admin', 'is_admin': True, 'is_account': False, 'is_client': False,
    'account_id': 1, 'client_id': None,
    'account_role': 'super_admin',
}

ACCOUNT_ADMIN_USER = {
    'user_id': 'acct-admin-uuid', 'email': 'acctadmin@test.com', 'name': 'Account Admin',
    'role': 'client', 'is_admin': False, 'is_account': False, 'is_client': True,
    'account_id': 2, 'client_id': None,
    'account_role': 'account_admin',
}

ACCOUNT_USER = {
    'user_id': 'acct-user-uuid', 'email': 'acctuser@test.com', 'name': 'Account User',
    'role': 'client', 'is_admin': False, 'is_account': False, 'is_client': True,
    'account_id': 2, 'client_id': None,
    'account_role': 'account_user',
}

CLIENT_CONTACT_USER = {
    'user_id': 'client-contact-uuid', 'email': 'cc@test.com', 'name': 'Client Contact',
    'role': 'client', 'is_admin': False, 'is_account': False, 'is_client': True,
    'account_id': 3, 'client_id': None,
    'account_role': 'client_contact',
}
