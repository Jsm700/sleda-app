from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import uuid
import json
from datetime import datetime, timezone

from r2_client import upload_base64_photo, create_presigned_upload


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
MarkerType = Literal["car", "fish", "mushroom", "hazard", "water", "poi", "note", "start", "end"]


class Marker(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: MarkerType
    latitude: float
    longitude: float
    note: Optional[str] = None
    photo: Optional[str] = None  # R2 URL after processing (was base64 JPEG on the wire)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @field_validator("id", mode="before")
    @classmethod
    def _fill_id(cls, v):
        return v if (isinstance(v, str) and v) else str(uuid.uuid4())


def _resolve_marker_photo(marker: Marker) -> Marker:
    if marker.photo and not marker.photo.startswith("http"):
        marker.photo = upload_base64_photo(marker.photo)
    return marker


class PresignRequest(BaseModel):
    content_type: str = "image/jpeg"


class PresignResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


class RoutePoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: str


class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    description: Optional[str] = None
    device_id: Optional[str] = None
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None
    route: List[RoutePoint] = Field(default_factory=list)
    markers: List[Marker] = Field(default_factory=list)
    distance_m: float = 0.0
    duration_s: int = 0


class TripCreate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    device_id: Optional[str] = None


class TripUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ended_at: Optional[str] = None
    route: Optional[List[RoutePoint]] = None
    markers: Optional[List[Marker]] = None
    distance_m: Optional[float] = None
    duration_s: Optional[int] = None


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Sleda API", "status": "ok"}


@api_router.post("/uploads/presign", response_model=PresignResponse)
async def presign_upload(payload: PresignRequest):
    result = create_presigned_upload(content_type=payload.content_type)
    return PresignResponse(**result)


@api_router.get("/stats")
async def stats(device_id: Optional[str] = None):
    """Aggregate statistics across all trips."""
    query = {"device_id": device_id} if device_id else {}
    cursor = db.trips.find(query, {"_id": 0})
    total_trips = 0
    total_distance_m = 0.0
    total_duration_s = 0
    markers_by_type: dict[str, int] = {}
    async for trip in cursor:
        total_trips += 1
        total_distance_m += float(trip.get("distance_m") or 0)
        total_duration_s += int(trip.get("duration_s") or 0)
        for m in trip.get("markers", []) or []:
            t = m.get("type")
            if t:
                markers_by_type[t] = markers_by_type.get(t, 0) + 1
    return {
        "total_trips": total_trips,
        "total_distance_m": total_distance_m,
        "total_duration_s": total_duration_s,
        "markers_by_type": markers_by_type,
    }


@api_router.get("/photos")
async def list_photos(device_id: Optional[str] = None):
    """Flat list of all photo markers across all trips - for the gallery."""
    query = {"device_id": device_id} if device_id else {}
    query["markers"] = {"$elemMatch": {"photo": {"$exists": True, "$ne": None}}}
    cursor = db.trips.find(
        query,
        {"_id": 0, "id": 1, "started_at": 1, "markers": 1},
    )
    photos: list[dict] = []
    async for trip in cursor:
        for m in trip.get("markers", []) or []:
            if m.get("photo"):
                photos.append({
                    "trip_id": trip["id"],
                    "trip_started_at": trip["started_at"],
                    "marker_id": m.get("id"),
                    "type": m.get("type"),
                    "note": m.get("note"),
                    "photo": m["photo"],
                    "timestamp": m.get("timestamp"),
                    "latitude": m.get("latitude"),
                    "longitude": m.get("longitude"),
                })
    photos.sort(key=lambda p: p.get("timestamp") or "", reverse=True)
    return photos

@api_router.post("/trips", response_model=Trip)
async def create_trip(payload: TripCreate):
    trip = Trip(name=payload.name, description=payload.description, device_id=payload.device_id)
    await db.trips.insert_one(trip.model_dump())
    return trip

@api_router.get("/trips", response_model=List[Trip])
async def list_trips(device_id: Optional[str] = None, full: bool = False):
    # By default, skip the route point array (the actual payload bloat -
    # can be thousands of GPS points per trip). Markers stay included,
    # since the archive list/thumbnails need them. Screens that need the
    # real route (Ghost Track picker) pass full=true explicitly.
    query = {"device_id": device_id} if device_id else {}
    projection = {"_id": 0} if full else {"_id": 0, "route": 0}
    cursor = db.trips.find(query, projection).sort("started_at", -1)
    docs = await cursor.to_list(length=500)
    if not full:
        for d in docs:
            d.setdefault("route", [])
    return [Trip(**d) for d in docs]

@api_router.get("/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Trip not found")
    return Trip(**doc)


@api_router.patch("/trips/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, payload: TripUpdate):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if payload.markers is not None:
        resolved_markers = [_resolve_marker_photo(m) for m in payload.markers]
        update["markers"] = [m.model_dump() for m in resolved_markers]
    if payload.route is not None:
        update["route"] = [r.model_dump() for r in payload.route]
    if not update:
        doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Trip not found")
        return Trip(**doc)
    result = await db.trips.find_one_and_update(
        {"id": trip_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Trip not found")
    return Trip(**result)


@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str):
    res = await db.trips.delete_one({"id": trip_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"deleted": True}


@api_router.post("/trips/{trip_id}/markers", response_model=Marker)
async def add_marker(trip_id: str, marker: Marker):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    marker = _resolve_marker_photo(marker)
    await db.trips.update_one(
        {"id": trip_id},
        {"$push": {"markers": marker.model_dump()}},
    )
    return marker


def _render_trip_html(trip: dict) -> str:
    safe_json = json.dumps(trip).replace("</", "<\\/")
    name = trip.get("name") or "Маршрут"
    description = trip.get("description") or ""
    return f"""<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{name} · Следа</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: #121212; color: #f2f2f2;
    font-family: -apple-system, Roboto, "Segoe UI", sans-serif;
  }}
  header {{ padding: 16px 20px 8px; }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  p.desc {{ color: #a0a0a0; font-size: 14px; margin: 0 0 12px; }}
  .stats {{ display: flex; gap: 10px; padding: 0 20px 16px; }}
  .stat {{
    flex: 1; background: #1e1e1e; border: 1px solid #2c2c2c;
    border-radius: 12px; padding: 10px; text-align: center;
  }}
  .stat .label {{ font-size: 11px; color: #909090; text-transform: uppercase; letter-spacing: .4px; }}
  .stat .value {{ font-size: 18px; font-weight: 800; margin-top: 2px; }}
  #map {{ width: 100%; height: 60vh; background: #1e1e1e; }}
  .app-cta {{
    display: block; margin: 16px 20px; padding: 14px; text-align: center;
    background: #22c55e; color: #fff; text-decoration: none;
    border-radius: 12px; font-weight: 800;
  }}
  .leaflet-popup-content-wrapper {{ background: #1e1e1e; color: #f2f2f2; }}
  .leaflet-popup-tip {{ background: #1e1e1e; }}
  .popup-photo {{ width: 180px; max-width: 100%; border-radius: 8px; margin-top: 6px; display: block; }}
  footer {{ text-align: center; color: #606060; font-size: 12px; padding: 20px; }}
  .leaflet-attribution-flag {{ display: none !important; }}
</style>
</head>
<body>
<header>
  <h1>{name}</h1>
  {f'<p class="desc">{description}</p>' if description else ''}
</header>
<div class="stats">
  <div class="stat"><div class="label">Разстояние</div><div class="value" id="stat-distance">-</div></div>
  <div class="stat"><div class="label">Време</div><div class="value" id="stat-duration">-</div></div>
  <div class="stat"><div class="label">Маркери</div><div class="value" id="stat-markers">-</div></div>
</div>
<div id="map"></div>
<a class="app-cta" href="https://play.google.com/store/apps" target="_blank" rel="noopener">Виж в приложението Следа</a>
<footer>Създадено със Следа</footer>
<script>
  const trip = {safe_json};

  function fmtDist(m) {{
    if (m < 1000) return Math.round(m) + " m";
    return (m / 1000).toFixed(2) + " km";
  }}
  function fmtDur(s) {{
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }}

  document.getElementById("stat-distance").textContent = fmtDist(trip.distance_m || 0);
  document.getElementById("stat-duration").textContent = fmtDur(trip.duration_s || 0);
  document.getElementById("stat-markers").textContent = (trip.markers || []).length;

  const route = (trip.route || []).map(p => [p.latitude, p.longitude]);
  const center = route[0] || (trip.markers && trip.markers[0]
    ? [trip.markers[0].latitude, trip.markers[0].longitude]
    : [42.6977, 23.3219]);

  const map = L.map("map", {{ zoomControl: true }}).setView(center, 13);
  L.tileLayer("https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png", {{
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 20,
  }}).addTo(map);

  if (route.length > 1) {{
    const line = L.polyline(route, {{ color: "#22c55e", weight: 4 }}).addTo(map);
    map.fitBounds(line.getBounds(), {{ padding: [30, 30] }});
  }}

  (trip.markers || []).forEach(m => {{
    const marker = L.marker([m.latitude, m.longitude]).addTo(map);
    let html = "<b>" + (m.type || "") + "</b>";
    if (m.note) html += "<br/>" + m.note;
    if (m.photo && m.photo.startsWith("http")) {{
      html += '<img class="popup-photo" src="' + m.photo + '" />';
    }}
    marker.bindPopup(html);
  }});
</script>
</body>
</html>"""


@app.get("/trip/{trip_id}", response_class=HTMLResponse)
async def public_trip_page(trip_id: str):
    doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not doc:
        return HTMLResponse("<html><body style='background:#121212;color:#fff;font-family:sans-serif;text-align:center;padding:60px 20px'><h2>Маршрутът не е намерен</h2></body></html>", status_code=404)
    return HTMLResponse(_render_trip_html(doc))


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
