-- ============================================================================
-- Интернет-магазин Smart Centr: push-уведомления в приложении для iPhone.
-- Только новая таблица; существующие не затрагиваются.
--
-- Здесь хранится «адрес» телефона, который выдаёт Apple. По нему нельзя
-- узнать человека: это просто ящик, куда мы кладём сообщение. Телефон
-- покупателя пишем, чтобы знать, кому про какой заказ отправлять.
--
-- Ключ Apple здесь НЕ хранится: он секретный и живёт в /opt/sbonus/.env.production
-- (APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID), как токен Telegram.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_push_devices (
    id          BIGSERIAL PRIMARY KEY,
    token       VARCHAR(200) NOT NULL UNIQUE,     -- адрес телефона от Apple
    platform    VARCHAR(16)  NOT NULL DEFAULT 'ios',
    phone       VARCHAR(20),                      -- покупатель, если он вошёл
    failed      INTEGER      NOT NULL DEFAULT 0,  -- сколько раз Apple отказала
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_push_phone ON shop_push_devices (phone);
