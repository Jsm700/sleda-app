export function redirectSystemPath({ path, initialURL }: { path: string; initialURL: string }) {
  console.log("NATIVE_INTENT path:", path, "initialURL:", initialURL);
  const url = path || initialURL;
  try {
    if (url && (url.startsWith("content://") || url.startsWith("file://") || url.includes(".gpx"))) {
      console.log("NATIVE_INTENT redirecting to gpx-import");
      return `/gpx-import?url=${encodeURIComponent(url)}`;
    }
  } catch (e) {
    console.log("NATIVE_INTENT error:", e);
  }
  return path;
}
