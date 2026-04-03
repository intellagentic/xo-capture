"""
Regression tests for upload/lambda_function.py
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'upload'))

from test_helpers import (
    make_event, assert_status, parse_body,
    ADMIN_USER, CLIENT_USER, REGULAR_USER
)


@pytest.fixture
def mock_deps():
    mock_cur = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = None

    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = 'https://s3.example.com/presigned'

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
def upload_module():
    with patch.dict(os.environ, {'DATABASE_URL': 'postgresql://fake', 'JWT_SECRET': 'test', 'BUCKET_NAME': 'test-bucket'}):
        import importlib
        if 'lambda_function' in sys.modules:
            del sys.modules['lambda_function']
        upload_dir = os.path.join(os.path.dirname(__file__), '..', 'upload')
        sys.path.insert(0, upload_dir)
        try:
            import lambda_function
            importlib.reload(lambda_function)
            yield lambda_function
        finally:
            sys.path.remove(upload_dir)
            if 'lambda_function' in sys.modules:
                del sys.modules['lambda_function']


class TestOptionsHandler:
    def test_options_returns_200(self, upload_module, mock_deps):
        event = make_event(method='OPTIONS', path='/upload')
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 200)


class TestHandleUpload:
    def test_missing_client_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/upload', body={'files': [{'name': 'test.csv'}]})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_missing_files_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/upload', body={'client_id': 'c123'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_client_not_found_returns_404(self, upload_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.return_value = None  # client not found
        event = make_event(method='POST', path='/upload',
                           body={'client_id': 'bad', 'files': [{'name': 'f.csv'}]})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 404)

    def test_successful_upload(self, upload_module, mock_deps):
        started, _, mock_cur, mock_s3 = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.side_effect = [
            ('db-1', 'client_123'),  # _verify_client
            ('upload-id-1',),        # INSERT RETURNING id
        ]
        event = make_event(method='POST', path='/upload', body={
            'client_id': 'client_123',
            'files': [{'name': 'data.csv', 'type': 'text/csv', 'size': 1024}]
        })
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 200)
        body = parse_body(response)
        assert len(body['upload_urls']) == 1
        assert len(body['upload_ids']) == 1


class TestListUploads:
    def test_missing_client_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='GET', path='/uploads', query_params={})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_empty_list(self, upload_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.return_value = ('db-1', 'c_123')
        mock_cur.fetchall.return_value = []
        event = make_event(method='GET', path='/uploads', query_params={'client_id': 'c_123'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 200)
        assert parse_body(response)['uploads'] == []


class TestDeleteUpload:
    def test_missing_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='DELETE', path='/uploads/123', path_params={})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_not_found_returns_404(self, upload_module, mock_deps):
        started, _, mock_cur, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        mock_cur.fetchone.return_value = None
        event = make_event(method='DELETE', path='/uploads/999', path_params={'id': '999'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 404)


class TestToggleUpload:
    def test_missing_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='PUT', path='/uploads/123/toggle', path_params={})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestReplaceUpload:
    def test_missing_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/uploads/123/replace',
                           path_params={}, body={'name': 'new.csv'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_missing_filename_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/uploads/123/replace',
                           path_params={'id': '123'}, body={})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestBrandingUpload:
    def test_missing_client_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/upload/branding',
                           body={'file_type': 'logo'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_invalid_file_type_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/upload/branding',
                           body={'client_id': 'c123', 'file_type': 'video'})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestBrandingGet:
    def test_missing_client_id_returns_400(self, upload_module, mock_deps):
        started, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='GET', path='/upload/branding', query_params={})
        response = upload_module.lambda_handler(event, None)
        assert_status(response, 400)


class TestVerifyClient:
    def test_admin_can_access_any_client(self, upload_module, mock_deps):
        _, _, mock_cur, _ = mock_deps
        mock_cur.fetchone.return_value = ('db-1', 'c_123')
        db_id, s3 = upload_module._verify_client(mock_cur, 'c_123', 'any-user', is_admin=True)
        assert db_id == 'db-1'

    def test_regular_user_scoped_to_own(self, upload_module, mock_deps):
        _, _, mock_cur, _ = mock_deps
        mock_cur.fetchone.return_value = None
        db_id, s3 = upload_module._verify_client(mock_cur, 'c_123', 'user-1')
        assert db_id is None

    def test_account_scoped(self, upload_module, mock_deps):
        _, _, mock_cur, _ = mock_deps
        mock_cur.fetchone.return_value = ('db-1', 'c_123')
        db_id, s3 = upload_module._verify_client(mock_cur, 'c_123', 'user-1', is_account=True, account_id=42)
        assert db_id == 'db-1'
