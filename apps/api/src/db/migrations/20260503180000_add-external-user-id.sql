-- Migration: 20260503180000_add-external-user-id.sql
-- Description: 为 users 表添加 external_user_id 列，支持 Gateway 透传认证映射
-- Author: 后端
-- Date: 2026-05-03

-- 添加 external_user_id 字段（允许唯一，用于第三方账号映射）
ALTER TABLE users ADD COLUMN IF NOT EXISTS external_user_id VARCHAR(255) UNIQUE;

-- 为 agents 表补充缺失字段（代码层已有但 schema 未同步）
-- 注意：pod_ip 和 current_task_id 已在代码中移除，仅保留 owner_id 和 project_id（已存在）

-- 添加索引加速 external_user_id 查询
CREATE INDEX IF NOT EXISTS idx_users_external_user_id ON users(external_user_id);
