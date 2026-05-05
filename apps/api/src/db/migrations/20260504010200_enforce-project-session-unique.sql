-- Migration: enforce 1 project 1 session constraint
-- Created: 2026-05-04
-- Description: chat_sessions 添加 workspace_id、session_type、current_version_id，并强制 project 唯一
-- Dependency: Requires 20260504010100_add-workspaces.sql (workspaces table must exist first)

-- up migration

-- Step 1: 添加 workspace_id
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace_id ON chat_sessions(workspace_id);

-- Step 2: 添加 session_type
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'default'
    CHECK (session_type IN ('default', 'review', 'debug', 'template'));

-- Step 3: 添加 current_version_id（用于版本切换）
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS current_version_id UUID;

-- Step 4: 添加 UNIQUE 约束——只�?project_id IS NOT NULL 的行才需要唯一
DROP INDEX IF EXISTS idx_chat_sessions_project_id_unique;
CREATE UNIQUE INDEX idx_chat_sessions_project_id_unique
    ON chat_sessions(project_id)
    WHERE project_id IS NOT NULL;

-- down migration
DROP INDEX IF EXISTS idx_chat_sessions_project_id_unique;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS current_version_id;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS session_type;
DROP INDEX IF EXISTS idx_chat_sessions_workspace_id;
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS workspace_id;
