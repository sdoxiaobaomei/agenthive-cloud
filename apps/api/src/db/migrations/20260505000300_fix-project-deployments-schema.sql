-- Migration: fix project_deployments schema mismatch
-- Created: 2026-05-05
-- Description: hosting-service.ts references access_url, config_json, updated_at
--   and uses ON CONFLICT (project_id), but init migration never created these.

-- up migration

-- Add missing columns
ALTER TABLE project_deployments ADD COLUMN IF NOT EXISTS access_url VARCHAR(500);
ALTER TABLE project_deployments ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}';
ALTER TABLE project_deployments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint required by ON CONFLICT (project_id)
ALTER TABLE project_deployments ADD CONSTRAINT IF NOT EXISTS uq_project_deployments_project_id UNIQUE (project_id);

-- down migration

ALTER TABLE project_deployments DROP CONSTRAINT IF EXISTS uq_project_deployments_project_id;
ALTER TABLE project_deployments DROP COLUMN IF EXISTS updated_at;
ALTER TABLE project_deployments DROP COLUMN IF EXISTS config_json;
ALTER TABLE project_deployments DROP COLUMN IF EXISTS access_url;
