#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Обновление КОДА сайта Smart Centr без единого изменения в nginx.
#
# Зачем отдельно от install_site.sh: домены smarket.kg и whitefitpro.com
# настроены в nginx вручную, и установщик, который умеет заводить свой конфиг,
# для обычного обновления кода слишком много на себя берёт. Здесь только
# пересборка контейнера smartcentr_site — домены, сертификаты и чужие
# проекты на сервере не затрагиваются.
#
# ПЕРЕД запуском (с Windows, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File deploy\site\pack.ps1
#   scp smartcentr-site.tar.gz root@145.223.100.16:/tmp/
#   scp deploy/site/update_site.sh root@145.223.100.16:/tmp/
# Запуск:  ssh root@145.223.100.16 "bash /tmp/update_site.sh"
#
# Если сайт не поднимется — возвращается прежний образ, и он продолжает работать.
# ════════════════════════════════════════════════════════════════════════════
set -u
SITE=/opt/smartcentr-site
ARCHIVE=/tmp/smartcentr-site.tar.gz
SBONUS_ENV=/opt/sbonus/.env.production
PORT=18820
TS=$(date +%Y%m%d_%H%M%S)
BACKUP=/opt/smartcentr-site-backups/$TS
COMPOSE="docker compose -f $SITE/deploy/site/docker-compose.yml"

step() { echo; echo "── $* ──────────────────────────────────"; }
fail() { echo "❌ $*"; exit 1; }

[ -f "$ARCHIVE" ] || fail "нет $ARCHIVE — сначала pack.ps1 и scp"
[ -d "$SITE" ] || fail "нет $SITE — первую установку делает install_site.sh"
[ -f "$SITE/.env.production" ] || fail "нет $SITE/.env.production — первую установку делает install_site.sh"

step "1. Бэкап прежней версии"
mkdir -p "$BACKUP"
tar -czf "$BACKUP/site-previous.tar.gz" --exclude=node_modules --exclude=.next -C / "${SITE#/}" \
    && echo "✓ прежняя версия → $BACKUP/site-previous.tar.gz"
cp "$SITE/.env.production" "$BACKUP/env.production" && echo "✓ настройки сохранены"

step "2. Новые файлы"
KEEP_CATALOG=""
[ -f "$SITE/src/data/1c/catalog.json" ] && cp "$SITE/src/data/1c/catalog.json" "$BACKUP/catalog.json" && KEEP_CATALOG=1
find "$SITE" -mindepth 1 -maxdepth 1 ! -name '.env.production' -exec rm -rf {} +
tar -xzf "$ARCHIVE" -C "$SITE" || fail "архив не распаковался"
[ -n "$KEEP_CATALOG" ] && cp "$BACKUP/catalog.json" "$SITE/src/data/1c/catalog.json"
find "$SITE/deploy/site" -name '*.sh' -exec sed -i 's/\r$//' {} + -exec chmod +x {} +
echo "✓ код обновлён; .env.production оставлен прежним"

step "3. Каталог из 1С"
( cd "$SITE" && node scripts/sync-catalog.mjs ); CODE=$?
case $CODE in
    0) echo "✓ каталог получен с сервера" ;;
    10) echo "• каталог не изменился — используется прежний" ;;
    *) echo "⚠ каталог с сервера не получен — используется файл из архива" ;;
esac

step "4. Сборка и запуск (3–5 минут)"
docker image inspect smartcentr-site:latest >/dev/null 2>&1 && docker image tag smartcentr-site:latest smartcentr-site:previous
$COMPOSE build site || fail "сборка не удалась — работающий сайт не тронут"
$COMPOSE up -d site

OK=""
for i in $(seq 1 45); do
    sleep 2
    curl -fs -o /dev/null "http://127.0.0.1:$PORT/ru" && { OK=1; break; }
done
if [ -z "$OK" ]; then
    echo "❌ сайт не ответил на 127.0.0.1:$PORT"
    docker logs smartcentr_site --tail 30
    if docker image inspect smartcentr-site:previous >/dev/null 2>&1; then
        echo "↩️ возвращаю прежний образ..."
        docker image tag smartcentr-site:previous smartcentr-site:latest
        $COMPOSE up -d site
        sleep 10
        curl -fs -o /dev/null "http://127.0.0.1:$PORT/ru" && echo "✓ прежняя версия снова работает" \
            || echo "⚠ прежняя версия тоже не отвечает — нужен разбор, пришлите вывод в чат"
    fi
    fail "обновление не применено"
fi
echo "✓ сайт отвечает на 127.0.0.1:$PORT"

step "5. Проверка"
echo "--- страница входа ---"
curl -s -o /dev/null -w "  http://127.0.0.1:$PORT/ru/account → HTTP %{http_code}\n" "http://127.0.0.1:$PORT/ru/account"
echo "--- ошибки запуска ---"
docker logs smartcentr_site --since 60s 2>&1 | grep -iE "error|unhandled" | tail -10 || echo "  (ошибок нет)"

echo
echo "=== ГОТОВО ==="
echo "Бэкап: $BACKUP"
echo "Откат: docker image tag smartcentr-site:previous smartcentr-site:latest && $COMPOSE up -d site"
