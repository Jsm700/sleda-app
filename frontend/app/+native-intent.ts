export function redirectSystemPath({ path, initialURL }: { path: string; initialURL: string }) {
  console.log("NATIVE_INTENT path:", path, "initialURL:", initialURL);
  try {
    if (initialURL && (initialURL.startsWith("content://") || initialURL.startsWith("file://") || initialURL.includes(".gpx"))) {
      console.log("NATIVE_INTENT redirecting to gpx-import");
      return `/gpx-import?url=${encodeURIComponent(initialURL)}`;
    }
  } catch (e) {
    console.log("NATIVE_INTENT error:", e);
  }
  return path;
}
