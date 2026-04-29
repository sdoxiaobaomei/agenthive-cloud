-- auth_db schema

CREATE TABLE IF NOT EXISTS sys_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,
  email VARCHAR(128),
  phone VARCHAR(20),
  avatar VARCHAR(500),
  status INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted INT DEFAULT 0,
  version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sys_user_username ON sys_user(username);
CREATE INDEX IF NOT EXISTS idx_sys_user_email ON sys_user(email);
CREATE INDEX IF NOT EXISTS idx_sys_user_status ON sys_user(status);

CREATE TABLE IF NOT EXISTS sys_role (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(64) UNIQUE NOT NULL,
  role_name VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS sys_user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO sys_role (id, role_code, role_name) VALUES (1, 'ADMIN', 'Administrator') ON CONFLICT DO NOTHING;
INSERT INTO sys_role (id, role_code, role_name) VALUES (2, 'USER', 'Regular User') ON CONFLICT DO NOTHING;
