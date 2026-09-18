-- ============================================================================
-- Интернет-магазин Smart Centr: счётчики для «Панели сайта» в 1С.
-- Только новые таблицы; существующие не затрагиваются.
--
-- Личные данные тут не хранятся: от телефона остаются четыре последние цифры
-- (чтобы владелец мог опознать свой тестовый вход), а посетитель записывается
-- необратимым отпечатком, по которому нельзя вернуться к человеку.
-- ============================================================================

-- Входы и отправленные коды: видно, сколько людей заходит и во сколько
-- обходятся коды — Telegram платный, и счёт лучше видеть заранее.
CREATE TABLE IF NOT EXISTS shop_events (
    id          BIGSERIAL PRIMARY KEY,
    kind        VARCHAR(16) NOT NULL,        -- code_sent | login | register
    channel     VARCHAR(16),                 -- telegram | whatsapp (для code_sent)
    phone_tail  VARCHAR(4),                  -- последние 4 цифры номера, не больше
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_events_kind_time ON shop_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_events_time ON shop_events (created_at DESC);

-- Посещения страниц: сколько людей заходит на сайт, даже если ничего не купили.
-- visitor — отпечаток случайного идентификатора из браузера, посчитанный с
-- секретом сайта. Один человек за день = одна строка на страницу.
CREATE TABLE IF NOT EXISTS shop_visits (
    id          BIGSERIAL PRIMARY KEY,
    visitor     VARCHAR(32) NOT NULL,
    path        VARCHAR(200) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shop_visits_time ON shop_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS shop_visits_visitor_time ON shop_visits (visitor, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_visits_path_time ON shop_visits (path, created_at DESC);
