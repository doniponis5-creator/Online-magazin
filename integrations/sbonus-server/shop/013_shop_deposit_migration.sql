-- ============================================================================
-- Интернет-магазин Smart Centr: заклад — оплата заказа частями (08.10).
-- Только новые колонки shop_orders; повторный запуск ничего не меняет (IF NOT EXISTS).
--
-- deposit        — сколько покупатель платит сразу (первая ссылка O!Деньги); NULL — платит всё сразу, как раньше.
-- taxi           — {car, driver_phone}: сотрудник погрузил товар в такси (кнопка в 1С), shipped_at — когда.
-- rest_*         — вторая ссылка O!Деньги на остаток (order_id + «-R»), её оплата и ПКО остатка в 1С.
-- ============================================================================
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS deposit NUMERIC(14, 2);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS taxi JSONB;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_invoice_id VARCHAR(64);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_pay_url TEXT;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_paid_at TIMESTAMP;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_trans_id VARCHAR(64);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_pko_1c VARCHAR(32);
-- номер текущей ссылки на остаток (<номер>-R, -R2, …) и когда она выпущена: истекла — выпускаем новую
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_ref VARCHAR(32);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS rest_link_at TIMESTAMP;
