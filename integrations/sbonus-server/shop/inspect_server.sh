#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# ПРОВЕРКА СЕРВЕРА ПЕРЕД ДЕПЛОЕМ — ТОЛЬКО ЧТЕНИЕ.
# Ничего не создаёт, не меняет, не перезапускает. Значения секретов не выводит
# (из .env показываются только ИМЕНА переменных).
#
# Запуск на сервере:  bash /tmp/sb_shop/inspect_server.sh
# ════════════════════════════════════════════════════════════════════════════
CD=/opt/sbonus
APP="$CD/sbonus-backend/app"
line() { echo; echo "━━━ $1 ━━━"; }

line "1. Система"
hostname; uptime
df -h / | tail -1
free -m | sed -n '1,2p'

line "2. Контейнеры"
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}} | {{.Ports}}'

line "3. Файлы проекта SBonus"
ls -la "$CD" 2>&1 | head -30
ls "$CD"/docker-compose*.yml 2>&1
ls -la "$APP" 2>&1 | head -40

line "4. Модуль оплаты O!Деньги (app/payments)"
ls -la "$APP/payments" 2>&1 | head -20

line "5. Уже есть app/shop? (должно не быть)"
ls -la "$APP/shop" 2>&1 | head

line "6. main.py: подключённые роутеры"
grep -n "include_router\|^from app\.\|^import" "$APP/main.py" 2>&1 | head -60

line "7. Сборка образа api (docker-compose)"
grep -n -A12 "^  api:" "$CD/docker-compose.prod.yml" 2>&1 | head -30
ls "$CD/sbonus-backend/Dockerfile" 2>&1 && grep -n "COPY\|WORKDIR\|CMD" "$CD/sbonus-backend/Dockerfile" 2>&1

line "8. Переменные .env.production (только имена)"
cut -d= -f1 "$CD/.env.production" 2>/dev/null | grep -v '^#' | grep -v '^$' | sort

line "9. Код внутри контейнера совпадает с исходником?"
docker exec sbonus_api sh -c 'ls /app/app | head -30; echo; grep -c include_router /app/app/main.py' 2>&1
echo "исходник: $(grep -c include_router "$APP/main.py" 2>/dev/null) include_router"

line "10. Версии Python-библиотек в api"
docker exec sbonus_api python3 -c "import fastapi, pydantic, sqlalchemy; print('fastapi', fastapi.__version__, '| pydantic', pydantic.VERSION, '| sqlalchemy', sqlalchemy.__version__)" 2>&1

line "11. Таблицы БД (есть ли уже shop_orders)"
docker exec sbonus_db psql -U sbonus -d sbonus_db -c "\dt" 2>&1 | grep -E "shop_|installment_|payment_events|List of|Name" | head -20

line "12. Проверка API"
curl -s -m 10 https://api.smartcentr.store/health; echo
curl -s -m 10 -o /dev/null -w "рассрочка /payment/create: HTTP %{http_code} (401 = работает)\n" -X POST https://api.smartcentr.store/api/v1/webhook/1c/payment/create

line "13. Веб-сервер и домены (для будущего сайта)"
(command -v nginx && nginx -v) 2>&1
ls /etc/nginx/sites-enabled/ 2>&1 | head
grep -rh "server_name" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | sort -u | head
docker ps --format '{{.Names}} {{.Ports}}' | grep -E ":80->|:443->"
ss -ltnp 2>/dev/null | grep -E ":80 |:443 |:3000 " | head

line "14. Node.js на сервере (для сайта)"
(command -v node && node -v) 2>&1 | head -2

line "15. Бэкапы"
ls -la "$CD/backups" 2>&1 | tail -5

echo; echo "=== ПРОВЕРКА ЗАВЕРШЕНА. Ничего не изменено. ==="
