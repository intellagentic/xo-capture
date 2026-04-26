"""
Regression tests for enrich/lambda_function.py
Tests route dispatch, input validation, extraction helpers.
"""

import os
import sys
import json
import io
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'shared'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'enrich'))

from test_helpers import make_event, assert_status, parse_body, ADMIN_USER, REGULAR_USER


def _set_paginator(mock_s3, contents, *, pages=None):
    """Wire mock_s3.get_paginator('list_objects_v2').paginate(...) to yield
    the given Contents. If `pages` is supplied (a list of lists), spread
    Contents across multiple pages — useful for pagination regression tests.
    """
    if pages is None:
        pages = [contents]
    mock_s3.get_paginator.return_value.paginate.return_value = [
        {'Contents': p} for p in pages
    ]


@pytest.fixture
def mock_deps():
    mock_cur = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = None
    mock_cur.fetchall.return_value = []

    mock_s3 = MagicMock()
    # Default the paginator to a single empty page so tests that don't
    # care about S3 listing don't blow up. Tests that DO care override
    # mock_s3.get_paginator.return_value.paginate.return_value with their
    # own page list (use the _set_paginator helper below).
    mock_s3.get_paginator.return_value.paginate.return_value = [{'Contents': []}]
    mock_lambda = MagicMock()

    patches = {
        'get_db_connection': patch('lambda_function.get_db_connection', return_value=mock_conn),
        'require_auth': patch('lambda_function.require_auth'),
        's3_client': patch('lambda_function.s3_client', mock_s3),
        'lambda_client': patch('lambda_function.lambda_client', mock_lambda),
    }
    started = {k: p.start() for k, p in patches.items()}
    yield started, mock_conn, mock_cur, mock_s3, mock_lambda
    for p in patches.values():
        p.stop()


@pytest.fixture
def enrich_module():
    with patch.dict(os.environ, {
        'DATABASE_URL': 'postgresql://fake',
        'JWT_SECRET': 'test',
        'BUCKET_NAME': 'test-bucket',
        'ANTHROPIC_API_KEY': 'test-key',
    }):
        with patch('psycopg2.connect') as mock_connect:
            mock_cur = MagicMock()
            mock_cur.fetchone.return_value = None
            mock_cur.fetchall.return_value = []
            mock_conn = MagicMock()
            mock_conn.cursor.return_value = mock_cur
            mock_connect.return_value = mock_conn

            # Mock Anthropic
            with patch.dict(sys.modules, {'anthropic': MagicMock()}):
                import importlib
                if 'lambda_function' in sys.modules:
                    del sys.modules['lambda_function']
                enrich_dir = os.path.join(os.path.dirname(__file__), '..', 'enrich')
                sys.path.insert(0, enrich_dir)
                try:
                    import lambda_function
                    importlib.reload(lambda_function)
                    yield lambda_function
                finally:
                    sys.path.remove(enrich_dir)
                    if 'lambda_function' in sys.modules:
                        del sys.modules['lambda_function']


class TestOptionsHandler:
    def test_options_returns_200(self, enrich_module, mock_deps):
        event = make_event(method='OPTIONS', path='/enrich')
        response = enrich_module.lambda_handler(event, None)
        assert_status(response, 200)


class TestEnrichPhase1:
    def test_missing_client_id_returns_400(self, enrich_module, mock_deps):
        started, _, _, _, _ = mock_deps
        started['require_auth'].return_value = (ADMIN_USER, None)
        event = make_event(method='POST', path='/enrich', body={})
        response = enrich_module.lambda_handler(event, None)
        assert_status(response, 400)

    def test_client_not_found_returns_404(self, enrich_module, mock_deps):
        started, _, mock_cur, _, _ = mock_deps
        started['require_auth'].return_value = (REGULAR_USER, None)
        # user model query
        mock_cur.fetchone.side_effect = [
            ('claude-sonnet-4-5-20250929',),  # preferred model
            None,  # client not found
        ]
        event = make_event(method='POST', path='/enrich', body={'client_id': 'bad_client'})
        response = enrich_module.lambda_handler(event, None)
        assert_status(response, 404)

    def test_active_upload_query_uses_strict_active_predicate(self, enrich_module, mock_deps):
        """GitHub #50 — the enrich active-uploads SELECT must filter on
        `status = 'active'` only, matching the source_count predicate at
        clients/lambda_function.py:872. The legacy `OR status IS NULL`
        clause is gone now that the column is NOT NULL with default
        'active'. If the predicate ever drifts back, source_count and
        enrich retrieval will diverge again — which is the bug class
        the issue documents."""
        started, _, mock_cur, _, mock_lambda = mock_deps
        started['require_auth'].return_value = (REGULAR_USER, None)
        mock_cur.fetchone.side_effect = [
            ('claude-opus-4-6',),  # preferred_model
            ('Acme', None, None, None, None, None, None, None,
             'db-client-uuid', REGULAR_USER['user_id']),  # clients SELECT
            ('enrich-uuid',),  # INSERT enrichments
        ]
        mock_cur.fetchall.return_value = []
        event = make_event(method='POST', path='/enrich',
                           body={'client_id': 'client_test_zzz'})
        response = enrich_module.lambda_handler(event, None)
        assert_status(response, 200)

        # Find the active-uploads SELECT in the recorded execute calls and
        # assert its predicate. If the OR-NULL clause sneaks back in, this
        # assertion fails loudly.
        active_uploads_calls = [
            c for c in mock_cur.execute.call_args_list
            if 'FROM uploads' in c[0][0] and 'client_id = %s' in c[0][0]
        ]
        assert active_uploads_calls, "Did not see the active-uploads SELECT"
        sql = active_uploads_calls[0][0][0]
        assert "status = 'active'" in sql, (
            f"Active-uploads SELECT must filter status='active' only:\n{sql}"
        )
        assert "status IS NULL" not in sql, (
            f"Active-uploads SELECT must NOT include the legacy "
            f"`OR status IS NULL` clause (GitHub #50):\n{sql}"
        )

    def test_no_request_model_no_user_row_resolves_to_opus_4_6(self, enrich_module, mock_deps):
        """Lock against silent-downgrade regression. When the request body
        carries no `model` and the users-table query returns no row, the
        async payload's `model` field MUST be 'claude-opus-4-6'. If this
        ever resolves to Sonnet/Haiku again, the Opus-everywhere production
        intent has been quietly broken."""
        started, _, mock_cur, _, mock_lambda = mock_deps
        started['require_auth'].return_value = (REGULAR_USER, None)

        # First fetchone: preferred_model query — returns None (no user row)
        # Second fetchone: clients SELECT — returns the 10-column row shape
        # Third fetchone: INSERT enrichments RETURNING id
        mock_cur.fetchone.side_effect = [
            None,
            ('Acme Co', None, None, None, None, None, None, None,
             'db-client-uuid', REGULAR_USER['user_id']),
            ('enrich-uuid',),
        ]
        # No active uploads — keeps Phase 1 short
        mock_cur.fetchall.return_value = []

        event = make_event(method='POST', path='/enrich',
                           body={'client_id': 'client_test_xyz'})
        response = enrich_module.lambda_handler(event, None)
        assert_status(response, 200)

        # Capture the async self-invoke payload
        assert mock_lambda.invoke.called, "Phase 1 must self-invoke async"
        kwargs = mock_lambda.invoke.call_args.kwargs
        payload = json.loads(kwargs['Payload'])
        assert payload['model'] == 'claude-opus-4-6', (
            f"Silent downgrade — expected Opus 4.6, got {payload['model']!r}. "
            f"Check the five fallback sites in lambda_function.py: "
            f"COALESCE in preferred_model SELECT, the 'else' fallback when "
            f"user_row is None, the async-event default, the analyze_with_claude "
            f"kwarg default, and the BEDROCK_MODEL_MAP.get fallback."
        )


class TestExtractText:
    def test_extract_plain_text(self, enrich_module):
        content = b"Hello, this is plain text content."
        result = enrich_module.extract_text("notes.txt", content)
        assert result == "Hello, this is plain text content."

    def test_extract_csv(self, enrich_module):
        csv_data = b"name,age,city\nAlice,30,NYC\nBob,25,LA"
        result = enrich_module.extract_csv(csv_data)
        assert 'Alice' in result
        assert 'Bob' in result
        assert 'name' in result

    def test_extract_csv_empty(self, enrich_module):
        result = enrich_module.extract_csv(b"")
        assert result is not None
        assert 'Total rows: 0' in result


class TestRepairTruncatedJson:
    def test_repair_valid_json(self, enrich_module):
        valid = '{"key": "value"}'
        result = enrich_module._repair_truncated_json(valid)
        # Returns parsed dict directly
        if isinstance(result, dict):
            assert result['key'] == 'value'
        else:
            assert json.loads(result)['key'] == 'value'

    def test_repair_truncated_object(self, enrich_module):
        truncated = '{"key": "value", "arr": [1, 2'
        result = enrich_module._repair_truncated_json(truncated)
        if isinstance(result, dict):
            assert result['key'] == 'value'
        else:
            assert json.loads(result)['key'] == 'value'

    def test_repair_truncated_string(self, enrich_module):
        truncated = '{"key": "val'
        result = enrich_module._repair_truncated_json(truncated)
        if isinstance(result, dict):
            assert 'key' in result
        else:
            assert 'key' in json.loads(result)


class TestFindAudioFiles:
    def test_no_audio_files(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        _set_paginator(mock_s3, [
            {'Key': 'c123/uploads/data.csv'},
            {'Key': 'c123/uploads/report.pdf'},
        ])
        result = enrich_module.find_audio_files('c123')
        assert result == []

    def test_finds_audio_files(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        _set_paginator(mock_s3, [
            {'Key': 'c123/uploads/meeting.mp3'},
            {'Key': 'c123/uploads/call.wav'},
            {'Key': 'c123/uploads/data.csv'},
        ])
        result = enrich_module.find_audio_files('c123')
        assert len(result) == 2
        assert 'c123/uploads/meeting.mp3' in result


class TestReadClientConfig:
    def test_read_unencrypted_config(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        mock_body = MagicMock()
        mock_body.read.return_value = b"# Client Config\nCompany: Test"
        mock_s3.get_object.return_value = {'Body': mock_body}

        result = enrich_module.read_client_config('c123')
        assert '# Client Config' in result

    def test_read_missing_config_returns_none(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        mock_s3.get_object.side_effect = Exception("NoSuchKey")

        result = enrich_module.read_client_config('c123')
        assert result is None


class TestUpdateEnrichmentStage:
    def test_updates_stage(self, enrich_module, mock_deps):
        _, mock_conn, mock_cur, _, _ = mock_deps
        enrich_module.update_enrichment_stage(mock_conn, 'enrich-1', 'extracting')
        assert mock_cur.execute.called
        query = mock_cur.execute.call_args[0][0]
        assert 'UPDATE enrichments' in query


class TestExtractAllFiles:
    def test_empty_uploads(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        mock_s3.list_objects_v2.return_value = {}
        result = enrich_module.extract_all_files('c123')
        assert result == {}

    def test_skips_inactive_files(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        _set_paginator(mock_s3, [
            {'Key': 'c123/uploads/active.txt'},
            {'Key': 'c123/uploads/inactive.txt'},
        ])
        mock_body = MagicMock()
        mock_body.read.return_value = b"content"
        mock_s3.get_object.return_value = {'Body': mock_body}

        result = enrich_module.extract_all_files('c123', active_keys=['c123/uploads/active.txt'])
        assert 'active.txt' in result
        assert 'inactive.txt' not in result

    def test_skips_audio_files(self, enrich_module, mock_deps):
        _, _, _, mock_s3, _ = mock_deps
        _set_paginator(mock_s3, [
            {'Key': 'c123/uploads/meeting.mp3'},
            {'Key': 'c123/uploads/notes.txt'},
        ])
        mock_body = MagicMock()
        mock_body.read.return_value = b"text content"
        mock_s3.get_object.return_value = {'Body': mock_body}

        result = enrich_module.extract_all_files('c123')
        assert 'meeting.mp3' not in result
        assert 'notes.txt' in result
