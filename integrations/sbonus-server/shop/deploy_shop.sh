#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Деплой: интернет-магазин (заказы, каталог, вход покупателя, бонусы) на сервер SBonus.
# Добавляет пакет app/shop и 2 новые таблицы. Оплату рассрочки (app/payments)
# НЕ меняет — только использует её модули O!Деньги и WhatsApp.
# Пересобирается ТОЛЬКО api, как в deploy_balance_update.sh. Есть бэкап и откат.
#
# ПЕРЕД запуском (с Windows, из папки проекта сайта):
#   ssh root@145.223.100.16 "rm -rf /tmp/sb_shop"
#   scp -r integrations/sbonus-server/shop root@145.223.100.16:/tmp/sb_shop
#
# rm -rf обязателен: если /tmp/sb_shop уже есть, scp кладёт файлы ВНУТРЬ неё
# (/tmp/sb_shop/shop), запускается старый скрипт и молча пересобирает сервер
# прежним кодом — с виду «ГОТОВО», а изменений нет.
#
# Запуск на сервере:  bash /tmp/sb_shop/deploy_shop.sh
# ════════════════════════════════════════════════════════════════════════════
set -u
CD=/opt/sbonus
COMPOSE="$CD/docker-compose.prod.yml"
APP="$CD/sbonus-backend/app"
DST="$APP/shop"
ENV_FILE="$CD/.env.production"
SRC="$(cd "$(dirname "$0")" && pwd)"
API=sbonus_api
DB=sbonus_db
TS=$(date +%Y%m%d_%H%M%S)
FILES="__init__.py shop_models.py shop_router.py shop_catalog.py shop_telegram.py shop_customers.py shop_admin.py shop_push.py shop_whatsapp.py shop_installments_calc.py shop_installments.py"
MIGRATIONS="001_shop_orders_migration.sql 002_shop_catalog_migration.sql 003_shop_bonus_migration.sql 004_shop_stats_migration.sql 005_shop_push_migration.sql 006_shop_installments_migration.sql 007_shop_notes_migration.sql"

echo "=== Деплой: интернет-магазин (заказы + каталог + вход и бонусы) ==="

# ── 0.0 Свежие файлы положили внутрь старой папки? ──────────────────────────
if [ -d "$SRC/shop" ] && [ -f "$SRC/shop/shop_admin.py" ]; then
    echo "❌ Похоже, scp положил свежие файлы в $SRC/shop, а запустился старый скрипт из $SRC."
    echo "   На сервере:  rm -rf /tmp/sb_shop"
    echo "   С Windows:   scp -r integrations/sbonus-server/shop root@145.223.100.16:/tmp/sb_shop"
    echo "   Ничего не изменено."
    exit 1
fi

# ── 0. Проверки ──────────────────────────────────────────────────────────────
[ -d "$APP/payments" ] || { echo "❌ Нет $APP/payments — модуль O!Деньги не найден"; exit 1; }
[ -f "$APP/main.py" ] || { echo "❌ Нет $APP/main.py"; exit 1; }
for f in $FILES $MIGRATIONS; do [ -f "$SRC/$f" ] || { echo "❌ Нет файла: $SRC/$f"; exit 1; }; done
docker ps --format '{{.Names}}' | grep -qx "$API" || { echo "❌ Контейнер $API не запущен"; exit 1; }
echo "✓ Файлы и контейнеры на месте"

# ── 0.1 Пробный импорт ВНУТРИ работающего api (ничего не меняет в работе) ────
# Копируем пакет во временную папку контейнера и импортируем: ловим ошибки импорта,
# несовместимость с pydantic/sqlalchemy и отсутствующие функции O!Деньги ДО пересборки.
docker exec "$API" rm -rf /app/app/shop_precheck
docker exec "$API" mkdir -p /app/app/shop_precheck
for f in $FILES; do docker cp "$SRC/$f" "$API:/app/app/shop_precheck/$f"; done
docker exec "$API" python3 -c "
from app.payments import obank_service as o, payments_greenapi as w
need = ['_request', '_to_kopecks', 'check_status', 'is_api_mode', 'verify_callback', 'parse_callback', 'callback_ack']
missing = [n for n in need if not hasattr(o, n)] + ([] if hasattr(w, 'send_text') else ['send_text'])
assert not missing, 'нет функций: %s' % missing
import app.shop_precheck.shop_router as r
import app.shop_precheck.shop_catalog as c
import app.shop_precheck.shop_customers as cu
import app.shop_precheck.shop_admin as ad
import app.shop_precheck.shop_whatsapp as wa_btn
import app.shop_precheck.shop_installments as inst
assert inst.parse_phones('0558311031/0558882507') == ['+996558311031', '+996558882507']
assert len(ad.SETTINGS) >= 3
from app.models import Branch, BonusAccount, Customer, Setting, Tier, Transaction, TransactionType
from app.core.redis import check_rate_limit, redis_client
assert cu.max_spend(__import__('decimal').Decimal('5000'), __import__('decimal').Decimal('20000'), __import__('decimal').Decimal('10')) == 2000
paths = [x.path for x in r.router_site.routes + r.router_obank_shop.routes + r.router_1c_shop.routes
         + c.router_1c_catalog.routes + c.router_site_catalog.routes + c.router_public_photos.routes
         + cu.router_site_customer.routes + ad.router_1c_admin.routes + ad.router_site_admin.routes
         + inst.router_1c_installments.routes + inst.router_site_installments.routes]
print('OK: модуль импортируется, маршрутов:', len(paths))
"
PRECHECK=$?
docker exec "$API" rm -rf /app/app/shop_precheck
[ $PRECHECK -eq 0 ] || { echo "❌ Пробный импорт не прошёл — ничего не установлено, сервер работает как раньше"; exit 1; }
echo "✓ Пробный импорт прошёл"

# ── 1. Бэкап БД и main.py ────────────────────────────────────────────────────
mkdir -p "$CD/backups"
docker exec "$DB" pg_dump -U sbonus sbonus_db | gzip > "$CD/backups/before_shop_$TS.sql.gz" \
    && echo "✓ Бэкап БД: $CD/backups/before_shop_$TS.sql.gz" \
    || { echo "❌ Бэкап БД не сделан — стоп"; exit 1; }
cp "$APP/main.py" "$APP/main.py.bak_$TS"
[ -d "$DST" ] && cp -r "$DST" "$DST.bak_$TS"
echo "✓ Бэкап main.py${DST:+ и app/shop}: .bak_$TS"

# ── 2. Пакет shop в исходник образа ──────────────────────────────────────────
mkdir -p "$DST"
for f in $FILES; do cp "$SRC/$f" "$DST/$f"; done
echo "✓ app/shop обновлён"

# ── 3. Подключить роутеры в main.py (один раз) ───────────────────────────────
python3 - "$APP/main.py" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "app.shop.shop_router" in s:
    print("• main.py уже подключает заказы сайта — пропуск")
    raise SystemExit(0)
block = '''

# ── Интернет-магазин: заказы с сайта (O!Деньги → 1С) ──
from app.shop.shop_router import router_site as shop_site_router, router_obank_shop, router_1c_shop
app.include_router(shop_site_router, prefix="/api/v1")   # /api/v1/webhook/site/orders
app.include_router(router_obank_shop, prefix="/api/v1")  # /api/v1/webhook/obank/shop-callback
app.include_router(router_1c_shop, prefix="/api/v1")     # /api/v1/webhook/1c/shop/*
'''
for anchor in ("app.include_router(payments_admin_router)", "app.include_router(api_v2_router)"):
    idx = s.find(anchor)
    if idx >= 0:
        end = s.find("\n", idx)
        end = len(s) if end < 0 else end
        s = s[:end] + block + s[end:]
        open(p, "w", encoding="utf-8").write(s)
        print("✓ main.py: роутеры заказов подключены после", anchor)
        break
else:
    raise SystemExit("❌ В main.py не найдено место для подключения роутеров")
PYEOF
[ $? -eq 0 ] || { cp "$APP/main.py.bak_$TS" "$APP/main.py"; echo "↩️ main.py восстановлен"; exit 1; }

python3 - "$APP/main.py" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "app.shop.shop_catalog" in s:
    print("• main.py уже подключает каталог сайта — пропуск")
    raise SystemExit(0)
anchor = 'app.include_router(router_1c_shop, prefix="/api/v1")'
idx = s.find(anchor)
if idx < 0:
    raise SystemExit("❌ В main.py нет роутеров заказов — не к чему подключить каталог")
end = s.find("\n", idx)
end = len(s) if end < 0 else end
block = """
from app.shop.shop_catalog import router_1c_catalog, router_site_catalog, router_public_photos
app.include_router(router_1c_catalog, prefix="/api/v1")     # /api/v1/webhook/1c/shop/catalog, photos
app.include_router(router_site_catalog, prefix="/api/v1")   # /api/v1/webhook/site/catalog
app.include_router(router_public_photos, prefix="/api/v1")  # /api/v1/shop/photos/{key}.jpg"""
s = s[:end] + block + s[end:]
open(p, "w", encoding="utf-8").write(s)
print("✓ main.py: роутеры каталога подключены")
PYEOF
[ $? -eq 0 ] || { cp "$APP/main.py.bak_$TS" "$APP/main.py"; echo "↩️ main.py восстановлен"; exit 1; }

python3 - "$APP/main.py" <<'PYEOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "app.shop.shop_customers" in s:
    print("• main.py уже подключает вход покупателя — пропуск")
    raise SystemExit(0)
anchor = 'app.include_router(router_public_photos, prefix="/api/v1")'
idx = s.find(anchor)
if idx < 0:
    raise SystemExit("❌ В main.py нет роутеров каталога — не к чему подключить вход покупателя")
end = s.find("\n", idx)
end = len(s) if end < 0 else end
block = """
from app.shop.shop_customers import router_site_customer
app.include_router(router_site_customer, prefix="/api/v1")  # /api/v1/webhook/site/customer/*"""
s = s[:end] + block + s[end:]
open(p, "w", encoding="utf-8").write(s)
print("✓ main.py: роутер входа покупателя и бонусов подключён")
PYEOF
[ $? -eq 0 ] || { cp "$APP/main.py.bak_$TS" "$APP/main.py"; echo "↩️ main.py восстановлен"; exit 1; }

python3 - "$APP/main.py" <<'PYEOF2'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "app.shop.shop_admin" in s:
    print("• main.py уже подключает панель сайта — пропуск")
    raise SystemExit(0)
anchor = 'app.include_router(router_site_customer, prefix="/api/v1")'
idx = s.find(anchor)
if idx < 0:
    raise SystemExit("❌ В main.py нет роутера входа покупателя — не к чему подключить панель сайта")
end = s.find(chr(10), idx)
end = len(s) if end < 0 else end
block = """
from app.shop.shop_admin import router_1c_admin, router_site_admin
app.include_router(router_1c_admin, prefix="/api/v1")    # /api/v1/webhook/1c/shop/settings, dashboard
app.include_router(router_site_admin, prefix="/api/v1")  # /api/v1/webhook/site/settings"""
s = s[:end] + block + s[end:]
open(p, "w", encoding="utf-8").write(s)
print("✓ main.py: панель сайта (настройки и сводка) подключена")
PYEOF2
[ $? -eq 0 ] || { cp "$APP/main.py.bak_$TS" "$APP/main.py"; echo "↩️ main.py восстановлен"; exit 1; }

python3 - "$APP/main.py" <<'PYEOF3'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "app.shop.shop_installments" in s:
    print("• main.py уже подключает рассрочку для сайта — пропуск")
    raise SystemExit(0)
anchor = 'app.include_router(router_site_admin, prefix="/api/v1")'
idx = s.find(anchor)
if idx < 0:
    raise SystemExit("❌ В main.py нет панели сайта — не к чему подключить рассрочку")
end = s.find(chr(10), idx)
end = len(s) if end < 0 else end
block = """
from app.shop.shop_installments import router_1c_installments, router_site_installments
app.include_router(router_1c_installments, prefix="/api/v1")    # /api/v1/webhook/1c/shop/installments
app.include_router(router_site_installments, prefix="/api/v1")  # /api/v1/webhook/site/customer/{phone}/installment"""
s = s[:end] + block + s[end:]
open(p, "w", encoding="utf-8").write(s)
print("✓ main.py: рассрочка для чата сайта подключена")
PYEOF3
[ $? -eq 0 ] || { cp "$APP/main.py.bak_$TS" "$APP/main.py"; echo "↩️ main.py восстановлен"; exit 1; }

# ── 4. Синтаксис ─────────────────────────────────────────────────────────────
for f in $FILES; do
    python3 -c "import ast; ast.parse(open('$DST/$f', encoding='utf-8').read())" \
        || { echo "❌ Синтаксис $f — откат"; cp "$APP/main.py.bak_$TS" "$APP/main.py"; exit 1; }
done
echo "✓ Синтаксис OK"

# ── 5. Таблицы ───────────────────────────────────────────────────────────────
docker cp "$SRC/001_shop_orders_migration.sql" "$DB:/tmp/001_shop_orders_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/001_shop_orders_migration.sql \
    && echo "✓ Таблицы shop_orders, shop_order_events" \
    || { echo "❌ Миграция не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/002_shop_catalog_migration.sql" "$DB:/tmp/002_shop_catalog_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/002_shop_catalog_migration.sql \
    && echo "✓ Таблицы shop_catalog, shop_photos" \
    || { echo "❌ Миграция каталога не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/003_shop_bonus_migration.sql" "$DB:/tmp/003_shop_bonus_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/003_shop_bonus_migration.sql \
    && echo "✓ Колонки бонусов в shop_orders, настройки SITE_WELCOME_BONUS_AMOUNT и SITE_BONUS_MAX_PCT" \
    || { echo "❌ Миграция бонусов не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/004_shop_stats_migration.sql" "$DB:/tmp/004_shop_stats_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/004_shop_stats_migration.sql \
    && echo "✓ Таблицы shop_events и shop_visits (счётчики панели сайта)" \
    || { echo "❌ Миграция счётчиков не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/005_shop_push_migration.sql" "$DB:/tmp/005_shop_push_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/005_shop_push_migration.sql \
    && echo "✓ Таблица shop_push_devices (уведомления в приложении)" \
    || { echo "❌ Миграция уведомлений не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/006_shop_installments_migration.sql" "$DB:/tmp/006_shop_installments_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/006_shop_installments_migration.sql \
    && echo "✓ Таблица shop_installments (остаток по рассрочке для чата)" \
    || { echo "❌ Миграция рассрочки не прошла — стоп (код не пересобран)"; exit 1; }
docker cp "$SRC/007_shop_notes_migration.sql" "$DB:/tmp/007_shop_notes_migration.sql"
docker exec "$DB" psql -U sbonus -d sbonus_db -v ON_ERROR_STOP=1 -f /tmp/007_shop_notes_migration.sql \
    && echo "✓ Таблица shop_assistant_notes (знания для чата из 1С)" \
    || { echo "❌ Миграция знаний для чата не прошла — стоп (код не пересобран)"; exit 1; }

# ── 6. Секрет сайта в .env (создаётся один раз) ──────────────────────────────
if grep -q '^SHOP_SITE_SECRET=' "$ENV_FILE" 2>/dev/null; then
    echo "• SHOP_SITE_SECRET уже есть в $ENV_FILE"
else
    cp "$ENV_FILE" "$ENV_FILE.bak_$TS" 2>/dev/null
    printf '\n# Интернет-магазин: общий секрет сайта и сервера\nSHOP_SITE_SECRET=%s\nSHOP_SITE_BASE_URL=https://shop.smartcentr.store\n' \
        "$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "✓ SHOP_SITE_SECRET создан в $ENV_FILE (тот же секрет нужно указать сайту как SHOP_API_SECRET)"
fi

# ── 6.1 Библиотека HTTP/2 для Apple push ─────────────────────────────────────
# Apple принимает уведомления только по HTTP/2, а httpx умеет его лишь с пакетом h2.
# Пакет чистый python, ничего не ломает; добавляем один раз и с бэкапом.
REQ="$CD/sbonus-backend/requirements.txt"
if grep -qi '^h2[=<>]' "$REQ" 2>/dev/null; then
    echo "• h2 уже в requirements.txt"
else
    cp "$REQ" "$REQ.bak_$TS"
    printf '\nh2==4.1.0\n' >> "$REQ"
    echo "✓ h2 добавлен в requirements.txt (бэкап: $REQ.bak_$TS)"
fi

# ── 7. Пересборка ТОЛЬКО api ─────────────────────────────────────────────────
cd "$CD" || exit 1
docker compose -f "$COMPOSE" build api \
    || { echo "❌ build не удался — старый контейнер работает. Откат: cp $APP/main.py.bak_$TS $APP/main.py"; exit 1; }
docker compose -f "$COMPOSE" up -d --no-deps api
echo "Жду 15 сек..."; sleep 15

# ── 7.1 Автооткат, если api не поднялся ──────────────────────────────────────
HEALTH=$(curl -s -m 10 https://api.smartcentr.store/health)
if ! echo "$HEALTH" | grep -q '"healthy"'; then
    echo "❌ api не ответил healthy: $HEALTH"
    echo "↩️ АВТООТКАТ: возвращаю main.py, убираю app/shop, пересобираю прежнюю версию..."
    cp "$APP/main.py.bak_$TS" "$APP/main.py"
    [ -f "$REQ.bak_$TS" ] && cp "$REQ.bak_$TS" "$REQ"
    rm -rf "$DST"
    [ -d "$DST.bak_$TS" ] && mv "$DST.bak_$TS" "$DST"
    docker compose -f "$COMPOSE" build api && docker compose -f "$COMPOSE" up -d --no-deps api
    sleep 15
    echo "После отката: $(curl -s -m 10 https://api.smartcentr.store/health)"
    echo "Таблицы shop_* остались (они пустые и никому не мешают). Пришлите вывод в чат."
    exit 1
fi
echo "✓ api healthy"

# ── 8. Проверка ──────────────────────────────────────────────────────────────
echo "=== ПРОВЕРКА ==="
curl -s https://api.smartcentr.store/health; echo
echo "--- заказ сайта без подписи (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST https://api.smartcentr.store/api/v1/webhook/site/orders
echo "--- очередь 1С без ключа (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" https://api.smartcentr.store/api/v1/webhook/1c/shop/pending
echo "--- рассрочка по-прежнему на месте (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST https://api.smartcentr.store/api/v1/webhook/1c/payment/create
echo "--- каталог сайта без подписи (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" https://api.smartcentr.store/api/v1/webhook/site/catalog
echo "--- вход покупателя без подписи (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST https://api.smartcentr.store/api/v1/webhook/site/customer/send-code
echo "--- рассрочка для чата: 1С и сайт без подписи (ожидается 401 и 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST https://api.smartcentr.store/api/v1/webhook/1c/shop/installments
curl -s -o /dev/null -w "  HTTP %{http_code}\n" https://api.smartcentr.store/api/v1/webhook/site/customer/996555000000/installment
echo "--- знания для чата без подписи (ожидается 401) ---"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" https://api.smartcentr.store/api/v1/webhook/site/notes
echo "--- ошибки запуска ---"
docker logs "$API" --since 30s 2>&1 | grep -i -E "error|traceback" | tail -10 || echo "  (ошибок нет)"

echo ""
echo "=== ГОТОВО ==="
echo "Секрет для сайта (SHOP_API_SECRET) — показать:  grep SHOP_SITE_SECRET $ENV_FILE"
echo ""
echo "ОТКАТ КОДА (данные заказов и бонусов остаются в БД):"
echo "  cp $APP/main.py.bak_$TS $APP/main.py && rm -rf $DST && { [ -d $DST.bak_$TS ] && cp -r $DST.bak_$TS $DST; }"
echo "  cd $CD && docker compose -f $COMPOSE build api && docker compose -f $COMPOSE up -d --no-deps api"
