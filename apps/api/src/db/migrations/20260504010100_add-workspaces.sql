-- Migration: add workspaces table and link to projects
-- Created: 2026-05-04
-- Description: 新增 workspaces 表，projects 添加 workspace_id 关联

-- ${node-pg-migrate}-up

-- ============================================================================
-- Workspaces 表（用户级工作区）
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Workspace',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

-- ============================================================================
-- Projects 表添加 workspace_id
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);

-- ============================================================================
-- 更新时间触发器
-- ============================================================================
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ${node-pg-migrate}-down
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
DROP INDEX IF EXISTS idx_projects_workspace_id;
ALTER TABLE projects DROP COLUMN IF EXISTS workspace_id;
DROP INDEX IF EXISTS idx_workspaces_user_id;
DROP TABLE IF EXISTS workspaces CASCADE;
