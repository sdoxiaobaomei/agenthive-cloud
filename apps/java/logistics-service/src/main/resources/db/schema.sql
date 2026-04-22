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
