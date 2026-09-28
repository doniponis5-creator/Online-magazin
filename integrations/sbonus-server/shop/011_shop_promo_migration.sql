-- ============================================================================
-- Интернет-магазин Smart Centr: рассылки «Скидка» и «Новинка» из 1С.
-- Только новые таблицы; существующие не затрагиваются. Повторный запуск
-- ничего не меняет (IF NOT EXISTS).
--
-- shop_promo_consent — согласие покупателя на такие уведомления, отдельно от
-- напоминаний о корзине: NULL — ещё не спрашивали, FALSE — отказался,
-- TRUE — согласился. Без TRUE не пишем (правило Apple 4.5.4).
--
-- shop_promo_sends — журнал рассылок для «Панели сайта» в 1С. send_day —
-- день по Бишкеку: уникальный индекс не даст отправить вторую рассылку в тот
-- же день, даже если в 1С нажали «Отправить» дважды подряд. Рассылка, которая
-- не дошла ни до кого (status = 'failed'), день не занимает — можно повторить.
-- Время — UTC без зоны, как created_at у заказов.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_promo_consent (
    phone       VARCHAR(20)  PRIMARY KEY,                     -- покупатель, как в shop_orders.customer_phone
    consent     BOOLEAN,                                      -- NULL / FALSE / TRUE
    updated_at  TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS shop_promo_sends (
    id          SERIAL       PRIMARY KEY,
    created_at  TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'), -- когда нажали «Отправить»
    send_day    DATE         NOT NULL,                        -- день по Бишкеку
    kind        VARCHAR(10)  NOT NULL,                        -- sale / new / custom
    code        VARCHAR(64),                                  -- код товара 1С; NULL — без товара
    title       VARCHAR(80)  NOT NULL,
    body        VARCHAR(250) NOT NULL,
    url         VARCHAR(200) NOT NULL,                        -- что откроет нажатие
    recipients  INTEGER      NOT NULL DEFAULT 0,              -- скольким покупателям слали
    delivered   INTEGER      NOT NULL DEFAULT 0,              -- до скольких дошло
    status      VARCHAR(12)  NOT NULL DEFAULT 'sending'       -- sending / done / failed
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_promo_sends_one_a_day
    ON shop_promo_sends (send_day)
    WHERE status <> 'failed';
