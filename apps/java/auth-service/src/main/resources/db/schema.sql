-- auth_db schema

CREATE TABLE IF NOT EXISTS t_auth_user (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_user_username ON t_auth_user(username);
CREATE INDEX IF NOT EXISTS idx_auth_user_email ON t_auth_user(email);
CREATE INDEX IF NOT EXISTS idx_auth_user_status ON t_auth_user(status);
