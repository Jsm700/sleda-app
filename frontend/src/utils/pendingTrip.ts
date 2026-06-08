// pendingTrip.ts
// Ако backend-ът е недостъпен при край на маршрут, запазваме данните
// локално тук. При следващо отваряне на app-а HomeScreen проверява
// дали има чакащ маршрут и опитва да го качи отново.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sleda.pending_trip";

export type PendingTrip = {
  tripId: string | null;         // null = trip никога не е създаден в backend
  startedAt: string;             // ISO string
  endedAt: string;               // ISO string
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
  distance_m: number;
  duration_s: number;
};

export async function savePendingTrip(trip: PendingTrip): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(trip));
  } catch (e) {
    console.warn("[pendingTrip] save failed", e);
  }
}

export async function loadPendingTrip(): Promise<PendingTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingTrip) : null;
  } catch {
    return null;
  }
}

export async function clearPendingTrip(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn("[pendingTrip] clear failed", e);
  }
}
