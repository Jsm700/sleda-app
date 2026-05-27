"""Iteration 4 backend tests: /api/stats, /api/photos, extended Marker model
(photo + note + 'note' MarkerType)."""
import base64
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


def _make_b64(size_bytes: int = 4096) -> str:
    """Return a deterministic base64-encoded blob (no data URI prefix)."""
    raw = (b"\xff\xd8\xff\xe0" + b"A" * (size_bytes - 4))  # fake JPEG-ish bytes
    return base64.b64encode(raw).decode("ascii")


# Snapshot baseline so this test is independent of pre-existing DB data.
@pytest.fixture(scope="module")
def baseline_stats(session):
    r = session.get(f"{API}/stats")
    assert r.status_code == 200, r.text
    data = r.json()
    # Shape validation - works for both empty DB and seeded DB
    assert isinstance(data, dict)
    assert "total_trips" in data and isinstance(data["total_trips"], int)
    assert "total_distance_m" in data
    assert "total_duration_s" in data and isinstance(data["total_duration_s"], int)
    assert "markers_by_type" in data and isinstance(data["markers_by_type"], dict)
    return data


@pytest.fixture(scope="module")
def baseline_photos(session):
    r = session.get(f"{API}/photos")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    return data


# --- 1) GET /api/stats shape on (possibly empty) DB ---
class TestStatsShape:
    def test_stats_endpoint_shape(self, baseline_stats):
        d = baseline_stats
        assert d["total_trips"] >= 0
        assert float(d["total_distance_m"]) >= 0.0
        assert d["total_duration_s"] >= 0
        for k, v in d["markers_by_type"].items():
            assert isinstance(k, str)
            assert isinstance(v, int) and v >= 0


# --- 2) GET /api/photos baseline shape ---
class TestPhotosShape:
    def test_photos_endpoint_returns_list(self, baseline_photos):
        for p in baseline_photos:
            # Required fields
            for f in ("trip_id", "trip_started_at", "marker_id", "type",
                      "photo", "timestamp", "latitude", "longitude"):
                assert f in p, f"missing field {f} in photo entry"
            # 'note' may be None but key should exist
            assert "note" in p
            # Photo should be a non-empty string
            assert isinstance(p["photo"], str) and len(p["photo"]) > 0


# --- 3) Marker model with photo + note + type='note' round-trip via PATCH ---
class TestExtendedMarkerModel:
    def test_patch_note_marker_with_photo_persists(self, session, trip_ids):
        # Create trip
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_marker"})
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        trip_ids.append(tid)

        photo_b64 = _make_b64(5000)
        ts = "2026-01-20T10:00:00+00:00"
        markers = [
            {
                "type": "note",
                "latitude": 42.7,
                "longitude": 23.3,
                "note": "TEST_iter4 trail note with details",
                "photo": photo_b64,
                "timestamp": ts,
            }
        ]
        r = session.patch(f"{API}/trips/{tid}", json={"markers": markers})
        assert r.status_code == 200, r.text
        updated = r.json()
        assert "_id" not in updated
        assert len(updated["markers"]) == 1
        m = updated["markers"][0]
        assert m["type"] == "note"
        assert m["note"] == "TEST_iter4 trail note with details"
        assert m["photo"] == photo_b64  # exact round-trip, no truncation
        assert len(m["photo"]) == len(photo_b64)

        # GET to verify persistence
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200
        got = r.json()
        assert "_id" not in got
        assert len(got["markers"]) == 1
        gm = got["markers"][0]
        assert gm["type"] == "note"
        assert gm["photo"] == photo_b64
        assert gm["note"] == "TEST_iter4 trail note with details"

    def test_post_marker_endpoint_with_photo(self, session, trip_ids):
        """POST /api/trips/{id}/markers with photo + note via 'note' type."""
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_post_marker"})
        assert r.status_code == 200
        tid = r.json()["id"]
        trip_ids.append(tid)

        photo_b64 = _make_b64(3000)
        r = session.post(
            f"{API}/trips/{tid}/markers",
            json={
                "type": "note",
                "latitude": 42.71,
                "longitude": 23.31,
                "note": "POST endpoint note",
                "photo": photo_b64,
                "timestamp": "2026-01-20T10:05:00+00:00",
            },
        )
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["type"] == "note"
        assert m["photo"] == photo_b64
        assert m["note"] == "POST endpoint note"

        # Verify persistence via GET
        r = session.get(f"{API}/trips/{tid}")
        assert r.status_code == 200
        got = r.json()
        assert any(mk["type"] == "note" and mk["photo"] == photo_b64 for mk in got["markers"])

    def test_invalid_marker_type_rejected(self, session, trip_ids):
        """Marker type validation: only car|fish|mushroom|hazard|water|note accepted."""
        tid = trip_ids[0]
        for bad_type in ["invalid", "photo", "video", "", "NOTE"]:
            r = session.patch(
                f"{API}/trips/{tid}",
                json={
                    "markers": [
                        {"type": bad_type, "latitude": 1.0, "longitude": 1.0,
                         "timestamp": "2026-01-20T10:00:00+00:00"}
                    ]
                },
            )
            assert r.status_code == 422, f"bad_type={bad_type!r} -> {r.status_code} {r.text}"

    def test_all_six_marker_types_accepted(self, session, trip_ids):
        """car, fish, mushroom, hazard, water, note all accepted."""
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_all_types"})
        assert r.status_code == 200
        tid = r.json()["id"]
        trip_ids.append(tid)

        ts = "2026-01-20T11:00:00+00:00"
        markers = [
            {"type": t, "latitude": 42.0 + i * 0.01, "longitude": 23.0,
             "timestamp": ts}
            for i, t in enumerate(["car", "fish", "mushroom", "hazard", "water", "note"])
        ]
        r = session.patch(f"{API}/trips/{tid}", json={"markers": markers})
        assert r.status_code == 200, r.text
        types = {m["type"] for m in r.json()["markers"]}
        assert types == {"car", "fish", "mushroom", "hazard", "water", "note"}


# --- 4) /api/stats aggregates correctly after inserts ---
class TestStatsAggregation:
    def test_stats_increments_after_inserts(self, session, baseline_stats, trip_ids):
        """Create 2 trips with known stats and verify deltas in /api/stats."""
        ts = "2026-01-21T09:00:00+00:00"

        # Trip A: 100.0m, 60s, markers: 2x car, 1x fish
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_statsA"})
        assert r.status_code == 200
        tA = r.json()["id"]
        trip_ids.append(tA)
        r = session.patch(f"{API}/trips/{tA}", json={
            "distance_m": 100.0,
            "duration_s": 60,
            "markers": [
                {"type": "car", "latitude": 1.0, "longitude": 1.0, "timestamp": ts},
                {"type": "car", "latitude": 1.0, "longitude": 1.0, "timestamp": ts},
                {"type": "fish", "latitude": 1.0, "longitude": 1.0, "timestamp": ts},
            ],
        })
        assert r.status_code == 200, r.text

        # Trip B: 250.5m, 90s, markers: 1x fish, 1x note (with photo), 1x hazard
        photo_b64 = _make_b64(1500)
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_statsB"})
        assert r.status_code == 200
        tB = r.json()["id"]
        trip_ids.append(tB)
        r = session.patch(f"{API}/trips/{tB}", json={
            "distance_m": 250.5,
            "duration_s": 90,
            "markers": [
                {"type": "fish", "latitude": 2.0, "longitude": 2.0, "timestamp": ts},
                {"type": "note", "latitude": 2.0, "longitude": 2.0,
                 "note": "TEST_iter4 stats note", "photo": photo_b64, "timestamp": ts},
                {"type": "hazard", "latitude": 2.0, "longitude": 2.0, "timestamp": ts},
            ],
        })
        assert r.status_code == 200, r.text

        # Fetch new stats
        r = session.get(f"{API}/stats")
        assert r.status_code == 200, r.text
        new = r.json()

        # Trip count delta
        assert new["total_trips"] >= baseline_stats["total_trips"] + 2
        # Distance delta (allow float tolerance)
        assert new["total_distance_m"] == pytest.approx(
            baseline_stats["total_distance_m"] + 100.0 + 250.5, abs=0.01
        )
        # Duration delta
        assert new["total_duration_s"] == baseline_stats["total_duration_s"] + 60 + 90
        # markers_by_type deltas
        base_mb = baseline_stats["markers_by_type"]
        new_mb = new["markers_by_type"]
        assert new_mb.get("car", 0) >= base_mb.get("car", 0) + 2
        assert new_mb.get("fish", 0) >= base_mb.get("fish", 0) + 2
        assert new_mb.get("hazard", 0) >= base_mb.get("hazard", 0) + 1
        assert new_mb.get("note", 0) >= base_mb.get("note", 0) + 1


# --- 5) /api/photos returns only photo markers, sorted desc by timestamp ---
class TestPhotosAggregation:
    def test_photos_only_includes_photo_markers_sorted_desc(
        self, session, baseline_photos, trip_ids
    ):
        # Create a trip with mixed markers - 2 with photo, 2 without
        r = session.post(f"{API}/trips", json={"name": "TEST_iter4_photos"})
        assert r.status_code == 200
        tid = r.json()["id"]
        trip_ids.append(tid)

        base = datetime(2026, 1, 22, 10, 0, 0, tzinfo=timezone.utc)
        photo_a = _make_b64(2000)
        photo_b = _make_b64(2500)
        # photo_a is OLDER, photo_b is NEWER. Expect desc order: b then a.
        markers = [
            # No photo - should be excluded
            {"type": "car", "latitude": 42.0, "longitude": 23.0,
             "timestamp": (base + timedelta(seconds=0)).isoformat()},
            # Photo A - older
            {"type": "note", "latitude": 42.1, "longitude": 23.1,
             "note": "TEST_iter4 photoA", "photo": photo_a,
             "timestamp": (base + timedelta(seconds=60)).isoformat()},
            # No photo
            {"type": "fish", "latitude": 42.2, "longitude": 23.2,
             "timestamp": (base + timedelta(seconds=120)).isoformat()},
            # Photo B - newer
            {"type": "note", "latitude": 42.3, "longitude": 23.3,
             "note": "TEST_iter4 photoB", "photo": photo_b,
             "timestamp": (base + timedelta(seconds=180)).isoformat()},
        ]
        r = session.patch(f"{API}/trips/{tid}", json={"markers": markers})
        assert r.status_code == 200, r.text
        assert len(r.json()["markers"]) == 4

        # Fetch /api/photos
        r = session.get(f"{API}/photos")
        assert r.status_code == 200, r.text
        photos = r.json()
        assert isinstance(photos, list)

        # Only photo markers from this trip
        ours = [p for p in photos if p["trip_id"] == tid]
        assert len(ours) == 2, f"expected 2 photo markers, got {len(ours)}: {ours}"
        types = {p["type"] for p in ours}
        # Both are type 'note' here, but the contract is photo presence, not type
        assert types == {"note"}

        # Each has all required fields and base64 photo exact match
        for p in ours:
            assert p["trip_id"] == tid
            assert "trip_started_at" in p and isinstance(p["trip_started_at"], str)
            assert isinstance(p["marker_id"], str) and len(p["marker_id"]) == 36
            assert p["type"] == "note"
            assert isinstance(p["photo"], str) and len(p["photo"]) > 0
            assert "timestamp" in p
            assert isinstance(p["latitude"], (int, float))
            assert isinstance(p["longitude"], (int, float))

        # Verify exact photo content round-trips
        photo_map = {p["timestamp"]: p["photo"] for p in ours}
        assert photo_a in photo_map.values()
        assert photo_b in photo_map.values()

        # Verify entries with note field present
        notes = [p["note"] for p in ours]
        assert "TEST_iter4 photoA" in notes
        assert "TEST_iter4 photoB" in notes

        # Verify desc sort order across the WHOLE list
        timestamps = [p["timestamp"] for p in photos if p.get("timestamp")]
        assert timestamps == sorted(timestamps, reverse=True), \
            "photos must be sorted by timestamp DESC"

        # And specifically: photoB (newer) appears before photoA (older) in the list
        idx_b = next(i for i, p in enumerate(photos)
                     if p["trip_id"] == tid and p["photo"] == photo_b)
        idx_a = next(i for i, p in enumerate(photos)
                     if p["trip_id"] == tid and p["photo"] == photo_a)
        assert idx_b < idx_a, "newer photo (B) must come before older (A) in desc-sorted list"

    def test_photos_excludes_id(self, session):
        r = session.get(f"{API}/photos")
        assert r.status_code == 200
        for p in r.json():
            assert "_id" not in p


# --- 6) Photos empty list / stats zero behavior is exercised via baselines above ---
class TestPhotosEmptyContract:
    def test_photos_empty_when_no_matching_markers(self, session):
        """Even if DB has trips without any photo markers, response is a list (possibly empty)."""
        r = session.get(f"{API}/photos")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Cleanup ---
def test_zzz_cleanup_iter4(session, trip_ids):
    for tid in list(trip_ids):
        try:
            session.delete(f"{API}/trips/{tid}")
        except Exception:
            pass
