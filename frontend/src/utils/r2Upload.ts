// Compresses a locally-captured photo and uploads it directly to Cloudflare R2
// via a short-lived presigned URL, bypassing the backend for the actual bytes.
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "@/src/api/client";

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.6;

export async function uploadPhotoToR2(localUri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  const { upload_url, public_url } = await api.presignUpload("image/jpeg");

  const fileResponse = await fetch(manipulated.uri);
  const blob = await fileResponse.blob();

  const putResponse = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });

  if (!putResponse.ok) {
    throw new Error(`R2 upload failed: ${putResponse.status}`);
  }

  return public_url;
}
