#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Кабинет SBonus: вход через WhatsApp «наоборот».
#
# Что делает: патчит customer_auth.py (бэкенд) и страницу входа кабинета,
# пересобирает api и client. Бэкап каждого файла; api не поднялся — откат.
# Требует, чтобы app/shop уже был выкачен (deploy_shop.sh) — оттуда общая логика.
#
# С Mac/PC:  scp -r integrations/sbonus-server/cabinet root@145.223.100.16:/tmp/sb_cabinet
# На сервере: bash /tmp/sb_cabinet/deploy_cabinet_walogin.sh
# ════════════════════════════════════════════════════════════════════════════
set -u
CD=/opt/sbonus
COMPOSE="$CD/docker-compose.prod.yml"
AUTH="$CD/sbonus-backend/app/api/v1/customer_auth.py"
CLIENT="$CD/sbonus-client"
SRC="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)

step() { echo; echo "── $* ──────────────────────────────────"; }
fail() { echo "❌ $*"; exit 1; }

step "0. Проверки"
[ -f "$AUTH" ] || fail "нет $AUTH"
[ -f "$CLIENT/app/login/page.tsx" ] || fail "нет $CLIENT/app/login/page.tsx"
grep -q "_scan_wa_logins" "$CD/sbonus-backend/app/shop/shop_customers.py" || fail "сначала deploy_shop.sh: в app/shop нет wa-login"

step "1. Бэкенд: customer_auth.py"
cp "$AUTH" "$AUTH.bak_$TS"
python3 "$SRC/patch_backend_walogin.py" "$AUTH" || { cp "$AUTH.bak_$TS" "$AUTH"; fail "патч не применился, файл возвращён"; }
python3 -m py_compile "$AUTH" || { cp "$AUTH.bak_$TS" "$AUTH"; fail "синтаксис — файл возвращён"; }

step "2. Пересборка api"
cd "$CD" || exit 1
docker compose -f "$COMPOSE" build api || { cp "$AUTH.bak_$TS" "$AUTH"; fail "build api — файл возвращён, старый контейнер работает"; }
docker compose -f "$COMPOSE" up -d --no-deps api
echo "Жду 15 сек..."; sleep 15
HEALTH=$(curl -s -m 10 https://api.smartcentr.store/health)
if ! echo "$HEALTH" | grep -q '"healthy"'; then
    echo "❌ api не healthy: $HEALTH — откат"
    cp "$AUTH.bak_$TS" "$AUTH"
    docker compose -f "$COMPOSE" build api && docker compose -f "$COMPOSE" up -d --no-deps api
    sleep 15; echo "После отката: $(curl -s -m 10 https://api.smartcentr.store/health)"
    exit 1
fi
echo "✓ api healthy"
# Новый эндпоинт отвечает? (без тела — ждём 422/200, но не 404)
CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X POST https://api.smartcentr.store/api/v1/customer-auth/wa-login/start)
[ "$CODE" != "404" ] || fail "wa-login/start отвечает 404 — роутер не подхватил"
echo "✓ wa-login/start отвечает $CODE"

step "3. Кабинет: страница входа"
cp "$CLIENT/app/login/page.tsx" "$CLIENT/app/login/page.tsx.bak_$TS"
cp "$CLIENT/lib/api.ts" "$CLIENT/lib/api.ts.bak_$TS"
python3 "$SRC/patch_client_walogin.py" "$CLIENT" || {
    cp "$CLIENT/app/login/page.tsx.bak_$TS" "$CLIENT/app/login/page.tsx"; cp "$CLIENT/lib/api.ts.bak_$TS" "$CLIENT/lib/api.ts"
    fail "патч кабинета не применился, файлы возвращены (api уже с новыми эндпоинтами — это не мешает)"
}

step "4. Пересборка client"
docker compose -f "$COMPOSE" build client || {
    cp "$CLIENT/app/login/page.tsx.bak_$TS" "$CLIENT/app/login/page.tsx"; cp "$CLIENT/lib/api.ts.bak_$TS" "$CLIENT/lib/api.ts"
    fail "build client — файлы возвращены, старый кабинет работает"
}
docker compose -f "$COMPOSE" up -d --no-deps client
echo "Жду 10 сек..."; sleep 10
if curl -s -m 15 http://127.0.0.1:18812/login | grep -q "WhatsApp"; then
    echo "✓ кабинет: на странице входа есть WhatsApp"
else
    echo "⚠ кабинет поднялся, но слово WhatsApp на /login не найдено — проверьте глазами"
fi

echo; echo "=== ГОТОВО === бэкапы: $AUTH.bak_$TS, $CLIENT/app/login/page.tsx.bak_$TS"
