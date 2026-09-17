#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Перевод магазина с smartcentr.store на shop.smartcentr.store.
#
#  1. Возвращает прежнюю страницу smartcentr.store (landing.conf, smartcentr.store) — из бэкапа 20260917_124103.
#  2. Переписывает smartcentr-shop.conf на shop.smartcentr.store (контейнер сайта не трогается).
#  3. HTTPS через certbot — только если DNS shop.smartcentr.store уже указывает на этот сервер.
#  4. SHOP_SITE_BASE_URL в /opt/sbonus/.env.production → https://shop.smartcentr.store,
#     пересоздаётся только контейнер sbonus_api (10–20 с); если он не станет healthy — возврат.
#
# Повторный запуск безопасен. Запуск: ssh -t root@145.223.100.16 "bash /tmp/switch_to_shop_domain.sh"
# ════════════════════════════════════════════════════════════════════════════
set -u
DOMAIN=shop.smartcentr.store
PORT=18820
OLD=/opt/smartcentr-site-backups/20260917_124103
TS=$(date +%Y%m%d_%H%M%S)
BACKUP=/opt/smartcentr-site-backups/switch_$TS
NGINX_CONF=/etc/nginx/sites-available/smartcentr-shop.conf
NGINX_LINK=/etc/nginx/sites-enabled/smartcentr-shop.conf
SBONUS=/opt/sbonus
ENVF=$SBONUS/.env.production
API="docker compose -f $SBONUS/docker-compose.prod.yml"

step() { echo; echo "━━━ $1 ━━━"; }
fail() { echo "❌ $1"; exit 1; }
restore_nginx() {
    echo "↩ возвращаю nginx из $BACKUP/nginx.tar.gz"
    rm -rf /etc/nginx.failed && mv /etc/nginx /etc/nginx.failed && tar -xzf "$BACKUP/nginx.tar.gz" -C / && nginx -t && systemctl reload nginx
}
code() { curl -s -o /dev/null -m 15 -w "%{http_code}" --resolve "$1:80:127.0.0.1" --resolve "$1:443:127.0.0.1" "$2"; }

step "0. Проверки"
[ -f "$OLD/disabled/list.txt" ] || fail "Нет бэкапа $OLD"
curl -fs -m 5 -o /dev/null http://127.0.0.1:$PORT/ru || fail "Контейнер сайта не отвечает на $PORT"
curl -s -m 10 http://127.0.0.1:18800/health | grep -q healthy || fail "sbonus_api не healthy — ничего не меняю"
echo "✓ всё на месте"

step "1. Бэкап"
mkdir -p "$BACKUP"
tar -czf "$BACKUP/nginx.tar.gz" -C / etc/nginx && echo "✓ nginx → $BACKUP/nginx.tar.gz"
cp -a "$ENVF" "$BACKUP/sbonus.env.production" && chmod 600 "$BACKUP/sbonus.env.production" && echo "✓ .env.production SBonus"

step "2. Возвращаю прежнюю страницу smartcentr.store"
while read -r f; do
    [ -n "$f" ] || continue
    if [ -e "$f" ] || [ -L "$f" ]; then echo "• $f уже есть"; else cp -a "$OLD/disabled/$(basename "$f")" "$f" && echo "✓ $f"; fi
done < "$OLD/disabled/list.txt"

step "3. nginx: магазин на $DOMAIN"
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
if [ -f "$CERT" ] && [ -f "$KEY" ]; then
    SSL_OPTS=""
    [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && SSL_OPTS="    include /etc/letsencrypt/options-ssl-nginx.conf;"
    cat > "$NGINX_CONF" <<EOF
# Магазин Smart Centr (switch_to_shop_domain.sh $TS)
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
else
    cat > "$NGINX_CONF" <<EOF
# Магазин Smart Centr (switch_to_shop_domain.sh $TS) — HTTP; HTTPS добавит certbot
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
$PROXY
}
EOF
fi
ln -sf "$NGINX_CONF" "$NGINX_LINK"
if ! nginx -t; then restore_nginx; fail "nginx -t не прошёл — всё возвращено"; fi
systemctl reload nginx && echo "✓ nginx перезагружен"

if [ ! -f "$CERT" ]; then
    MY_IP=$(curl -s -m 10 https://api.ipify.org || true)
    DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
    if [ -z "$DNS_IP" ] || [ "$DNS_IP" != "$MY_IP" ]; then
        echo "⚠ DNS $DOMAIN → '${DNS_IP:-нет записи}', а этот сервер — $MY_IP. HTTPS пропущен."
        echo "  Добавьте A-запись shop → $MY_IP и запустите скрипт ещё раз."
    else
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --redirect --keep-until-expiring \
            || echo "⚠ HTTPS не получен. Магазин работает по HTTP."
        nginx -t || { restore_nginx; fail "после certbot nginx -t не прошёл — всё возвращено"; }
    fi
fi

step "4. Ссылки на заказ в WhatsApp → https://$DOMAIN"
if grep -q "^SHOP_SITE_BASE_URL=https://$DOMAIN$" "$ENVF"; then
    echo "• уже https://$DOMAIN — sbonus_api не трогаю"
else
    if grep -q '^SHOP_SITE_BASE_URL=' "$ENVF"; then
        sed -i "s|^SHOP_SITE_BASE_URL=.*|SHOP_SITE_BASE_URL=https://$DOMAIN|" "$ENVF"
    else
        printf 'SHOP_SITE_BASE_URL=https://%s\n' "$DOMAIN" >> "$ENVF"
    fi
    (cd $SBONUS && $API up -d --no-build --no-deps api) >/dev/null 2>&1
    OK=""
    for i in $(seq 1 40); do sleep 3; curl -s -m 5 http://127.0.0.1:18800/health | grep -q healthy && { OK=1; break; }; done
    if [ -n "$OK" ]; then
        echo "✓ sbonus_api перезапущен и healthy"
    else
        echo "❌ sbonus_api не healthy — возвращаю прежний .env.production"
        cp -a "$BACKUP/sbonus.env.production" "$ENVF"
        (cd $SBONUS && $API up -d --no-build --no-deps api)
        fail "SBonus возвращён в прежнее состояние — пришлите вывод в чат"
    fi
fi

step "5. Проверка"
echo "  smartcentr.store (прежняя страница) → HTTP $(code smartcentr.store http://smartcentr.store/)"
echo "  $DOMAIN (http)                     → HTTP $(code $DOMAIN http://$DOMAIN/ru)"
[ -f "$CERT" ] && echo "  $DOMAIN (https)                    → HTTP $(code $DOMAIN https://$DOMAIN/ru)"
curl -s -m 10 https://api.smartcentr.store/health; echo
docker ps --format '{{.Names}} | {{.Status}}' | grep -E 'smartcentr_site|sbonus_'

cat > "$BACKUP/undo.sh" <<EOF
#!/usr/bin/env bash
# Отменить switch_to_shop_domain.sh $TS
rm -rf /etc/nginx.undo && mv /etc/nginx /etc/nginx.undo && tar -xzf $BACKUP/nginx.tar.gz -C / && nginx -t && systemctl reload nginx
cp -a $BACKUP/sbonus.env.production $ENVF && cd $SBONUS && $API up -d --no-build --no-deps api
EOF
chmod 700 "$BACKUP/undo.sh"
echo
echo "=== ГОТОВО. Отмена: bash $BACKUP/undo.sh ==="
