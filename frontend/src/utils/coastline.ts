// Distance-to-shore calculation using OpenStreetMap coastline data via the
// public Overpass API. Coastline segments near the current position are
// fetched once and cached (re-fetched only if you move more than
// CACHE_RADIUS_KM from where they were fetched), then the shortest
// point-to-segment distance is computed locally on every check - no
// network call needed for each individual distance check.
export type LatLon = { latitude: number; longitude: number };

type CoastlineSegment = { a: LatLon; b: LatLon };

let cachedSegments: CoastlineSegment[] = [];
let cachedCenter: LatLon | null = null;
const CACHE_RADIUS_M = 3000;
const FETCH_RADIUS_M = 6000;

function haversine(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Approximate point-to-segment distance via a local equirectangular
// projection - accurate enough for coastal proximity checks over a few km,
// much cheaper than full great-circle geometry per segment.
function distanceToSegment(p: LatLon, seg: CoastlineSegment): number {
  const latRad = (p.latitude * Math.PI) / 180;
  const kx = 111320 * Math.cos(latRad);
  const ky = 110540;

  const px = p.longitude * kx;
  const py = p.latitude * ky;
  const ax = seg.a.longitude * kx;
  const ay = seg.a.latitude * ky;
  const bx = seg.b.longitude * kx;
  const by = seg.b.latitude * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

async function fetchCoastline(center: LatLon): Promise<CoastlineSegment[]> {
  const query = `[out:json][timeout:20];way["natural"="coastline"](around:${FETCH_RADIUS_M},${center.latitude},${center.longitude});out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });
  const data = await res.json();
  const segments: CoastlineSegment[] = [];
  for (const way of data.elements ?? []) {
    const geom = way.geometry ?? [];
    for (let i = 0; i < geom.length - 1; i++) {
      segments.push({
        a: { latitude: geom[i].lat, longitude: geom[i].lon },
        b: { latitude: geom[i + 1].lat, longitude: geom[i + 1].lon },
      });
    }
  }
  return segments;
}

export async function getDistanceToShore(point: LatLon): Promise<number | null> {
  const needsFetch = !cachedCenter || haversine(cachedCenter, point) > CACHE_RADIUS_M;
  if (needsFetch) {
    try {
      const fresh = await fetchCoastline(point);
      cachedSegments = fresh;
      cachedCenter = point;
    } catch (e) {
      console.warn("[coastline] fetch failed, using stale/no cache", e);
      if (cachedSegments.length === 0) return null;
    }
  }
  if (cachedSegments.length === 0) return null;
  let min = Infinity;
  for (const seg of cachedSegments) {
    const d = distanceToSegment(point, seg);
    if (d < min) min = d;
  }
  return min;
}
