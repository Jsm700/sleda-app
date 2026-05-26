// Background location task for "Следа".
// Registered at module import time (NOT inside React) - this is required by
// expo-task-manager. The task appends every incoming location to an
// AsyncStorage queue. The foreground HomeScreen polls that queue every 2s.
//
// IMPORTANT: This file MUST be imported once at the very top of the app
// (we import it from app/_layout.tsx) so the task is registered before
// any screen tries to startLocationUpdatesAsync.
//
// LIMITATION: Background location does NOT run in Expo Go. A development
// or production build is required for the OS to keep the foreground service
// alive while the app is backgrounded / screen is locked.

import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LOCATION_TASK_NAME = "sleda-background-location";
export const ACTIVE_ROUTE_KEY = "sleda.active_route_points";
export const ACTIVE_TRIP_ID_KEY = "sleda.active_trip_id";
export const ACTIVE_TRIP_STARTED_KEY = "sleda.active_trip_started_at";

export type StoredPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

type LocationTaskBody = {
  data?: { locations?: Location.LocationObject[] };
  error?: TaskManager.TaskManagerError | null;
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: LocationTaskBody) => {
  if (error) {
    // Don't throw - just log and exit so the OS keeps the task alive.
    console.warn("[locationTask] error", error);
    return;
  }
  const locations = data?.locations;
  if (!locations || locations.length === 0) return;

  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ROUTE_KEY);
    const buf: StoredPoint[] = raw ? JSON.parse(raw) : [];
    for (const loc of locations) {
      buf.push({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
      });
    }
    await AsyncStorage.setItem(ACTIVE_ROUTE_KEY, JSON.stringify(buf));
  } catch (e) {
    console.warn("[locationTask] storage write failed", e);
  }
});

// Foreground helpers --------------------------------------------------------

export async function readStoredRoute(): Promise<StoredPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ROUTE_KEY);
    return raw ? (JSON.parse(raw) as StoredPoint[]) : [];
  } catch {
    return [];
  }
}

export async function clearStoredRoute(): Promise<void> {
  await AsyncStorage.multiRemove([
    ACTIVE_ROUTE_KEY,
    ACTIVE_TRIP_ID_KEY,
    ACTIVE_TRIP_STARTED_KEY,
  ]);
}

export async function setActiveTrip(tripId: string, startedAt: number): Promise<void> {
  await AsyncStorage.multiSet([
    [ACTIVE_TRIP_ID_KEY, tripId],
    [ACTIVE_TRIP_STARTED_KEY, String(startedAt)],
  ]);
}

export async function readActiveTrip(): Promise<{
  id: string | null;
  startedAt: number | null;
}> {
  try {
    const [[, id], [, started]] = await AsyncStorage.multiGet([
      ACTIVE_TRIP_ID_KEY,
      ACTIVE_TRIP_STARTED_KEY,
    ]);
    return {
      id: id ?? null,
      startedAt: started ? Number(started) : null,
    };
  } catch {
    return { id: null, startedAt: null };
  }
}

export async function isTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}
