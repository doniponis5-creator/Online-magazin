-- ============================================================================
-- Интернет-магазин Smart Centr: заказы с сайта (оплата O!Деньги → 1С)
-- Новые таблицы, существующие (installment_payments и др.) не затрагиваются.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         VARCHAR(24) UNIQUE NOT NULL,     -- SC-260917-7K3QF, он же order_id в O!Деньги
    token            VARCHAR(64) NOT NULL,            -- доступ к странице заказа на сайте

    customer_name    VARCHAR(160) NOT NULL,
    customer_phone   VARCHAR(20) NOT NULL,            -- +996XXXXXXXXX
    delivery         JSONB NOT NULL,                  -- {method, city, address, price}
    comment          TEXT,
    lines            JSONB NOT NULL,                  -- [{productId, oneCId, code, name, price, qty, sum}]
    goods_total      NUMERIC(14,2) NOT NULL,
    total            NUMERIC(14,2) NOT NULL,
    lang             VARCHAR(4) DEFAULT 'ru',

    status           VARCHAR(20) DEFAULT 'awaiting_payment',
    paid             BOOLEAN DEFAULT FALSE,
    paid_at          TIMESTAMP,

    obank_invoice_id VARCHAR(64),
    obank_trans_id   VARCHAR(64),
    obank_status     VARCHAR(32),
    obank_raw        JSONB,
    pay_url          TEXT,

    order_number_1c  VARCHAR(32),
    pko_number_1c    VARCHAR(32),
    rtu_number_1c    VARCHAR(32),
    realized         BOOLEAN DEFAULT FALSE,
    synced_at        TIMESTAMP,
    sync_attempts    INTEGER DEFAULT 0,
    note             TEXT,

    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_shop_orders_status ON shop_orders (status);
CREATE INDEX IF NOT EXISTS ix_shop_orders_paid ON shop_orders (paid);
CREATE INDEX IF NOT EXISTS ix_shop_orders_phone ON shop_orders (customer_phone);
CREATE INDEX IF NOT EXISTS ix_shop_orders_created ON shop_orders (created_at);

CREATE TABLE IF NOT EXISTS shop_order_events (
    id          SERIAL PRIMARY KEY,
    order_uuid  UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
    event_type  VARCHAR(32) NOT NULL,
    event_data  JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_shop_order_events_order ON shop_order_events (order_uuid);
