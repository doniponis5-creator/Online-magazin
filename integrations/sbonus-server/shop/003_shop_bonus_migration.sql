-- ============================================================================
-- Интернет-магазин Smart Centr: бонусы SBonus в заказах сайта.
-- Только новые колонки в shop_orders; таблицы SBonus не меняются.
-- ============================================================================
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bonus_spend  NUMERIC(14,2) DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bonus_spent  NUMERIC(14,2) DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS pay_amount   NUMERIC(14,2);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS bonus_earned NUMERIC(14,2) DEFAULT 0;

-- Настройки сайта (не перезаписывают, если владелец уже поменял)
INSERT INTO settings (key, value) VALUES ('SITE_WELCOME_BONUS_AMOUNT', '1000') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('SITE_BONUS_MAX_PCT', '10') ON CONFLICT (key) DO NOTHING;
