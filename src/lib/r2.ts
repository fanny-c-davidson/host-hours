import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Cloudflare R2 (S3-compatible) object storage for receipt photos. R2 charges
// $0 egress, so re-serving images (thumbnails, tax-PDF embeds) stays free.
// Credentials are SERVER ONLY — the browser never touches R2; uploads/reads go
// through the /api/receipt routes. Configure R2_* in the environment.

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!, // https://<account>.r2.cloudflarestorage.com
    // Path-style is required for R2: virtual-hosted style would address
    // <bucket>.<account>.r2.cloudflarestorage.com, which R2's single-level
    // wildcard cert doesn't cover → TLS handshake failure.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET!;
}

export async function r2Put(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Fetch an object's bytes. Returns null if it doesn't exist (e.g. a missing
// thumbnail variant), so callers can fall back to the full image.
export async function r2GetBytes(
  key: string,
): Promise<{ bytes: Uint8Array; contentType?: string } | null> {
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return { bytes, contentType: res.ContentType };
  } catch {
    return null;
  }
}

export async function r2Delete(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((Key) =>
      s3()
        .send(new DeleteObjectCommand({ Bucket: bucket(), Key }))
        .catch(() => {}),
    ),
  );
}
