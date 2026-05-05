-- Migration: align chat_messages schema with actual usage
-- Created: 2026-05-04
-- Description: 移除废弃�?agent_id，添�?metadata JSONB，与代码层对�?
-- CHANGELOG: This migration is irreversible. agent_id data is lost once dropped.
--            If rollback is needed, restore from backup before running down.

-- up migration

-- Step 1: 删除 agent_id 列（如果存在�?
ALTER TABLE chat_messages DROP COLUMN IF EXISTS agent_id;

-- Step 2: 确保 metadata JSONB 存在
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Step 3: content 允许 NULL（think 类型可能�?content�?
ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;

-- down migration
-- 不可回滚 agent_id，因为数据已迁移�?metadata
