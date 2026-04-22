-- Business services initialization
-- Creates databases and schemas for payment, order, cart, logistics

CREATE DATABASE payment_db;
CREATE DATABASE order_db;
CREATE DATABASE cart_db;
CREATE DATABASE logistics_db;

\c payment_db;

CREATE TABLE IF NOT EXISTS t_payment (
    id BIGSERIAL PRIMARY KEY,
    payment_no VARCHAR(32) UNIQUE NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    user_id BIGINT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    third_party_no VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE (payment_no, third_party_no)
);
CREATE INDEX IF NOT EXISTS idx_payment_order_no ON t_payment(order_no);
CREATE INDEX IF NOT EXISTS idx_payment_user_id ON t_payment(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON t_payment(status);

CREATE TABLE IF NOT EXISTS t_user_wallet (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    balance DECIMAL(18,2) DEFAULT 0.00,
    frozen_balance DECIMAL(18,2) DEFAULT 0.00,
    version BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wallet_user_id ON t_user_wallet(user_id);

CREATE TABLE IF NOT EXISTS t_refund (
    id BIGSERIAL PRIMARY KEY,
    refund_no VARCHAR(32) UNIQUE NOT NULL,
    payment_no VARCHAR(32) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refund_payment_no ON t_refund(payment_no);

\c order_db;

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

\c cart_db;

CREATE TABLE IF NOT EXISTS t_cart_item (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    sku_id BIGINT,
    quantity INT NOT NULL DEFAULT 1,
    selected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id, sku_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_item_user_id ON t_cart_item(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_product_id ON t_cart_item(product_id);

\c logistics_db;

CREATE TABLE IF NOT EXISTS t_logistics (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL,
    tracking_no VARCHAR(64) UNIQUE,
    carrier VARCHAR(32),
    status VARCHAR(20) DEFAULT 'PENDING',
    sender_info JSONB,
    receiver_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logistics_order_no ON t_logistics(order_no);
CREATE INDEX IF NOT EXISTS idx_logistics_tracking_no ON t_logistics(tracking_no);

CREATE TABLE IF NOT EXISTS t_logistics_track (
    id BIGSERIAL PRIMARY KEY,
    tracking_no VARCHAR(64) NOT NULL,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_desc VARCHAR(500),
    location VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS idx_track_tracking_no ON t_logistics_track(tracking_no);
