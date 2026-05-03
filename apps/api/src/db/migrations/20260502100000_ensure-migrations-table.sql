-- Migration: ensure-migrations-table
-- Created: 2026-05-02
-- Description: 确保迁移追踪表存在
-- Deprecates: 手动管理 _migrations 表

-- ${node-pg-migrate}-up

-- node-pg-migrate 会自动创建迁移表，这里只是确保兼容性
-- 如果存在旧的 _migrations 表，保留数据
DO $$
BEGIN
    -- 检查 pgmigrations 表是否存在（node-pg-migrate 默认表名）
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pgmigrations') THEN
        CREATE TABLE pgmigrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    END IF;
END $$;

-- ${node-pg-migrate}-down

-- 回滚：删除迁移表（危险操作，仅用于完全重置）
-- DROP TABLE IF EXISTS pgmigrations;
