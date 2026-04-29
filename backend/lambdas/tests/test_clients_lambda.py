"""
Regression tests for clients/lambda_function.py
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'clients'))

from test_helpers import (
    make_event, make_authed_event, assert_status, parse_body,
    ADMIN_USER, PARTNER_USER, CLIENT_USER, REGULAR_USER
)


@pytest.fixture
def mock_deps():
    """Mock DB, S3, and auth for clients lambda."""
    mock_cur = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = None
    mock_cur.fetchall.return_value = []

    mock_s3 = MagicMock()

    patches = {
        'get_db_connection': patch('lambda_function.get_db_connection', return_value=mock_conn),
        'require_auth': patch('lambda_function.require_auth'),
        's3_client': patch('lambda_function.s3_client', mock_s3),
    }
    started = {k: p.start() for k, p in patches.items()}
    yield started, mock_conn, mock_cur, mock_s3
    for p in patches.values():
        p.stop()


@pytest.fixture
def clients_module():
    """Import clients lambda."""
    with patch.dict(os.environ, {
        'DATABASE_URL': 'postgresql://fake',
        'JWT_SECRET': 'test-secret',
        'BUCKET_NAME': 'test-bucket',
    }):
        with patch('psycopg2.connect') as mock_connect:
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = None
            mock_cur.fetchall.return_value = []
            mock_conn = MagicMock()
            mock_conn.cursor.return_value = mock_cur
            mock_connect.return_value = mock_conn

            import importlib
            if 'lambda_function' in sys.modules:
                del sys.modules['lambda_function']
            clients_dir = os.path.join(os.path.dirname(__file__), '..', 'clients')
            sys.path.insert(0, clients_dir)
            try:
                import lambda_function
                importlib.reload(lambda_function)
                yield lambda_function
            finally:
                sys.path.remove(clients_dir)
                if 'lambda_function' in sys.modules:
                    del sys.modules['lambda_function']


class TestOptionsHandler:
    def test_options_returns_200(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        event = make_event(method='OPTIONS', path='/clients')
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 200)


class TestCreateClient:
    def test_missing_company_name_returns_400(self, clients_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.return_value = ('db-id-1',)

        event = make_event(method='POST', path='/clients', body={
            'website': 'https://test.com'
        })
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)
        assert 'company_name' in parse_body(response)['error']

    def test_client_user_cannot_create_client(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (CLIENT_USER, None)

        event = make_event(method='POST', path='/clients', body={
            'company_name': 'Test Corp'
        })
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)


class TestGetClient:
    def test_get_client_not_found(self, clients_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.return_value = None

        event = make_event(method='GET', path='/clients',
                           query_params={'client_id': 'nonexistent'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 404)

    def test_client_user_forced_to_own_client(self, clients_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        user = CLIENT_USER.copy()
        started['require_auth'].return_value = (user, None)
        mock_cur.fetchone.return_value = None

        event = make_event(method='GET', path='/clients',
                           query_params={'client_id': 'other_client'})
        response = clients_module.lambda_handler(event, None)
        # Should force client_id to user's own client
        assert_status(response, 404)


class TestUpdateClient:
    def test_missing_client_id_returns_400(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='PUT', path='/clients', body={
            'company_name': 'Test Corp'
        })
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_missing_company_name_returns_400(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='PUT', path='/clients', body={
            'client_id': 'c123'
        })
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestDeleteClient:
    def test_client_user_cannot_delete(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (CLIENT_USER, None)

        event = make_event(method='DELETE', path='/clients',
                           query_params={'client_id': 'c123'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_partner_user_cannot_delete(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (PARTNER_USER, None)

        event = make_event(method='DELETE', path='/clients',
                           query_params={'client_id': 'c123'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_missing_client_id_returns_400(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='DELETE', path='/clients', query_params={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestListClients:
    def test_list_returns_empty(self, clients_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchall.return_value = []

        event = make_event(method='GET', path='/clients/list')
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 200)
        body = parse_body(response)
        assert body['clients'] == []


class TestPartners:
    def test_client_user_cannot_access_partners(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (CLIENT_USER, None)

        event = make_event(method='GET', path='/partners')
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_partner_cannot_create_partner(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (PARTNER_USER, None)

        event = make_event(method='POST', path='/partners', body={'name': 'Test'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_create_partner_missing_name(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='POST', path='/partners', body={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestSkills:
    def test_create_skill_missing_name(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='POST', path='/skills', body={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_create_system_skill_requires_admin(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (PARTNER_USER, None)

        event = make_event(method='POST', path='/skills',
                           body={'name': 'test', 'scope': 'system'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_client_user_cannot_create_skill(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (CLIENT_USER, None)

        event = make_event(method='POST', path='/skills', body={'name': 'test'})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_delete_skill_missing_id(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='DELETE', path='/skills', query_params={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_update_skill_missing_id(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='PUT', path='/skills', body={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestSystemConfig:
    def test_non_admin_cannot_access_system_config(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (REGULAR_USER, None)

        event = make_event(method='GET', path='/system-config')
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 403)

    def test_update_system_config_missing_key(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)

        event = make_event(method='PUT', path='/system-config', body={})
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestInvite:
    def test_invite_missing_fields_returns_400(self, clients_module, mock_deps):
        started, _, _, _ = mock_deps

        event = make_event(method='POST', path='/invite', body={
            'company_name': 'Test Corp'
        })
        response = clients_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestGenerateClientConfig:
    def test_basic_config(self, clients_module):
        config = clients_module.generate_client_config(
            'Test Corp', 'https://test.com', 'John Doe', 'CEO',
            'https://linkedin.com/in/jd', 'Technology', 'A tech company', 'Needs automation'
        )
        assert '# Client Configuration' in config
        assert 'Test Corp' in config
        assert 'CEO' in config
        assert 'Technology' in config

    def test_config_with_contacts(self, clients_module):
        contacts = [
            {'firstName': 'Jane', 'lastName': 'Doe', 'email': 'j@test.com', 'title': 'CTO'},
            {'firstName': 'Bob', 'lastName': 'Smith', 'email': 'b@test.com'}
        ]
        config = clients_module.generate_client_config(
            'Test Corp', '', '', '', '', '', '', '',
            contacts=contacts
        )
        assert 'Jane Doe' in config
        assert 'Bob Smith' in config
        assert 'Primary Contact' in config

    def test_config_with_addresses(self, clients_module):
        addresses = [{'address1': '123 Main St', 'city': 'NY', 'state': 'NY', 'postalCode': '10001'}]
        config = clients_module.generate_client_config(
            'Test Corp', '', '', '', '', '', '', '',
            addresses=addresses
        )
        assert '123 Main St' in config
        assert 'NY' in config

    def test_config_with_pain_points(self, clients_module):
        config = clients_module.generate_client_config(
            'Test Corp', '', '', '', '', '', '', '',
            pain_points=['Slow processes', 'Data silos']
        )
        assert 'Slow processes' in config
        assert 'Data silos' in config
        assert 'Pain Points' in config
