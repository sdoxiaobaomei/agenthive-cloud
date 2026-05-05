-- Migration: add message types and version support to chat_messages
-- Created: 2026-05-04
-- Description: 新增 message_type、is_visible_in_history、version_id、parent_message_id

-- up migration

-- ============================================================================
-- Chat Messages 核心改�?
-- ============================================================================

-- Step 1: 添加 message_type
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'message'
    CHECK (message_type IN ('message', 'think', 'task', 'recommend', 'system_event'));

-- Step 2: 添加 is_visible_in_history
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_visible_in_history BOOLEAN DEFAULT TRUE;

-- Step 3: 添加 version_id
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS version_id UUID;

-- Step 4: 添加 parent_message_id
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Step 5: 创建索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_version_id ON chat_messages(version_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_visible ON chat_messages(session_id, is_visible_in_history, created_at);

-- Step 6: 为已有数据设置默认值（role=system 的设�?system_event�?
UPDATE chat_messages SET message_type = 'system_event' WHERE role = 'system' AND message_type = 'message';

-- down migration
DROP INDEX IF EXISTS idx_chat_messages_visible;
DROP INDEX IF EXISTS idx_chat_messages_version_id;
DROP INDEX IF EXISTS idx_chat_messages_message_type;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS parent_message_id;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS version_id;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS is_visible_in_history;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS message_type;
