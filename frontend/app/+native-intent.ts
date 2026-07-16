export function redirectSystemPath({ path, initialURL }: { path: string; initialURL: string }) {
  try {
    if (initialURL && (initialURL.startsWith("content://") || initialURL.startsWith("file://") || initialURL.includes(".gpx"))) {
      return `/gpx-import?url=${encodeURIComponent(initialURL)}`;
    }
  } catch (e) {
    // ignore, fall through to default routing
  }
  return path;
}
