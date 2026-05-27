// GPX 1.1 generation + sharing helpers.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { ApiTrip } from "@/src/api/client";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoTime(value?: string | number | null): string {
  if (!value) return new Date().toISOString();
  try {
    return new Date(value).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const MARKER_LABEL: Record<string, string> = {
  car: "Car / Boat",
  fish: "Fish",
  mushroom: "Mushroom",
  hazard: "Hazard",
  water: "Water",
  note: "Note",
};

export function buildGpx(trip: ApiTrip): string {
  const head = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Sleda" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(trip.name ?? "Sleda trip")}</name>
    <time>${isoTime(trip.started_at)}</time>
  </metadata>
`;
  const waypoints = trip.markers
    .map(
      (m) => `  <wpt lat="${m.latitude}" lon="${m.longitude}">
    <time>${isoTime(m.timestamp)}</time>
    <name>${esc(MARKER_LABEL[m.type] ?? m.type)}</name>
    ${m.note ? `<desc>${esc(m.note)}</desc>` : ""}
    <sym>${esc(m.type)}</sym>
  </wpt>`,
    )
    .join("\n");
  const trk = trip.route.length > 0
    ? `  <trk>
    <name>${esc(trip.name ?? "Route")}</name>
    <trkseg>
${trip.route
  .map(
    (p) =>
      `      <trkpt lat="${p.latitude}" lon="${p.longitude}"><time>${isoTime(p.timestamp)}</time></trkpt>`,
  )
  .join("\n")}
    </trkseg>
  </trk>
`
    : "";
  return `${head}${waypoints}\n${trk}</gpx>\n`;
}

export async function shareTripAsGpx(trip: ApiTrip): Promise<void> {
  const xml = buildGpx(trip);
  const safeName = (trip.name ?? trip.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `sleda_${safeName}.gpx`;
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  const path = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(path, xml, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(path, {
    dialogTitle: "Export GPX",
    mimeType: "application/gpx+xml",
    UTI: "com.topografix.gpx",
  });
}
