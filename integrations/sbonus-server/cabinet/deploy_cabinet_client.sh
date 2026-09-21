#!/usr/bin/env bash
# Кабинет SBonus: только страница входа (client), без пересборки api.
# Применяет оба клиентских патча (повторно — безвредно), пересобирает client.
# С Mac/PC:  scp -r integrations/sbonus-server/cabinet root@145.223.100.16:/tmp/sb_cabinet
# На сервере: bash /tmp/sb_cabinet/deploy_cabinet_client.sh
set -u
CD=/opt/sbonus
COMPOSE="$CD/docker-compose.prod.yml"
CLIENT="$CD/sbonus-client"
SRC="$(cd "$(dirname "$0")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)
fail() { echo "❌ $*"; exit 1; }
restore() { cp "$CLIENT/app/login/page.tsx.bak_$TS" "$CLIENT/app/login/page.tsx"; cp "$CLIENT/lib/api.ts.bak_$TS" "$CLIENT/lib/api.ts"; }

cp "$CLIENT/app/login/page.tsx" "$CLIENT/app/login/page.tsx.bak_$TS"
cp "$CLIENT/lib/api.ts" "$CLIENT/lib/api.ts.bak_$TS"
python3 "$SRC/patch_client_walogin.py" "$CLIENT" || { restore; fail "патч walogin не применился, файлы возвращены"; }
python3 "$SRC/patch_client_hidecode.py" "$CLIENT" || { restore; fail "патч hidecode не применился, файлы возвращены"; }
cd "$CD" || exit 1
docker compose -f "$COMPOSE" build client || { restore; fail "build client — файлы возвращены, старый кабинет работает"; }
docker compose -f "$COMPOSE" up -d --no-deps client
echo "Жду 10 сек..."; sleep 10
curl -s -m 15 http://127.0.0.1:18812/login | grep -q "Получить код по номеру" && echo "✓ кабинет: форма кода свёрнута" || echo "⚠ проверьте /login глазами"
echo "=== ГОТОВО === бэкап: $CLIENT/app/login/page.tsx.bak_$TS"
