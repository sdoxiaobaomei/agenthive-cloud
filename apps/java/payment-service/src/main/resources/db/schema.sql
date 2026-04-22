-- payment_db schema

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
