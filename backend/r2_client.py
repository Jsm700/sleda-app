import os
import uuid
import base64
import boto3
from botocore.config import Config

R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET_NAME = os.environ["R2_BUCKET_NAME"]
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL")

_client = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)


def upload_base64_photo(base64_data: str, content_type: str = "image/jpeg") -> str:
    if "," in base64_data and base64_data.strip().startswith("data:"):
        base64_data = base64_data.split(",", 1)[1]

    photo_bytes = base64.b64decode(base64_data)
    ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
    key = f"photos/{uuid.uuid4()}.{ext}"

    _client.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=photo_bytes,
        ContentType=content_type,
    )

    if R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL}/{key}"
    return f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{R2_BUCKET_NAME}/{key}"
