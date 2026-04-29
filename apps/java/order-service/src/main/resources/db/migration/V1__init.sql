-- Flyway migration: V1__init.sql
-- Service: order-service
-- Auto-converted from db/schema.sql
--
-- order_db schema

CREATE TABLE IF NOT EXISTS t_order (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(18,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'CREATED',
    pay_status VARCHAR(20) DEFAULT 'UNPAID',
    logistics_status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_order_no ON t_order(order_no);
CREATE INDEX IF NOT EXISTS idx_order_user_id ON t_order(user_id);
CREATE INDEX IF NOT EXISTS idx_order_status ON t_order(status);

CREATE TABLE IF NOT EXISTS t_order_item (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200),
    sku_id BIGINT,
    quantity INT NOT NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    total_price DECIMAL(18,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_item_order_id ON t_order_item(order_id);

-- 创作者商品表
CREATE TABLE IF NOT EXISTS t_creator_product (
    id BIGSERIAL PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    tech_stack_tags VARCHAR(500),
    credits_price INT NOT NULL,
    fiat_price DECIMAL(18,2),
    preview_images TEXT,
    demo_url VARCHAR(500),
    source_project_id BIGINT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sales_count INT DEFAULT 0,
    total_revenue DECIMAL(18,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_creator_product_creator_id ON t_creator_product(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_product_status ON t_creator_product(status);
CREATE INDEX IF NOT EXISTS idx_creator_product_type ON t_creator_product(type);

-- 创作者收益表
CREATE TABLE IF NOT EXISTS t_creator_earning (
    id BIGSERIAL PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200),
    buyer_id BIGINT NOT NULL,
    credits_amount INT,
    fiat_amount DECIMAL(18,2),
    platform_fee DECIMAL(18,2) DEFAULT 0.00,
    net_earning DECIMAL(18,2) DEFAULT 0.00,
    settled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted INT DEFAULT 0,
    version BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_creator_earning_creator_id ON t_creator_earning(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_product_id ON t_creator_earning(product_id);
CREATE INDEX IF NOT EXISTS idx_creator_earning_created_at ON t_creator_earning(created_at);
