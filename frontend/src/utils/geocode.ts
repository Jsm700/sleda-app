// Reverse geocoding via Nominatim (OSM) - used to suggest a trip name
// based on where the route started.
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`,
      { headers: { "User-Agent": "SledaApp/1.0 (Android outdoor tracking app)" } },
    );
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return null;
    return (
      addr.village ||
      addr.town ||
      addr.city ||
      addr.hamlet ||
      addr.suburb ||
      addr.municipality ||
      addr.county ||
      null
    );
  } catch {
    return null;
  }
}
