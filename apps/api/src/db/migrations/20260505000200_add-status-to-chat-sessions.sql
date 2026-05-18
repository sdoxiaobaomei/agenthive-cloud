-- Migration: add status column to chat_sessions
-- Created: 2026-05-05
-- Description: chat-controller/service.ts and db/index.ts both reference
--   chat_sessions.status for list/filter/archive operations, but the init
--   migration never created this column.

-- ${node-pg-migrate}-up

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'archived', 'deleted'));

-- Backfill existing rows
UPDATE chat_sessions SET status = 'active' WHERE status IS NULL;

-- ${node-pg-migrate}-down

ALTER TABLE chat_sessions DROP COLUMN IF EXISTS status;
