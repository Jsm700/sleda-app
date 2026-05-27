from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
MarkerType = Literal["car", "fish", "mushroom", "hazard", "water", "note"]


class Marker(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: MarkerType
    latitude: float
    longitude: float
    note: Optional[str] = None
    photo: Optional[str] = None  # base64-encoded JPEG, no data URI prefix
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RoutePoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: str


class Trip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None
    route: List[RoutePoint] = Field(default_factory=list)
    markers: List[Marker] = Field(default_factory=list)
    distance_m: float = 0.0
    duration_s: int = 0


class TripCreate(BaseModel):
    name: Optional[str] = None


class TripUpdate(BaseModel):
    name: Optional[str] = None
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


@api_router.get("/stats")
async def stats():
    """Aggregate statistics across all trips."""
    cursor = db.trips.find({}, {"_id": 0})
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
async def list_photos():
    """Flat list of all photo markers across all trips - for the gallery."""
    cursor = db.trips.find(
        {"markers.photo": {"$exists": True, "$ne": None}},
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
    trip = Trip(name=payload.name)
    await db.trips.insert_one(trip.model_dump())
    return trip


@api_router.get("/trips", response_model=List[Trip])
async def list_trips():
    cursor = db.trips.find({}, {"_id": 0}).sort("started_at", -1)
    docs = await cursor.to_list(length=500)
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
    await db.trips.update_one(
        {"id": trip_id},
        {"$push": {"markers": marker.model_dump()}},
    )
    return marker


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
