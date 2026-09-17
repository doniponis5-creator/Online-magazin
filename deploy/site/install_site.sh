#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Установка / обновление сайта Smart Centr на сервере (по умолчанию shop.smartcentr.store).
#
#  • сайт — отдельный контейнер smartcentr_site (127.0.0.1:18820), SBonus не затрагивается;
#  • секрет сайта берётся из /opt/sbonus/.env.production (никуда не выводится);
#  • nginx: полный бэкап /etc/nginx; скрипт ТОЛЬКО добавляет свой smartcentr-shop.conf,
#    чужие конфиги (smartcentr.store, sbonus, api и др.) не отключает и не меняет;
#  • HTTPS: certbot запускается, только если DNS домена уже указывает на этот сервер;
#  • cron: каталог из 1С проверяется каждые 10 минут (deploy/site/update_catalog.sh).
#
# ПЕРЕД запуском (с Windows, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File deploy\site\pack.ps1
#   scp smartcentr-site.tar.gz root@145.223.100.16:/tmp/
#   scp deploy/site/install_site.sh root@145.223.100.16:/tmp/
# Запуск:  ssh -t root@145.223.100.16 "bash /tmp/install_site.sh"
# Другой домен:  ssh -t root@145.223.100.16 "bash /tmp/install_site.sh shop2.smartcentr.store"
# ════════════════════════════════════════════════════════════════════════════
set -u
DOMAIN=${1:-shop.smartcentr.store}
API_HOST=api.smartcentr.store
SITE=/opt/smartcentr-site
ARCHIVE=/tmp/smartcentr-site.tar.gz
SBONUS_ENV=/opt/sbonus/.env.production
PORT=18820
TS=$(date +%Y%m%d_%H%M%S)
BACKUP=/opt/smartcentr-site-backups/$TS
NGINX_CONF=/etc/nginx/sites-available/smartcentr-shop.conf
NGINX_LINK=/etc/nginx/sites-enabled/smartcentr-shop.conf
COMPOSE="docker compose -f $SITE/deploy/site/docker-compose.yml"

step() { echo; echo "━━━ $1 ━━━"; }
fail() { echo "❌ $1"; exit 1; }

step "0. Проверки (домен магазина: $DOMAIN)"
[ -f "$ARCHIVE" ] || fail "Нет $ARCHIVE — сначала скопируйте архив сайта"
command -v docker >/dev/null || fail "Нет docker"
command -v node >/dev/null || fail "Нет node"
command -v nginx >/dev/null || fail "Нет nginx"
grep -q '^SHOP_SITE_SECRET=' "$SBONUS_ENV" || fail "В $SBONUS_ENV нет SHOP_SITE_SECRET — сначала deploy_shop.sh"
curl -s -m 10 https://$API_HOST/health | grep -q healthy || fail "$API_HOST не отвечает healthy"
# Домен не должен уже обслуживаться чужим конфигом — иначе будет конфликт, а чужое мы не трогаем.
BUSY=$(grep -lE "server_name[^;]*[[:space:]]${DOMAIN//./\\.}([[:space:]]|;)" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null | grep -v smartcentr-shop.conf || true)
[ -z "$BUSY" ] || fail "$DOMAIN уже есть в другом конфиге nginx: $BUSY — пришлите этот вывод в чат"
echo "✓ всё на месте"

step "1. Бэкап"
mkdir -p "$BACKUP"
tar -czf "$BACKUP/nginx.tar.gz" -C / etc/nginx && echo "✓ nginx → $BACKUP/nginx.tar.gz"
[ -d "$SITE" ] && tar -czf "$BACKUP/site-previous.tar.gz" --exclude=node_modules --exclude=.next -C / "${SITE#/}" \
    && echo "✓ прежняя версия сайта → $BACKUP/site-previous.tar.gz"

step "2. Файлы сайта"
mkdir -p "$SITE"
KEEP_CATALOG=""
[ -f "$SITE/src/data/1c/catalog.json" ] && cp "$SITE/src/data/1c/catalog.json" "$BACKUP/catalog.json" && KEEP_CATALOG=1
find "$SITE" -mindepth 1 -maxdepth 1 ! -name '.env.production' -exec rm -rf {} +
tar -xzf "$ARCHIVE" -C "$SITE" || fail "архив не распаковался"
[ -n "$KEEP_CATALOG" ] && cp "$BACKUP/catalog.json" "$SITE/src/data/1c/catalog.json"
find "$SITE/deploy/site" -name '*.sh' -exec sed -i 's/\r$//' {} + -exec chmod +x {} +
echo "✓ сайт распакован в $SITE"

step "3. Настройки сайта (.env.production)"
SECRET=$(grep '^SHOP_SITE_SECRET=' "$SBONUS_ENV" | head -1 | cut -d= -f2-)
umask 077
cat > "$SITE/.env.production" <<EOF
# Создано install_site.sh $TS. Секрет совпадает с SHOP_SITE_SECRET сервера SBonus.
SHOP_API_URL=https://$API_HOST
SHOP_API_SECRET=$SECRET
SHOP_PAYMENT_MODE=
EOF
unset SECRET
umask 022
echo "✓ .env.production записан (секрет не показывается)"

step "4. Каталог из 1С"
( cd "$SITE" && node scripts/sync-catalog.mjs ); CODE=$?
case $CODE in
    0) echo "✓ каталог получен с сервера" ;;
    10) echo "• каталог с сервера не изменился или 1С его ещё не отправляла — используется файл из архива" ;;
    *) echo "⚠ каталог с сервера не получен — используется файл из архива" ;;
esac

step "5. Сборка и запуск контейнера сайта (3–5 минут)"
docker image inspect smartcentr-site:latest >/dev/null 2>&1 && docker image tag smartcentr-site:latest smartcentr-site:previous
$COMPOSE build site || fail "сборка не удалась — nginx не трогали"
$COMPOSE up -d site
OK=""
for i in $(seq 1 45); do
    sleep 2
    curl -fs -o /dev/null http://127.0.0.1:$PORT/ru && { OK=1; break; }
done
[ -n "$OK" ] || { docker logs smartcentr_site --tail 30; fail "сайт не ответил на 127.0.0.1:$PORT — nginx не трогали"; }
echo "✓ сайт отвечает на 127.0.0.1:$PORT"

step "6. nginx для $DOMAIN (только свой конфиг)"
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
KEY=/etc/letsencrypt/live/$DOMAIN/privkey.pem

PROXY='
    client_max_body_size 5m;
    location /_next/static/ {
        proxy_pass http://127.0.0.1:'$PORT';
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:'$PORT';
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }'

[ -f "$NGINX_CONF" ] && cp -a "$NGINX_CONF" "$BACKUP/smartcentr-shop.conf.previous"

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    SSL_OPTS=""
    [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && SSL_OPTS="    include /etc/letsencrypt/options-ssl-nginx.conf;"
    cat > "$NGINX_CONF" <<EOF
# Магазин Smart Centr (install_site.sh $TS)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$DOMAIN\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    ssl_certificate $CERT;
    ssl_certificate_key $KEY;
$SSL_OPTS
$PROXY
}
EOF
    echo "✓ конфиг с HTTPS (сертификат: $CERT)"
else
    cat > "$NGINX_CONF" <<EOF
# Магазин Smart Centr (install_site.sh $TS) — HTTP; HTTPS добавит certbot ниже
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
$PROXY
}
EOF
    echo "• сертификата нет — сначала HTTP, затем certbot"
fi
ln -sf "$NGINX_CONF" "$NGINX_LINK"

restore_nginx() {
    if [ -f "$BACKUP/smartcentr-shop.conf.previous" ]; then
        cp -a "$BACKUP/smartcentr-shop.conf.previous" "$NGINX_CONF"
    else
        rm -f "$NGINX_LINK" "$NGINX_CONF"
    fi
    nginx -t && systemctl reload nginx
}
if ! nginx -t; then
    echo "❌ nginx -t не прошёл — возвращаю прежние настройки"
    restore_nginx
    exit 1
fi
systemctl reload nginx && echo "✓ nginx перезагружен"

if [ ! -f "$CERT" ]; then
    MY_IP=$(curl -s -m 10 https://api.ipify.org || true)
    DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
    if [ -z "$DNS_IP" ] || [ "$DNS_IP" != "$MY_IP" ]; then
        echo "⚠ DNS $DOMAIN → '${DNS_IP:-нет записи}', а этот сервер — $MY_IP. certbot пропущен."
        echo "  Добавьте A-запись и запустите скрипт ещё раз."
    elif command -v certbot >/dev/null; then
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --redirect --keep-until-expiring \
            || echo "⚠ HTTPS не получен. Сайт работает по HTTP."
    else
        echo "⚠ certbot не установлен — сайт работает по HTTP"
    fi
fi

# Файл отката: убрать магазин из nginx (чужие конфиги не затрагиваются).
cat > "$BACKUP/restore_previous_site.sh" <<EOF
#!/usr/bin/env bash
# Убрать магазин $DOMAIN из nginx (установка $TS)
if [ -f "$BACKUP/smartcentr-shop.conf.previous" ]; then
    cp -a "$BACKUP/smartcentr-shop.conf.previous" "$NGINX_CONF"
else
    rm -f "$NGINX_LINK"
fi
nginx -t && systemctl reload nginx && echo "Готово. Контейнер магазина: docker stop smartcentr_site"
EOF
chmod +x "$BACKUP/restore_previous_site.sh"

step "7. Автообновление каталога (cron, каждые 10 минут)"
cat > /etc/cron.d/smartcentr-site <<EOF
# Сайт Smart Centr: каталог из 1С (через сервер SBonus) — проверка каждые 10 минут
*/10 * * * * root $SITE/deploy/site/update_catalog.sh >> /var/log/smartcentr-site.log 2>&1
EOF
chmod 644 /etc/cron.d/smartcentr-site
echo "✓ /etc/cron.d/smartcentr-site"

step "8. Проверка"
for url in "https://$DOMAIN/ru" "http://$DOMAIN/ru"; do
    CODE=$(curl -s -o /dev/null -m 15 -w "%{http_code}" --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" "$url")
    echo "  $url → HTTP $CODE"
done
curl -s -m 10 https://$API_HOST/health; echo
docker ps --format '{{.Names}} | {{.Status}}' | grep -E 'smartcentr_site|sbonus_'

echo
echo "=== ГОТОВО: магазин на https://$DOMAIN ==="
echo "Убрать магазин из nginx:  bash $BACKUP/restore_previous_site.sh"
echo "Лог обновлений каталога:  tail -f /var/log/smartcentr-site.log"
