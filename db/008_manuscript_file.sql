-- =============================================================================
-- Migration 008 — manuscript file storage
-- =============================================================================

-- Store the S3/MinIO key for the primary manuscript file.
-- Null until the file is uploaded (submission may be created before upload completes).
ALTER TABLE manuscript.manuscripts
  ADD COLUMN IF NOT EXISTS file_key TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;
