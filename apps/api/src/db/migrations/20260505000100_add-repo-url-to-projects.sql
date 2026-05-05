-- Migration: add repo_url to projects
-- Created: 2026-05-05
-- Description: Code expects repo_url column (project/service.ts, db/index.ts) but init.sql only created git_url

-- up migration

ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_url VARCHAR(500);

-- down migration

ALTER TABLE projects DROP COLUMN IF EXISTS repo_url;
