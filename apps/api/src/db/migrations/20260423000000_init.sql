-- Migration: init
-- Created: 2026-04-23
-- Author: backend-team
-- Ticket: TICKET-001
-- Description: 初始化所有核心表结构

-- up migration

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 用户�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================================
-- 项目�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    type VARCHAR(50),
    tech_stack JSONB DEFAULT '[]',
    git_url VARCHAR(500),
    git_branch VARCHAR(100) DEFAULT 'main',
    workspace_path VARCHAR(500),
    last_accessed_at TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================================================
-- 项目成员�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

-- ============================================================================
-- Agent �?
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'paused', 'error', 'offline')),
    description TEXT,
    config JSONB DEFAULT '{}',
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_project_id ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- ============================================================================
-- Agent 成员表（协作�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_members_agent_id ON agent_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_members_user_id ON agent_members(user_id);

-- ============================================================================
-- Task �?
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'task' CHECK (type IN ('task', 'bug', 'feature', 'review')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    assigned_to UUID REFERENCES agents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    input JSONB,
    output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================================
-- Chat 会话�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id);

-- ============================================================================
-- Chat 消息�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'agent')),
    content TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================================
-- Agent 任务�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_session_id ON agent_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);

-- ============================================================================
-- Agent 日志�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    message TEXT,
    level VARCHAR(20) DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at);

-- ============================================================================
-- 代码文件�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS code_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    path VARCHAR(1000) NOT NULL,
    name VARCHAR(255),
    content TEXT,
    language VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_code_files_project_id ON code_files(project_id);

-- ============================================================================
-- 项目部署�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version VARCHAR(100),
    environment VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    deployed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deployed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_deployments_project_id ON project_deployments(project_id);

-- ============================================================================
-- 审计日志�?
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id UUID
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);

-- ============================================================================
-- 权限函数
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_operate_agent(p_user_id UUID, p_agent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM agents a
        LEFT JOIN agent_members am ON a.id = am.agent_id
        WHERE a.id = p_agent_id
        AND (a.owner_id = p_user_id OR (am.user_id = p_user_id AND am.role IN ('owner', 'admin')))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_can_operate_task(p_user_id UUID, p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = p_task_id
        AND (t.user_id = p_user_id OR t.project_id IN (
            SELECT project_id FROM project_members WHERE user_id = p_user_id
        ))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_project_member(p_user_id UUID, p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 更新时间触发�?
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['users', 'projects', 'agents', 'tasks', 'chat_sessions', 'agent_tasks', 'agent_members'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- down migration

-- 完整回滚（按依赖逆序�?
DROP TRIGGER IF EXISTS update_agent_members_updated_at ON agent_members;
DROP TRIGGER IF EXISTS update_agent_tasks_updated_at ON agent_tasks;
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS user_is_project_member(UUID, UUID);
DROP FUNCTION IF EXISTS user_can_operate_task(UUID, UUID);
DROP FUNCTION IF EXISTS user_can_operate_agent(UUID, UUID);
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS project_deployments CASCADE;
DROP TABLE IF EXISTS code_files CASCADE;
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS agent_tasks CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agent_members CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
