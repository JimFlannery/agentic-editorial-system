/**
 * lib/storage.ts
 *
 * S3-compatible object storage client.
 * Defaults to MinIO in development; swap for S3/R2/B2 via env vars.
 *
 * Env vars required:
 *   S3_ENDPOINT        e.g. http://localhost:9000 (omit for AWS S3)
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_BUCKET          e.g. ems-manuscripts
 *   S3_REGION          e.g. us-east-1
 *
 * Key layout:
 *   manuscripts/{journalId}/{manuscriptId}/manuscript.{ext}
 *   manuscripts/{journalId}/{manuscriptId}/figures/{filename}
 *   manuscripts/{journalId}/{manuscriptId}/supplementary/{filename}
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var _s3Client: S3Client | undefined
}

function getClient(): S3Client {
  if (!global._s3Client) {
    global._s3Client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      ...(process.env.S3_ENDPOINT
        ? {
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true, // required for MinIO
          }
        : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    })
  }
  return global._s3Client
}

const BUCKET = process.env.S3_BUCKET ?? "ems-manuscripts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ext(filename: string): string {
  const parts = filename.split(".")
  return parts.length > 1 ? parts.at(-1)!.toLowerCase() : "bin"
}

export function manuscriptKey(
  journalId: string,
  manuscriptId: string,
  filename: string
): string {
  return `manuscripts/${journalId}/${manuscriptId}/manuscript.${ext(filename)}`
}

// ---------------------------------------------------------------------------
// uploadFile — store a file, return the S3 key
// ---------------------------------------------------------------------------

export async function uploadFile(
  key: string,
  file: File
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
      ContentLength: buffer.byteLength,
    })
  )

  return key
}

// ---------------------------------------------------------------------------
// getDownloadUrl — presigned URL valid for 1 hour
// ---------------------------------------------------------------------------

export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

// ---------------------------------------------------------------------------
// deleteFile
// ---------------------------------------------------------------------------

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
  )
}

// ---------------------------------------------------------------------------
// ensureBucket — call once during startup / migration to create bucket if missing
// ---------------------------------------------------------------------------

export async function ensureBucket(): Promise<void> {
  const { CreateBucketCommand, HeadBucketCommand } = await import("@aws-sdk/client-s3")
  try {
    await getClient().send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await getClient().send(new CreateBucketCommand({ Bucket: BUCKET }))
  }
}
