"""Iteration 2 backend tests: end-to-end trip lifecycle, large route PATCH,
all marker types via PATCH (not just /markers), DELETE -> 404."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL", "https://trace-fisher.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def trip_ids():
    return []


# --- 1) Full lifecycle: POST -> PATCH (route+markers+stats) -> GET ---
class TestTripFullLifecycle:
    def test_lifecycle_post_patch_get(self, session, trip_ids):
        # START -> POST /api/trips
        r = session.post(f"{API}/trips", json={"name": "TEST_lifecycle"})
        assert r.status_code == 200, r.text
        trip = r.json()
        tid = trip["id"]
        assert "_id" not in trip
        assert trip["name"] == "TEST_lifecycle"
        assert trip["ended_at"] is None
        assert trip["route"] == []
        assert trip["markers"] == []
        assert trip["distance_m"] == 0.0
        assert trip["duration_s"] == 0
        trip_ids.append(tid)

        # STOP -> PATCH with route + markers + stats + ended_at
        base = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        route = [
            {
                "latitude": 42.6977 + i * 0.0001,
                "longitude": 23.3219 + i * 0.0001,
                "timestamp": (base + timedelta(seconds=i * 5)).isoformat(),
            }
            for i in range(25)
        ]
        markers = [
            {"type": "car", "latitude": 42.6977, "longitude": 23.3219,
             "note": "parking", "timestamp": base.isoformat()},
            {"type": "fish", "latitude": 42.6980, "longitude": 23.3225,
             "note": "trout spot", "timestamp": (base + timedelta(seconds=60)).isoformat()},
            {"type": "mushroom", "latitude": 42.6985, "longitude": 23.3230,
             "note": None, "timestamp": (base + timedelta(seconds=90)).isoformat()},
        ]
        ended_at = (base + timedelta(seconds=125)).isoformat()
        payload = {
            "name": "TEST_lifecycle_done",
            "ended_at": ended_at,
            "route": route,
            "markers": markers,
            "distance_m": 532.7,
            "duration_s": 125,
        }
        r = session.patch(f"{API}/trips/{tid}", json=payload)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert "_id" not in updated
        assert updated["name"] == "TEST_lifecycle_done"
        assert updated["ended_at"] == ended_at
        assert updated["distance_m"] == 532.7
        assert updated["duration_s"] == 125
        assert len(updated["route"]) == 25
        assert len(updated["markers"]) == 3
        # Route point order/values preserved
        assert updated["route"][0]["latitude"] == pytest.approx(42.6977)
        assert updated["route"][24]["latitude"] == pytest.approx(42.6977 + 24 * 0.0001)

        # GET to verify persistence
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200, r.text
        got = r.json()
        assert "_id" not in got
        assert got["id"] == tid
        assert got["name"] == "TEST_lifecycle_done"
        assert got["ended_at"] == ended_at
        assert got["distance_m"] == 532.7
        assert got["duration_s"] == 125
        assert len(got["route"]) == 25
        assert len(got["markers"]) == 3
        marker_types = {m["type"] for m in got["markers"]}
        assert marker_types == {"car", "fish", "mushroom"}


# --- 2) PATCH with all 5 marker types (NOT via /markers endpoint) ---
class TestPatchAllMarkerTypes:
    def test_patch_persists_all_5_marker_types(self, session, trip_ids):
        r = session.post(f"{API}/trips", json={"name": "TEST_patch_markers"})
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        trip_ids.append(tid)

        ts = "2026-01-15T11:00:00+00:00"
        markers = [
            {"type": "car", "latitude": 42.1, "longitude": 23.1, "timestamp": ts},
            {"type": "fish", "latitude": 42.2, "longitude": 23.2, "timestamp": ts},
            {"type": "mushroom", "latitude": 42.3, "longitude": 23.3, "timestamp": ts},
            {"type": "hazard", "latitude": 42.4, "longitude": 23.4, "timestamp": ts},
            {"type": "water", "latitude": 42.5, "longitude": 23.5, "timestamp": ts},
        ]
        r = session.patch(f"{API}/trips/{tid}", json={"markers": markers})
        assert r.status_code == 200, r.text
        updated = r.json()
        assert "_id" not in updated
        assert len(updated["markers"]) == 5
        types = [m["type"] for m in updated["markers"]]
        assert set(types) == {"car", "fish", "mushroom", "hazard", "water"}
        # Each marker has auto-generated UUID id
        for m in updated["markers"]:
            assert isinstance(m.get("id"), str) and len(m["id"]) == 36

        # GET to verify persistence
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200
        got = r.json()
        got_types = [m["type"] for m in got["markers"]]
        assert set(got_types) == {"car", "fish", "mushroom", "hazard", "water"}

    def test_patch_invalid_marker_type_rejected(self, session, trip_ids):
        tid = trip_ids[-1]
        r = session.patch(
            f"{API}/trips/{tid}",
            json={"markers": [{"type": "bogus", "latitude": 1.0,
                               "longitude": 1.0, "timestamp": "2026-01-15T11:00:00+00:00"}]},
        )
        assert r.status_code == 422, r.text


# --- 3) Large route (100+ points) PATCH + GET ---
class TestLargeRoutePatch:
    def test_patch_large_route_150_points(self, session, trip_ids):
        r = session.post(f"{API}/trips", json={"name": "TEST_large_route"})
        assert r.status_code == 200
        tid = r.json()["id"]
        trip_ids.append(tid)

        base = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        N = 150
        route = [
            {
                "latitude": 42.0 + i * 0.0005,
                "longitude": 23.0 + i * 0.0005,
                "timestamp": (base + timedelta(seconds=i * 2)).isoformat(),
            }
            for i in range(N)
        ]
        payload = {
            "route": route,
            "distance_m": 1500.0,
            "duration_s": 300,
            "ended_at": (base + timedelta(seconds=300)).isoformat(),
        }
        r = session.patch(f"{API}/trips/{tid}", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["route"]) == N
        assert "_id" not in data

        # GET to verify
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200
        got = r.json()
        assert len(got["route"]) == N
        # Sanity: first/last preserved
        assert got["route"][0]["latitude"] == pytest.approx(42.0)
        assert got["route"][-1]["latitude"] == pytest.approx(42.0 + (N - 1) * 0.0005)
        assert got["distance_m"] == 1500.0
        assert got["duration_s"] == 300


# --- 4) List sorted desc & no _id leak (re-verify with our created ids) ---
class TestListSorted:
    def test_list_sorted_desc_includes_created(self, session, trip_ids):
        r = session.get(f"{API}/trips")
        assert r.status_code == 200, r.text
        trips = r.json()
        assert isinstance(trips, list) and len(trips) > 0
        starts = [t["started_at"] for t in trips]
        assert starts == sorted(starts, reverse=True), "trips must be sorted desc by started_at"
        for t in trips:
            assert "_id" not in t
        ids = {t["id"] for t in trips}
        for cid in trip_ids:
            assert cid in ids, f"created trip {cid} not in list"


# --- 5) DELETE then GET -> 404 ---
class TestDeleteThen404:
    def test_delete_then_get_404(self, session, trip_ids):
        # Use first trip created in lifecycle
        tid = trip_ids[0]
        r = session.delete(f"{API}/trips/{tid}")
        assert r.status_code == 200, r.text
        assert r.json().get("deleted") is True

        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 404

        # Second delete should also 404
        r = session.delete(f"{API}/trips/{tid}")
        assert r.status_code == 404
        trip_ids.remove(tid)


# --- Cleanup ---
def test_zz_cleanup_iter2(session, trip_ids):
    for tid in list(trip_ids):
        try:
            session.delete(f"{API}/trips/{tid}")
        except Exception:
            pass
