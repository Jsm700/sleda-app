// Lightweight client for the Sleda backend.
// All endpoints are /api-prefixed - go through EXPO_PUBLIC_BACKEND_URL.

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type MarkerType = "car" | "fish" | "mushroom" | "hazard" | "water";

export type ApiMarker = {
  id?: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  note?: string | null;
  timestamp?: string;
};

export type ApiRoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

export type ApiTrip = {
  id: string;
  name?: string | null;
  started_at: string;
  ended_at?: string | null;
  route: ApiRoutePoint[];
  markers: ApiMarker[];
  distance_m: number;
  duration_s: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("EXPO_PUBLIC_BACKEND_URL is missing");
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTrips: () => request<ApiTrip[]>("/trips"),
  getTrip: (id: string) => request<ApiTrip>(`/trips/${id}`),
  createTrip: (name?: string) =>
    request<ApiTrip>("/trips", {
      method: "POST",
      body: JSON.stringify({ name: name ?? null }),
    }),
  updateTrip: (id: string, patch: Partial<ApiTrip>) =>
    request<ApiTrip>(`/trips/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteTrip: (id: string) =>
    request<{ deleted: boolean }>(`/trips/${id}`, { method: "DELETE" }),
};
