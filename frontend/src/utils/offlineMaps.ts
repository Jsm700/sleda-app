// Offline map region download support.
//
// Strategy: rather than hand-writing tile image files into UrlTile's
// internal (undocumented) cache format, we let UrlTile itself request
// each tile normally by programmatically panning a MapView across the
// region's tile grid. This reuses the exact same caching mechanism
// already relied on elsewhere in the app for "previously seen regions".
import AsyncStorage from "@react-native-async-storage/async-storage";

const REGIONS_KEY = "sleda.offline_regions";
const EARTH_RADIUS_KM = 6371;

export type ZoomPreset = "walker" | "overview";

export const ZOOM_PRESETS: Record<ZoomPreset, { minZoom: number; maxZoom: number; label: string }> = {
  walker: { minZoom: 12, maxZoom: 16, label: "Пешеходец" },
  overview: { minZoom: 10, maxZoom: 13, label: "Общ преглед" },
};

export type LatLon = { latitude: number; longitude: number };

export type Tile = { x: number; y: number; z: number };

export type OfflineRegion = {
  id: string;
  name: string;
  center: LatLon;
  radiusKm: number;
  preset: ZoomPreset;
  tileCount: number;
  approxSizeMb: number;
  savedAt: string;
};

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom),
  );
}

function boundingBoxForRadius(center: LatLon, radiusKm: number) {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const lonDelta =
    (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI) / Math.cos((center.latitude * Math.PI) / 180);
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLon: center.longitude - lonDelta,
    maxLon: center.longitude + lonDelta,
  };
}

export function tilesForRegion(center: LatLon, radiusKm: number, preset: ZoomPreset): Tile[] {
  const { minZoom, maxZoom } = ZOOM_PRESETS[preset];
  const bbox = boundingBoxForRadius(center, radiusKm);
  const tiles: Tile[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lonToTileX(bbox.minLon, z);
    const xMax = lonToTileX(bbox.maxLon, z);
    const yMin = latToTileY(bbox.maxLat, z); // higher latitude -> smaller tile-y
    const yMax = latToTileY(bbox.minLat, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ x, y, z });
      }
    }
  }
  return tiles;
}

// Groups tiles by zoom level into small camera-fitting regions, so a
// programmatic pan can cover each zoom pass with a handful of camera
// moves instead of one per tile.
export function tileCenterLatLon(tile: Tile): LatLon {
  const n = Math.pow(2, tile.z);
  const lon = (tile.x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n)));
  const latitude = (latRad * 180) / Math.PI;
  return { latitude, longitude: lon };
}

const AVG_TILE_KB: Record<ZoomPreset, number> = {
  walker: 15,
  overview: 12,
};

export function estimateRegionSize(tileCount: number, preset: ZoomPreset): number {
  return Math.round((tileCount * AVG_TILE_KB[preset]) / 1024);
}

export async function loadOfflineRegions(): Promise<OfflineRegion[]> {
  try {
    const raw = await AsyncStorage.getItem(REGIONS_KEY);
    return raw ? (JSON.parse(raw) as OfflineRegion[]) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineRegion(region: Omit<OfflineRegion, "id" | "savedAt">): Promise<OfflineRegion> {
  const list = await loadOfflineRegions();
  const full: OfflineRegion = {
    ...region,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  list.push(full);
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(list));
  return full;
}

export async function deleteOfflineRegion(id: string): Promise<void> {
  const list = await loadOfflineRegions();
  const next = list.filter((r) => r.id !== id);
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(next));
}
