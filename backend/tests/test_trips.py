"""Backend API tests for Sleda (Следа) - trips, markers, root."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://trace-fisher.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


# --- Root ---
class TestRoot:
    def test_root_ok(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("message") == "Sleda API"
        assert data.get("status") == "ok"


# --- Create / List / Get ---
class TestTripCRUD:
    def test_create_trip_defaults(self, session, created_ids):
        r = session.post(f"{API}/trips", json={"name": "TEST_trip_1"})
        assert r.status_code == 200, r.text
        data = r.json()
        # UUID id
        assert isinstance(data.get("id"), str) and len(data["id"]) == 36
        assert data["name"] == "TEST_trip_1"
        assert isinstance(data.get("started_at"), str) and "T" in data["started_at"]
        assert data.get("ended_at") is None
        assert data.get("route") == []
        assert data.get("markers") == []
        assert data.get("distance_m") == 0.0
        assert data.get("duration_s") == 0
        assert "_id" not in data
        created_ids.append(data["id"])

    def test_create_trip_no_name(self, session, created_ids):
        r = session.post(f"{API}/trips", json={})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("name") is None
        created_ids.append(data["id"])

    def test_list_trips_sorted_desc_no_id_leak(self, session, created_ids):
        r = session.get(f"{API}/trips")
        assert r.status_code == 200, r.text
        trips = r.json()
        assert isinstance(trips, list)
        # No _id leakage
        for t in trips:
            assert "_id" not in t
        # Sorted by started_at desc
        starts = [t["started_at"] for t in trips]
        assert starts == sorted(starts, reverse=True)
        # Our created trips should appear
        ids = {t["id"] for t in trips}
        for cid in created_ids:
            assert cid in ids

    def test_get_trip_by_id(self, session, created_ids):
        tid = created_ids[0]
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == tid
        assert "_id" not in data

    def test_get_trip_404(self, session):
        r = session.get(f"{API}/trips/nonexistent-id-xyz")
        assert r.status_code == 404


# --- Update ---
class TestTripUpdate:
    def test_patch_all_fields_persist(self, session, created_ids):
        tid = created_ids[0]
        payload = {
            "name": "TEST_updated",
            "ended_at": "2026-01-01T12:00:00+00:00",
            "route": [
                {"latitude": 42.1, "longitude": 23.3, "timestamp": "2026-01-01T11:00:00+00:00"},
                {"latitude": 42.2, "longitude": 23.4, "timestamp": "2026-01-01T11:05:00+00:00"},
            ],
            "markers": [
                {"type": "fish", "latitude": 42.15, "longitude": 23.35, "timestamp": "2026-01-01T11:01:00+00:00"}
            ],
            "distance_m": 1234.5,
            "duration_s": 600,
        }
        r = session.patch(f"{API}/trips/{tid}", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_updated"
        assert data["ended_at"] == payload["ended_at"]
        assert data["distance_m"] == 1234.5
        assert data["duration_s"] == 600
        assert len(data["route"]) == 2
        assert len(data["markers"]) == 1
        assert data["markers"][0]["type"] == "fish"
        assert "_id" not in data

        # GET to verify persistence
        r2 = session.get(f"{API}/trips/{tid}")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["name"] == "TEST_updated"
        assert d2["distance_m"] == 1234.5
        assert len(d2["route"]) == 2

    def test_patch_404(self, session):
        r = session.patch(f"{API}/trips/nonexistent-id-xyz", json={"name": "x"})
        assert r.status_code == 404


# --- Markers ---
class TestMarkers:
    def test_add_marker_valid_types(self, session, created_ids):
        tid = created_ids[1]
        for mtype in ["car", "fish", "mushroom", "hazard", "water"]:
            r = session.post(
                f"{API}/trips/{tid}/markers",
                json={"type": mtype, "latitude": 42.0, "longitude": 23.0},
            )
            assert r.status_code == 200, f"{mtype}: {r.text}"
            data = r.json()
            assert data["type"] == mtype
            assert isinstance(data.get("id"), str) and len(data["id"]) == 36

        # Verify persistence
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200
        trip = r.json()
        assert len(trip["markers"]) >= 5
        types_in_trip = [m["type"] for m in trip["markers"]]
        for t in ["car", "fish", "mushroom", "hazard", "water"]:
            assert t in types_in_trip

    def test_add_marker_invalid_type(self, session, created_ids):
        tid = created_ids[1]
        r = session.post(
            f"{API}/trips/{tid}/markers",
            json={"type": "invalid", "latitude": 42.0, "longitude": 23.0},
        )
        assert r.status_code == 422, r.text

    def test_add_marker_trip_404(self, session):
        r = session.post(
            f"{API}/trips/nonexistent-xyz/markers",
            json={"type": "fish", "latitude": 1.0, "longitude": 1.0},
        )
        assert r.status_code == 404


# --- Delete ---
class TestTripDelete:
    def test_delete_and_verify_404(self, session, created_ids):
        tid = created_ids[-1]
        r = session.delete(f"{API}/trips/{tid}")
        assert r.status_code == 200, r.text
        assert r.json().get("deleted") is True

        # GET should be 404
        r2 = session.get(f"{API}/trips/{tid}")
        assert r2.status_code == 404
        created_ids.remove(tid)

    def test_delete_404(self, session):
        r = session.delete(f"{API}/trips/nonexistent-xyz")
        assert r.status_code == 404


# --- Cleanup ---
def test_zz_cleanup(session, created_ids):
    for tid in list(created_ids):
        session.delete(f"{API}/trips/{tid}")
