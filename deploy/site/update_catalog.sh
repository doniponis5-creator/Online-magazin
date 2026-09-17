#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Обновление каталога сайта (cron каждые 10 минут).
# Забирает каталог с сервера SBonus; если он изменился — пересобирает сайт.
# Если новая версия не запустилась — возвращает предыдущую.
# Лог: /var/log/smartcentr-site.log
# ════════════════════════════════════════════════════════════════════════════
set -u
SITE=/opt/smartcentr-site
COMPOSE="docker compose -f $SITE/deploy/site/docker-compose.yml"
exec 9>/var/lock/smartcentr-site.lock
flock -n 9 || { echo "$(date -Is) предыдущее обновление ещё идёт — пропуск"; exit 0; }

cd "$SITE" || exit 1
node scripts/sync-catalog.mjs
CODE=$?
[ $CODE -eq 10 ] && exit 0
[ $CODE -ne 0 ] && { echo "$(date -Is) синхронизация не удалась (код $CODE)"; exit 1; }

echo "$(date -Is) каталог изменился — пересборка сайта"
docker image tag smartcentr-site:latest smartcentr-site:previous 2>/dev/null
if ! $COMPOSE build site >/tmp/smartcentr-site-build.log 2>&1; then
    echo "$(date -Is) ❌ сборка не удалась, работает прежняя версия. Хвост лога:"
    tail -20 /tmp/smartcentr-site-build.log
    exit 1
fi
$COMPOSE up -d site
for i in $(seq 1 30); do
    sleep 2
    if curl -fs -o /dev/null http://127.0.0.1:18820/ru; then
        echo "$(date -Is) ✓ сайт обновлён"
        docker image prune -f >/dev/null 2>&1
        exit 0
    fi
done
echo "$(date -Is) ❌ новая версия не отвечает — возвращаю предыдущую"
docker image tag smartcentr-site:previous smartcentr-site:latest
$COMPOSE up -d --no-build site
exit 1
