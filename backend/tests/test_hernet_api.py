"""HerNet backend API tests - covers auth, contacts, SOS, admin, public endpoints."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    # Fallback to reading frontend/.env
    from pathlib import Path
    env_path = Path('/app/frontend/.env')
    for line in env_path.read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip()
            break
BASE_URL = BASE_URL.rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hernet.com"
ADMIN_PASSWORD = "HerNet@Admin2025"

# Unique emails per test run to avoid collisions
RUN_ID = uuid.uuid4().hex[:8]
USER_EMAIL = f"test_user_{RUN_ID}@hernet.com"
USER_PASSWORD = "User@12345"
AUTH_EMAIL = f"test_auth_{RUN_ID}@hernet.com"
AUTH_PASSWORD = "Auth@12345"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user_auth(session):
    r = session.post(f"{API}/auth/register", json={
        "email": USER_EMAIL, "password": USER_PASSWORD,
        "name": "Test User", "phone": "+10000000001", "role": "user"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def authority_auth(session):
    r = session.post(f"{API}/auth/register", json={
        "email": AUTH_EMAIL, "password": AUTH_PASSWORD,
        "name": "Test Authority", "phone": "+10000000002", "role": "authority"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def admin_auth(session):
    r = session.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "role": "admin"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return {"token": r.json()["token"], "user": r.json()["user"]}


def _hdr(token): return {"Authorization": f"Bearer {token}"}


# --- Health ---
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# --- Auth ---
class TestAuth:
    def test_register_user(self, user_auth):
        assert user_auth["token"]
        assert user_auth["user"]["role"] == "user"
        assert user_auth["user"]["email"] == USER_EMAIL

    def test_register_authority(self, authority_auth):
        assert authority_auth["user"]["role"] == "authority"

    def test_register_duplicate_email(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": USER_EMAIL, "password": USER_PASSWORD, "name": "Dup", "role": "user"
        })
        assert r.status_code == 400

    def test_admin_login_seeded(self, admin_auth):
        assert admin_auth["user"]["role"] == "admin"
        assert admin_auth["user"]["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_login_role_mismatch(self, session):
        # admin account logging in as "user" role => 403
        r = session.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "role": "user"
        })
        assert r.status_code == 403

    def test_me_with_token(self, session, user_auth):
        r = session.get(f"{API}/auth/me", headers=_hdr(user_auth["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == USER_EMAIL

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Contacts ---
class TestContacts:
    def test_contacts_crud(self, session, user_auth):
        token = user_auth["token"]
        # Create
        r = session.post(f"{API}/contacts", headers=_hdr(token), json={
            "name": "Mom", "phone": "+19991112222", "relation": "family"
        })
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["name"] == "Mom"
        # List -> verify persistence
        r2 = session.get(f"{API}/contacts", headers=_hdr(token))
        assert r2.status_code == 200
        assert any(c["id"] == cid for c in r2.json())
        # Delete
        r3 = session.delete(f"{API}/contacts/{cid}", headers=_hdr(token))
        assert r3.status_code == 200
        # Verify removed
        r4 = session.get(f"{API}/contacts", headers=_hdr(token))
        assert not any(c["id"] == cid for c in r4.json())

    def test_contacts_requires_auth(self, session):
        r = session.get(f"{API}/contacts")
        assert r.status_code == 401


# --- SOS ---
class TestSOS:
    def test_trigger_and_my(self, session, user_auth):
        token = user_auth["token"]
        r = session.post(f"{API}/sos/trigger", headers=_hdr(token), json={
            "lat": 12.97, "lng": 77.59, "threat_level": "high", "note": "test alert"
        })
        assert r.status_code == 200, r.text
        body = r.json()
        # New shape: {alert: {...}, notify_summary: {sms:{...}, email:{...}}}
        assert "alert" in body and "notify_summary" in body, body
        alert = body["alert"]
        assert alert["status"] == "active"
        assert alert["threat_level"] == "high"
        # Graceful degradation: keys empty in .env -> configured False, 0 sent/failed
        summary = body["notify_summary"]
        assert set(summary.keys()) >= {"sms", "email"}
        for ch in ("sms", "email"):
            assert summary[ch]["configured"] is False
            assert summary[ch]["sent"] == 0
            assert summary[ch]["failed"] == 0
            assert isinstance(summary[ch]["errors"], list)
        pytest.alert_id = alert["id"]
        # Persistence: alert must still be saved in Mongo
        r2 = session.get(f"{API}/sos/my", headers=_hdr(token))
        assert r2.status_code == 200
        assert any(a["id"] == alert["id"] for a in r2.json())

    def test_active_as_authority(self, session, authority_auth):
        r = session.get(f"{API}/sos/active", headers=_hdr(authority_auth["token"]))
        assert r.status_code == 200
        assert any(a["id"] == pytest.alert_id for a in r.json())

    def test_active_as_user_forbidden(self, session, user_auth):
        r = session.get(f"{API}/sos/active", headers=_hdr(user_auth["token"]))
        assert r.status_code == 403

    def test_resolve_as_authority(self, session, authority_auth):
        r = session.post(f"{API}/sos/{pytest.alert_id}/resolve",
                         headers=_hdr(authority_auth["token"]),
                         json={"resolution_note": "handled"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "resolved"
        # Verify no longer in active feed
        r2 = session.get(f"{API}/sos/active", headers=_hdr(authority_auth["token"]))
        assert not any(a["id"] == pytest.alert_id for a in r2.json())

    def test_resolve_as_user_forbidden(self, session, user_auth):
        # create a new alert by user then try to resolve as user
        tr = session.post(f"{API}/sos/trigger", headers=_hdr(user_auth["token"]),
                          json={"threat_level": "low"})
        aid = tr.json()["alert"]["id"]
        r = session.post(f"{API}/sos/{aid}/resolve", headers=_hdr(user_auth["token"]),
                         json={"resolution_note": "x"})
        assert r.status_code == 403


# --- Notifications status (graceful-degradation integration) ---
class TestNotificationsStatus:
    def test_requires_auth(self, session):
        r = session.get(f"{API}/notifications/status")
        assert r.status_code == 401

    def test_status_with_empty_keys(self, session, user_auth):
        r = session.get(f"{API}/notifications/status", headers=_hdr(user_auth["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data == {"sms_enabled": False, "email_enabled": False}

    def test_trigger_with_authority_recipient_still_degrades(self, session, user_auth, authority_auth):
        # Ensure an authority exists (fixture creates one) so email_recipients is non-empty,
        # but because RESEND_API_KEY is empty, no email should be sent and no exception raised.
        r = session.post(f"{API}/sos/trigger", headers=_hdr(user_auth["token"]),
                         json={"threat_level": "medium", "note": "degradation-check"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "alert" in body and body["alert"]["status"] == "active"
        s = body["notify_summary"]
        assert s["sms"]["configured"] is False
        assert s["email"]["configured"] is False
        assert s["sms"]["sent"] == 0 and s["sms"]["failed"] == 0
        assert s["email"]["sent"] == 0 and s["email"]["failed"] == 0


# --- Admin ---
class TestAdmin:
    def test_stats(self, session, admin_auth):
        r = session.get(f"{API}/admin/stats", headers=_hdr(admin_auth["token"]))
        assert r.status_code == 200
        data = r.json()
        for k in ("total_users", "total_authorities", "active_alerts", "resolved_alerts", "total_alerts"):
            assert k in data
            assert isinstance(data[k], int)

    def test_stats_as_user_forbidden(self, session, user_auth):
        r = session.get(f"{API}/admin/stats", headers=_hdr(user_auth["token"]))
        assert r.status_code == 403

    def test_users_list(self, session, admin_auth):
        r = session.get(f"{API}/admin/users", headers=_hdr(admin_auth["token"]))
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert ADMIN_EMAIL in emails
        assert USER_EMAIL in emails


# --- Location ---
class TestLocation:
    def test_ping(self, session, user_auth):
        r = session.post(f"{API}/location/ping", headers=_hdr(user_auth["token"]),
                         json={"lat": 12.9, "lng": 77.5, "accuracy": 10.0})
        assert r.status_code == 200
        assert r.json()["ok"] is True


# --- Public ---
class TestPublic:
    def test_newsletter_subscribe(self, session):
        r = session.post(f"{API}/newsletter/subscribe",
                         json={"email": f"news_{RUN_ID}@example.com"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_contact_message(self, session):
        r = session.post(f"{API}/contact", json={
            "name": "Tester", "email": f"contact_{RUN_ID}@example.com",
            "message": "Hello from tests"
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True
