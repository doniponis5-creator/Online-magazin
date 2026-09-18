-- ============================================================================
-- Интернет-магазин Smart Centr: необязательный пароль покупателя для входа на сайт.
-- Новая таблица; таблицы SBonus (customers, bonus_accounts и др.) НЕ меняются.
-- Телефон остаётся единственным ключом клиента — пароль только ускоряет вход.
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_passwords (
    phone         VARCHAR(20) PRIMARY KEY,   -- +996XXXXXXXXX, тот же номер, что в customers
    password_hash VARCHAR(255) NOT NULL,     -- bcrypt, сам пароль нигде не хранится
    updated_at    TIMESTAMP DEFAULT NOW()
);
