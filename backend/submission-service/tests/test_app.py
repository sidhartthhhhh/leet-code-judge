# submission_service/tests/test_app.py

import pytest
from submission_service.app import app
import json

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_create_submission_success(client, mocker):
    """
    Tests successful submission creation and queuing.
    """
    # Mock the RabbitMQ interaction to prevent real network calls during unit tests
    mock_pika = mocker.patch('submission_service.app.pika')
    
    payload = {
        "user_id": 123,
        "problem_id": 456,
        "code": "def solve():\n  return 'hello'",
        "language": "python"
    }
    response = client.post('/api/v1/submissions', data=json.dumps(payload), content_type='application/json')
    
    assert response.status_code == 202
    data = response.get_json()
    assert 'submission_id' in data
    assert data['status'] == 'PENDING'
    # Verify that RabbitMQ publish was called
    mock_pika.BlockingConnection.return_value.channel.return_value.basic_publish.assert_called_once()

def test_create_submission_missing_fields(client):
    """
    Tests the API's response to a request with missing data.
    """
    payload = {"user_id": 123, "code": "print('hello')"} # Missing problem_id and language
    response = client.post('/api/v1/submissions', data=json.dumps(payload), content_type='application/json')
    
    assert response.status_code == 400
    assert 'Missing required fields' in response.get_json()['error']

def test_get_submission_status_found(client):
    """
    Tests retrieving the status of an existing submission.
    """
    # Manually insert a submission into the mock DB for testing
    from submission_service.app import SUBMISSIONS_DB
    test_id = "test-submission-123"
    SUBMISSIONS_DB[test_id] = {"status": "PENDING", "submitted_at": "now", "result": None}

    response = client.get(f'/api/v1/submissions/{test_id}')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'PENDING'
    assert data['submission_id'] == test_id

def test_get_submission_status_not_found(client):
    """
    Tests retrieving the status of a non-existent submission.
    """
    response = client.get('/api/v1/submissions/non-existent-id')
    assert response.status_code == 404
