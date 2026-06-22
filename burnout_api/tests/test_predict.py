import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import app as flask_app


@pytest.fixture
def client():
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as client:
        yield client


def test_predict_valid_input_returns_200(client):
    payload = {
        "mood_avg": 2.5,
        "task_rate": 0.6,
        "login_count": 10,
        "mood_trend": -2.0
    }

    response = client.post("/predict", json=payload)

    assert response.status_code == 200, f"Expected 200, got: {response.status_code}"

    data = response.get_json()

    assert "burnout_risk" in data,     "Response is missing 'burnout_risk' field!"
    assert "risk_probability" in data, "Response is missing 'risk_probability' field!"
    assert "status" in data,           "Response is missing 'status' field!"

    assert data["burnout_risk"] in [0, 1], f"Unexpected burnout_risk value: {data['burnout_risk']}"
    assert data["status"] == "success",    f"Expected status 'success', got: {data['status']}"
    assert 0.0 <= data["risk_probability"] <= 1.0, f"Invalid risk_probability: {data['risk_probability']}"


def test_predict_response_has_required_fields(client):
    payload = {
        "mood_avg": 3.0,
        "task_rate": 0.8,
        "login_count": 15,
        "mood_trend": 1.0
    }

    response = client.post("/predict", json=payload)
    data = response.get_json()

    assert data is not None, "Response is not valid JSON or returned empty!"

    expected_fields = ["burnout_risk", "risk_probability", "status"]
    for field in expected_fields:
        assert field in data, f"Response is missing '{field}' field! Present fields: {list(data.keys())}"


def test_predict_burnout_risk_is_binary(client):
    payload = {
        "mood_avg": 1.5,
        "task_rate": 0.3,
        "login_count": 5,
        "mood_trend": -4.0
    }

    response = client.post("/predict", json=payload)
    assert response.status_code == 200

    data = response.get_json()
    burnout_risk = data.get("burnout_risk")

    assert burnout_risk is not None, "'burnout_risk' field not found in response!"
    assert burnout_risk in [0, 1], (
        f"burnout_risk must be 0 or 1, "
        f"got: {burnout_risk} (type: {type(burnout_risk).__name__})"
    )


def test_predict_missing_field_returns_error(client):
    payload_missing = {
        "task_rate": 0.5,
        "login_count": 8,
        "mood_trend": 0.0
    }

    response = client.post("/predict", json=payload_missing)
    assert response.status_code == 200

    data = response.get_json()
    assert data is not None, "Response is not valid JSON!"

    assert data.get("status") == "error", (
        f"Expected 'error' when a required field is missing, got: {data.get('status')}"
    )
    assert "message" in data, "Error response should contain a 'message' field!"


def test_predict_get_request_returns_405(client):
    response = client.get("/predict")

    assert response.status_code == 405, (
        f"Expected 405 for GET request, got: {response.status_code}. "
        f"This endpoint should only accept POST!"
    )
