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

-- Credits Account Schema

CREATE TABLE IF NOT EXISTS t_credits_account (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    balance DECIMAL(18,4) DEFAULT 0.0000,
    frozen_balance DECIMAL(18,4) DEFAULT 0.0000,
    total_earned DECIMAL(18,4) DEFAULT 0.0000,
    total_spent DECIMAL(18,4) DEFAULT 0.0000,
    total_withdrawn DECIMAL(18,4) DEFAULT 0.0000,
    version BIGINT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credits_account_user_id ON t_credits_account(user_id);

CREATE TABLE IF NOT EXISTS t_credits_transaction (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    balance_after DECIMAL(18,4) NOT NULL,
    source_type VARCHAR(32),
    source_id VARCHAR(64),
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credits_transaction_user_id ON t_credits_transaction(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_transaction_source ON t_credits_transaction(user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_credits_transaction_created_at ON t_credits_transaction(created_at);

-- Agent Quota Config Schema

CREATE TABLE IF NOT EXISTS t_agent_quota_config (
    id BIGSERIAL PRIMARY KEY,
    worker_role VARCHAR(64) UNIQUE NOT NULL,
    pricing_type VARCHAR(32) NOT NULL,
    unit_price DECIMAL(18,4) NOT NULL,
    token_price DECIMAL(18,4),
    currency VARCHAR(16) DEFAULT 'CREDITS',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_quota_role ON t_agent_quota_config(worker_role);

-- Marketplace Schema

CREATE TABLE IF NOT EXISTS t_marketplace_product (
    id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(18,2),
    credits_price DECIMAL(18,4),
    category VARCHAR(64),
    tags VARCHAR(255),
    preview_images TEXT,
    demo_url VARCHAR(512),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sales_count INT DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 5.0,
    review_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mp_product_seller ON t_marketplace_product(seller_id);
CREATE INDEX IF NOT EXISTS idx_mp_product_status ON t_marketplace_product(status);
CREATE INDEX IF NOT EXISTS idx_mp_product_category ON t_marketplace_product(category);

CREATE TABLE IF NOT EXISTS t_marketplace_order (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_type VARCHAR(32),
    product_name VARCHAR(255),
    price DECIMAL(18,4) NOT NULL,
    platform_fee DECIMAL(18,4) NOT NULL,
    seller_earn DECIMAL(18,4) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    pay_channel VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mp_order_buyer ON t_marketplace_order(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_seller ON t_marketplace_order(seller_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_status ON t_marketplace_order(status);

CREATE TABLE IF NOT EXISTS t_marketplace_purchase (
    id BIGSERIAL PRIMARY KEY,
    buyer_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (buyer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_purchase_buyer ON t_marketplace_purchase(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mp_purchase_product ON t_marketplace_purchase(product_id);

-- Hosted Website Schema

CREATE TABLE IF NOT EXISTS t_hosted_website (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    subdomain VARCHAR(255) UNIQUE NOT NULL,
    custom_domain VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    traffic_count BIGINT DEFAULT 0,
    traffic_credits_earned DECIMAL(18,4) DEFAULT 0.0000,
    last_payout_at TIMESTAMP,
    deploy_config TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hw_owner ON t_hosted_website(owner_id);
CREATE INDEX IF NOT EXISTS idx_hw_project ON t_hosted_website(project_id);
CREATE INDEX IF NOT EXISTS idx_hw_subdomain ON t_hosted_website(subdomain);

CREATE TABLE IF NOT EXISTS t_traffic_record (
    id BIGSERIAL PRIMARY KEY,
    hosted_website_id BIGINT NOT NULL,
    date DATE NOT NULL,
    pv_count BIGINT DEFAULT 0,
    uv_count BIGINT DEFAULT 0,
    credits_earned DECIMAL(18,4) DEFAULT 0.0000,
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (hosted_website_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tr_website_date ON t_traffic_record(hosted_website_id, date);

-- Traffic Conversion Config Schema

CREATE TABLE IF NOT EXISTS t_traffic_conversion_config (
    id BIGSERIAL PRIMARY KEY,
    metric_type VARCHAR(16) NOT NULL,
    threshold BIGINT NOT NULL,
    credits_reward DECIMAL(18,4) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (metric_type)
);

CREATE INDEX IF NOT EXISTS idx_tcc_active ON t_traffic_conversion_config(is_active);

-- Withdrawal Record Schema

CREATE TABLE IF NOT EXISTS t_withdrawal_record (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount DECIMAL(18,4) NOT NULL,
    fee_rate DECIMAL(5,4) NOT NULL,
    fee_amount DECIMAL(18,4) NOT NULL,
    net_amount DECIMAL(18,4) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    account_info_encrypted TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'PENDING',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    reject_reason VARCHAR(255),
    admin_id BIGINT,
    version BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON t_withdrawal_record(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON t_withdrawal_record(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_applied_at ON t_withdrawal_record(applied_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_applied ON t_withdrawal_record(user_id, applied_at);
