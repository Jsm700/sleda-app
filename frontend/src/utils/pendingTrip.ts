// pendingTrip.ts
// Ако backend-ът е недостъпен при край на маршрут, запазваме данните
// локално тук, в списък (не един-единствен слот) — за да не се губи
// маршрут, ако потребителят запише повече от един офлайн, преди да
// възвърне връзка. При следващо отваряне на app-а HomeScreen проверява
// дали има чакащи маршрути и опитва да ги качи наново.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sleda.pending_trip";

export type PendingTrip = {
  localId: string;               // клиентски уникален id, за премахване след успешен ъплоуд
  tripId: string | null;         // null = trip никога не е създаден в backend
  startedAt: string;
  endedAt: string;
  route: { latitude: number; longitude: number; timestamp: string }[];
  markers: {
    id?: string;
    type: string;
    latitude: number;
    longitude: number;
    note: string | null;
    photo: string | null;
    timestamp: string;
  }[];
  segments?: { type: "move" | "pause"; started_at: string; ended_at: string; distance_m: number }[];
  distance_m: number;
  duration_s: number;
};

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function savePendingTrip(
  trip: Omit<PendingTrip, "localId">,
): Promise<void> {
  try {
    const list = await loadPendingTrips();
    list.push({ ...trip, localId: makeLocalId() });
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[pendingTrip] save failed", e);
  }
}

export async function loadPendingTrips(): Promise<PendingTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as PendingTrip[];
    // Стар формат (единичен обект, отпреди списъчния storage) - мигрираме го.
    return [{ ...(parsed as Omit<PendingTrip, "localId">), localId: makeLocalId() }];
  } catch {
    return [];
  }
}

export async function clearPendingTrip(localId: string): Promise<void> {
  try {
    const list = await loadPendingTrips();
    const next = list.filter((t) => t.localId !== localId);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[pendingTrip] clear failed", e);
  }
}

export async function clearAllPendingTrips(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn("[pendingTrip] clear all failed", e);
  }
}
