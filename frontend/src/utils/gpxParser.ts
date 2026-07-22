// GPX 1.1 parser — extracts route points and waypoints from GPX XML string.

export type GpxPoint = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

export type GpxWaypoint = {
  latitude: number;
  longitude: number;
  name: string;
  desc?: string;
  sym?: string;
};

export type ParsedGpx = {
  name: string;
  description?: string;
  route: GpxPoint[];
  waypoints: GpxWaypoint[];
};

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
}

function inner(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : "";
}

function all(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*/>`, "g");
  return xml.match(re) ?? [];
}

export function parseGpx(xml: string): ParsedGpx {
  const name = inner(xml, "name") || "Импортиран маршрут";
  const description = inner(xml, "desc") || undefined;

  const trkpts = all(xml, "trkpt");
  const route: GpxPoint[] = trkpts.map((pt) => ({
    latitude: parseFloat(attr(pt, "lat")),
    longitude: parseFloat(attr(pt, "lon")),
    timestamp: inner(pt, "time") || new Date().toISOString(),
  })).filter((p) => !isNaN(p.latitude) && !isNaN(p.longitude));

  const wpts = all(xml, "wpt");
  const waypoints: GpxWaypoint[] = wpts.map((wpt) => ({
    latitude: parseFloat(attr(wpt, "lat")),
    longitude: parseFloat(attr(wpt, "lon")),
    name: inner(wpt, "name") || "",
    desc: inner(wpt, "desc") || undefined,
    sym: inner(wpt, "sym") || undefined,
  })).filter((p) => !isNaN(p.latitude) && !isNaN(p.longitude));

  return { name, description, route, waypoints };
}
