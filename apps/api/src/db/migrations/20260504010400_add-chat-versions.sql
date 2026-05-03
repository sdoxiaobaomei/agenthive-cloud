-- Migration: add chat_versions table for session versioning
-- Created: 2026-05-04
-- Description: 新增 chat_versions 表，支持 Session 版本管理

-- ${node-pg-migrate}-up

-- ============================================================================
-- Chat Versions 表（Session 版本管理）
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    base_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_chat_versions_session_id ON chat_versions(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_versions_active_per_session
    ON chat_versions(session_id)
    WHERE is_active = TRUE;

-- 触发器
DROP TRIGGER IF EXISTS update_chat_versions_updated_at ON chat_versions;
CREATE TRIGGER update_chat_versions_updated_at
    BEFORE UPDATE ON chat_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ${node-pg-migrate}-down
DROP TRIGGER IF EXISTS update_chat_versions_updated_at ON chat_versions;
DROP INDEX IF EXISTS idx_chat_versions_active_per_session;
DROP INDEX IF EXISTS idx_chat_versions_session_id;
DROP TABLE IF EXISTS chat_versions CASCADE;
