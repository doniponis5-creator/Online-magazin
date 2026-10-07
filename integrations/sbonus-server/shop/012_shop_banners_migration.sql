-- ============================================================================
-- Интернет-магазин Smart Centr: баннеры главной страницы сайта из 1С (07.10).
-- Только новая таблица; существующие не затрагиваются. Повторный запуск
-- ничего не меняет (IF NOT EXISTS).
--
-- Владелец кладёт в 1С («Панель сайта» → «Баннеры») готовую картинку от
-- дизайнера: широкую для компьютера и, если есть, квадратную для телефона.
-- Картинка хранится как есть (не пережимаем): сайт сам отдаёт телефону
-- нужный размер. sort — порядок на сайте; md5 — в адресе картинки, чтобы
-- новая картинка не застряла в кэше браузера.
-- link: '' — никуда; product:<код 1С>; cat:<раздел>; /ru/…; https://…
-- starts / ends — даты по Бишкеку включительно; NULL — без ограничения.
-- ============================================================================

CREATE TABLE IF NOT EXISTS shop_banners (
    id            SERIAL        PRIMARY KEY,
    sort          INTEGER       NOT NULL DEFAULT 0,
    title         VARCHAR(80)   NOT NULL DEFAULT '',
    link          VARCHAR(300)  NOT NULL DEFAULT '',
    active        BOOLEAN       NOT NULL DEFAULT TRUE,
    starts        DATE,
    ends          DATE,
    desktop       BYTEA,
    desktop_mime  VARCHAR(20),
    desktop_md5   VARCHAR(32),
    desktop_w     INTEGER,
    desktop_h     INTEGER,
    mobile        BYTEA,
    mobile_mime   VARCHAR(20),
    mobile_md5    VARCHAR(32),
    mobile_w      INTEGER,
    mobile_h      INTEGER,
    updated_at    TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
