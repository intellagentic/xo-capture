"""
Regression tests for auth/lambda_function.py
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'auth'))

from test_helpers import make_event, assert_status, parse_body


@pytest.fixture
def mock_db():
    """Patch psycopg2.connect to return a fake connection."""
    with patch('psycopg2.connect') as mock_connect:
        mock_cur = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cur
        mock_connect.return_value = mock_conn
        yield mock_connect, mock_conn, mock_cur


@pytest.fixture
def auth_module():
    """Import auth lambda with env vars set (no psycopg2 patch -- individual tests use mock_db)."""
    with patch.dict(os.environ, {
        'DATABASE_URL': 'postgresql://fake',
        'JWT_SECRET': 'test-secret-key-for-testing',
        'GOOGLE_CLIENT_ID': 'test-google-client-id',
    }):
        import importlib
        if 'lambda_function' in sys.modules:
            del sys.modules['lambda_function']
        auth_dir = os.path.join(os.path.dirname(__file__), '..', 'auth')
        sys.path.insert(0, auth_dir)
        try:
            import lambda_function
            importlib.reload(lambda_function)
            yield lambda_function
        finally:
            sys.path.remove(auth_dir)
            if 'lambda_function' in sys.modules:
                del sys.modules['lambda_function']


class TestOptionsHandler:
    def test_options_returns_200(self, auth_module):
        event = make_event(method='OPTIONS', path='/auth/login')
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 200)


class TestLogin:
    def test_missing_email_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/login', body={'password': 'test1234'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_missing_password_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/login', body={'email': 'a@b.com'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_new_user_short_password_returns_400(self, auth_module, mock_db):
        _, _, mock_cur = mock_db
        mock_cur.fetchone.return_value = None  # user not found
        event = make_event(method='POST', path='/auth/login',
                           body={'email': 'new@test.com', 'password': 'short'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)
        assert 'at least 8' in parse_body(response)['error']

    def test_wrong_password_returns_401(self, auth_module, mock_db):
        _, _, mock_cur = mock_db
        import bcrypt
        real_hash = bcrypt.hashpw(b'correct-password', bcrypt.gensalt()).decode()
        mock_cur.fetchone.return_value = (
            'uid-1', 'user@test.com', real_hash, 'User', 'claude-sonnet-4-5-20250929', 'client', None
        )
        event = make_event(method='POST', path='/auth/login',
                           body={'email': 'user@test.com', 'password': 'wrong-password'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 401)


class TestRegister:
    def test_duplicate_email_returns_409(self, auth_module, mock_db):
        _, _, mock_cur = mock_db
        mock_cur.fetchone.return_value = ('existing-id',)
        event = make_event(method='POST', path='/auth/register',
                           body={'email': 'dup@test.com', 'password': 'password123', 'name': 'Dup'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 409)

    def test_short_password_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/register',
                           body={'email': 'new@test.com', 'password': '123'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestResetPassword:
    def test_missing_fields_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/reset-password',
                           body={'email': 'a@b.com'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_short_new_password_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/reset-password',
                           body={'email': 'a@b.com', 'new_password': '123'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_unknown_email_returns_404(self, auth_module, mock_db):
        _, _, mock_cur = mock_db
        mock_cur.fetchone.return_value = None
        event = make_event(method='POST', path='/auth/reset-password',
                           body={'email': 'nobody@test.com', 'new_password': 'newpass123'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 404)


class TestValidateToken:
    def test_missing_token_returns_400(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/token', body={})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_invalid_token_returns_401(self, auth_module, mock_db):
        _, _, mock_cur = mock_db
        mock_cur.fetchone.return_value = None  # token not found
        event = make_event(method='POST', path='/auth/token',
                           body={'token': 'bad-token'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 401)


class TestMagicLink:
    def test_create_magic_link_no_auth_returns_401(self, auth_module, mock_db):
        event = make_event(method='POST', path='/auth/magic-link',
                           body={'client_id': 'client_123'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 401)

    def test_get_magic_link_missing_client_id_returns_400(self, auth_module, mock_db):
        import jwt as pyjwt
        token = pyjwt.encode(
            {'user_id': 'u1', 'email': 'a@b.com', 'role': 'admin', 'is_admin': True,
             'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
            'test-secret-key-for-testing', algorithm='HS256'
        )
        event = make_event(method='GET', path='/auth/magic-link',
                           headers={'Authorization': f'Bearer {token}'},
                           query_params={})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_delete_magic_link_missing_client_id_returns_400(self, auth_module, mock_db):
        import jwt as pyjwt
        token = pyjwt.encode(
            {'user_id': 'u1', 'email': 'a@b.com', 'role': 'admin', 'is_admin': True,
             'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
            'test-secret-key-for-testing', algorithm='HS256'
        )
        event = make_event(method='DELETE', path='/auth/magic-link',
                           headers={'Authorization': f'Bearer {token}'},
                           query_params={})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestPreferences:
    def test_invalid_model_returns_400(self, auth_module, mock_db):
        import jwt as pyjwt
        token = pyjwt.encode(
            {'user_id': 'u1', 'email': 'a@b.com',
             'exp': datetime.now(timezone.utc) + timedelta(hours=1)},
            'test-secret-key-for-testing', algorithm='HS256'
        )
        event = make_event(method='PUT', path='/auth/preferences',
                           body={'preferred_model': 'gpt-4-fake'},
                           headers={'Authorization': f'Bearer {token}'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_no_auth_returns_401(self, auth_module, mock_db):
        event = make_event(method='PUT', path='/auth/preferences',
                           body={'preferred_model': 'claude-sonnet-4-5-20250929'})
        response = auth_module.lambda_handler(event, None)
        assert_status(response, 401)


class TestMakeToken:
    def test_make_token_structure(self, auth_module):
        import jwt as pyjwt
        token = auth_module._make_token('uid', 'e@t.com', 'Name', role='admin')
        decoded = pyjwt.decode(token, 'test-secret-key-for-testing', algorithms=['HS256'])
        assert decoded['user_id'] == 'uid'
        assert decoded['email'] == 'e@t.com'
        assert decoded['is_admin'] is True
        assert decoded['is_account'] is False

    def test_make_token_account_includes_account_id(self, auth_module):
        import jwt as pyjwt
        token = auth_module._make_token('uid', 'e@t.com', 'Name', role='partner', account_id=42)
        decoded = pyjwt.decode(token, 'test-secret-key-for-testing', algorithms=['HS256'])
        assert decoded['account_id'] == 42
        assert decoded['is_account'] is True

    def test_make_token_client_includes_client_id(self, auth_module):
        import jwt as pyjwt
        token = auth_module._make_token('uid', 'e@t.com', 'Name', role='client', client_id='c_123')
        decoded = pyjwt.decode(token, 'test-secret-key-for-testing', algorithms=['HS256'])
        assert decoded['client_id'] == 'c_123'
        assert decoded['is_client'] is True
