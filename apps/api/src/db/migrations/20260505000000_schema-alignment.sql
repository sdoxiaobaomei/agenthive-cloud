-- Migration: schema alignment â€?fix drift between migration history and code expectations
-- Created: 2026-05-05
-- Author: backend-team
-- Ticket: SCHEMA-ALIGN-001
-- Description:
--   1. Align agent_tasks with project/service.ts (project_id, ticket_id, worker_role, ...)
--   2. Add users.avatar required by project dashboard / findMembers
--   3. Remove stale agent_tasks columns (agent_id, task_id) no longer referenced by code

-- up migration

-- ============================================================================
-- 1. agent_tasks â€?align with code layer (project/service.ts)
-- ============================================================================

-- Remove stale columns (no longer referenced by any code path)
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS agent_id;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS task_id;

-- Add columns expected by project/service.ts
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS worker_role VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS workspace_path VARCHAR(500);
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add index for project-scoped queries (project dashboard / agent-tasks endpoints)
CREATE INDEX IF NOT EXISTS idx_agent_tasks_project_id ON agent_tasks(project_id);

-- ============================================================================
-- 2. users â€?add avatar required by JOIN queries in project dashboard
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- ============================================================================
-- 3. Drop legacy indexes that may reference removed columns
-- ============================================================================
DROP INDEX IF EXISTS idx_agent_tasks_agent_id;

-- down migration

-- ============================================================================
-- Revert agent_tasks to migration-init shape (agent_id, task_id)
-- ============================================================================
DROP INDEX IF EXISTS idx_agent_tasks_project_id;

ALTER TABLE agent_tasks DROP COLUMN IF EXISTS completed_at;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS started_at;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS result;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS workspace_path;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS worker_role;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS ticket_id;
ALTER TABLE agent_tasks DROP COLUMN IF EXISTS project_id;

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);

-- ============================================================================
-- Revert users
-- ============================================================================
ALTER TABLE users DROP COLUMN IF EXISTS avatar;
