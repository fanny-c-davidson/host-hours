// R2 connectivity + credentials smoke test.
// Run from the app folder on Node 20:
//   node --env-file=.env.local scripts/r2-smoke.mjs
// Verifies the app's exact path (Node/OpenSSL + AWS SDK) can put/get/delete in
// your bucket. A success here means in-app photo upload will work.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const need = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Missing env vars:", missing.join(", "));
  console.error("   Run with: node --env-file=.env.local scripts/r2-smoke.mjs");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const Bucket = process.env.R2_BUCKET;
const Key = `_smoketest/hello-${Date.now()}.txt`;
const body = "host hours r2 smoke test";

console.log("endpoint:", process.env.R2_ENDPOINT);
console.log("bucket:  ", Bucket, "\n");

try {
  await client.send(
    new PutObjectCommand({ Bucket, Key, Body: body, ContentType: "text/plain" }),
  );
  console.log("PUT    ok ->", Key);

  const res = await client.send(new GetObjectCommand({ Bucket, Key }));
  const got = await res.Body.transformToString();
  console.log("GET    ok ->", got === body ? "content matches" : `MISMATCH (${got})`);

  await client.send(new DeleteObjectCommand({ Bucket, Key }));
  console.log("DELETE ok");

  console.log("\n✅ R2 verified — Node/OpenSSL can reach R2 and the creds work. In-app upload will work.");
} catch (e) {
  console.error("\n❌ R2 test FAILED:", e?.name, "-", e?.message);
  console.error("   If this is a TLS handshake failure, a VPN / Cloudflare WARP / security tool");
  console.error("   on this machine or network is blocking r2.cloudflarestorage.com.");
  process.exitCode = 1;
}
