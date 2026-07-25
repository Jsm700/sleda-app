// Compresses a locally-captured photo, then tries to upload it directly to
// Cloudflare R2 via a short-lived presigned URL, bypassing the backend for
// the actual bytes. If there's no connectivity at capture time, falls back
// to returning the compressed image as base64 — the backend already knows
// how to upload base64 marker photos server-side once the trip is saved,
// so no photo is ever lost, it just uploads a bit later instead of instantly.
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/src/api/client";

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.6;

export async function getPhotoForMarker(
  localUri: string,
): Promise<{ photo: string; uploaded: boolean }> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  try {
    const { upload_url, public_url } = await api.presignUpload("image/jpeg");
    const fileResponse = await fetch(manipulated.uri);
    const blob = await fileResponse.blob();
    const putResponse = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
    if (!putResponse.ok) throw new Error(`R2 upload failed: ${putResponse.status}`);
    return { photo: public_url, uploaded: true };
  } catch (e) {
    console.warn("Direct R2 upload failed, falling back to base64 for later server-side upload", e);
    const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { photo: base64, uploaded: false };
  }
}

// Convenience wrapper for call sites that only want the URL and are fine
// failing hard if there's no connectivity right now.
export async function uploadPhotoToR2(localUri: string): Promise<string> {
  const { photo, uploaded } = await getPhotoForMarker(localUri);
  if (!uploaded) {
    throw new Error("No connectivity - photo queued as base64 fallback instead of uploaded");
  }
  return photo;
}
