-- ============================================================================
-- Интернет-магазин Smart Centr: уведомления и на Android.
-- Только расширение колонки; данные не трогаются, таблица не пересоздаётся.
--
-- Адрес телефона от Apple — до 200 знаков, а адрес от Google (FCM) длиннее,
-- бывает под тысячу. Поэтому token расширяем до 1024. Повторный запуск
-- ничего не меняет: колонка уже нужной длины.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shop_push_devices'
          AND column_name = 'token'
          AND COALESCE(character_maximum_length, 0) < 1024
    ) THEN
        ALTER TABLE shop_push_devices ALTER COLUMN token TYPE VARCHAR(1024);
    END IF;
END $$;
