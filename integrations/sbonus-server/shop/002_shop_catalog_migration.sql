-- ============================================================================
-- Интернет-магазин Smart Centr: каталог и фото, которые присылает 1С
-- Новые таблицы, существующие не затрагиваются.
-- ============================================================================

-- Каталог целиком одной записью: 1С присылает полный снимок, сайт забирает его.
CREATE TABLE IF NOT EXISTS shop_catalog (
    id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data        JSONB NOT NULL,              -- {"items": [...]}
    hash        VARCHAR(64) NOT NULL,        -- sha256 содержимого: сайт обновляется, только если он изменился
    items_count INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Фото товаров (JPEG после редактора 1С). Ключ содержит часть md5 —
-- при замене фото меняется адрес, и браузеры не показывают старую копию.
CREATE TABLE IF NOT EXISTS shop_photos (
    key         VARCHAR(120) PRIMARY KEY,    -- <GUID товара>-<номер>-<md5[:10]>
    content     BYTEA NOT NULL,
    md5         VARCHAR(32) NOT NULL,
    size_bytes  INTEGER NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW()
);
