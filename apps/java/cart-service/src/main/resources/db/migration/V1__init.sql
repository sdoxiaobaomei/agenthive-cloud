-- Flyway migration: V1__init.sql
-- Service: cart-service
-- Auto-converted from db/schema.sql
--
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
