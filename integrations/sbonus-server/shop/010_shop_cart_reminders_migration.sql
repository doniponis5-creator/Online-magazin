-- ============================================================================
-- Интернет-магазин Smart Centr: напоминание о товарах в корзине.
-- Только новая таблица; существующие не затрагиваются. Повторный запуск
-- ничего не меняет (IF NOT EXISTS).
--
-- Корзина живёт в телефоне, сервер о ней не знал. Приложение присылает сюда
-- снимок корзины вошедшего покупателя: первые три названия, число позиций и
-- сумму. По нему задача раз в 30 минут решает, пора ли напомнить.
--
-- consent — согласие покупателя на такие напоминания: NULL — ещё не
-- спрашивали, FALSE — отказался, TRUE — согласился. Без TRUE не пишем.
-- Время — UTC без зоны, как created_at у заказов: так их можно сравнивать.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_cart_reminders (
    phone         VARCHAR(20)   PRIMARY KEY,                -- покупатель, как в shop_orders.customer_phone
    consent       BOOLEAN,                                  -- NULL / FALSE / TRUE
    items         JSONB         NOT NULL DEFAULT '[]'::jsonb, -- до трёх названий
    count         INTEGER       NOT NULL DEFAULT 0,         -- позиций в корзине
    total         NUMERIC(14,2) NOT NULL DEFAULT 0,         -- сумма корзины, сом
    changed_at    TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'), -- когда корзина менялась
    sent          INTEGER       NOT NULL DEFAULT 0,         -- напоминаний с последнего изменения
    last_sent_at  TIMESTAMP                                 -- когда ушло последнее
);

-- Задача смотрит только тех, кто согласился и у кого корзина не пуста.
CREATE INDEX IF NOT EXISTS shop_cart_reminders_waiting
    ON shop_cart_reminders (changed_at)
    WHERE consent IS TRUE AND count > 0;
