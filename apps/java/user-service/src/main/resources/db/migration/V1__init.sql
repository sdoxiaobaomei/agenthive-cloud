-- Flyway migration: V1__init.sql
-- Service: user-service
-- Auto-converted from db/schema.sql
--
-- user_db schema

CREATE TABLE IF NOT EXISTS t_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    nickname VARCHAR(100),
    avatar VARCHAR(500),
    email VARCHAR(100),
    phone VARCHAR(20),
    bio TEXT,
    status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_username ON t_user(username);
CREATE INDEX IF NOT EXISTS idx_user_email ON t_user(email);
CREATE INDEX IF NOT EXISTS idx_user_status ON t_user(status);
