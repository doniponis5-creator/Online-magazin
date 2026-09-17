#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Поставить магазин на домен (временно или насовсем). Контейнер сайта не трогается.
#
#   bash set_shop_domain.sh whitefitpro.com www.whitefitpro.com
#   bash set_shop_domain.sh shop.smartcentr.store
#
#  1. Бэкап /etc/nginx и /opt/sbonus/.env.production.
#  2. Чужие включённые конфиги nginx с этими доменами — выключаются (копия в бэкапе).
#  3. smartcentr-shop.conf → эти домены; nginx -t, иначе возврат.
#  4. HTTPS: certbot (если DNS доменов указывает на этот сервер).
#  5. SHOP_SITE_BASE_URL → https://<первый домен>; пересоздаётся только sbonus_api, иначе возврат.
#  Отмена: bash <папка бэкапа>/undo.sh
# ════════════════════════════════════════════════════════════════════════════
set -u
[ $# -ge 1 ] || { echo "Использование: bash set_shop_domain.sh домен [ещё домены]"; exit 1; }
DOMAIN=$1
NAMES="$*"
PORT=18820
TS=$(date +%Y%m%d_%H%M%S)
BACKUP=/opt/smartcentr-site-backups/domain_$TS
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

step "0. Проверки (домены: $NAMES)"
curl -fs -m 5 -o /dev/null http://127.0.0.1:$PORT/ru || fail "Контейнер сайта не отвечает на $PORT"
curl -s -m 10 http://127.0.0.1:18800/health | grep -q healthy || fail "sbonus_api не healthy — ничего не меняю"
echo "✓ всё на месте"

step "1. Бэкап"
mkdir -p "$BACKUP/disabled"
tar -czf "$BACKUP/nginx.tar.gz" -C / etc/nginx && echo "✓ nginx → $BACKUP/nginx.tar.gz"
cp -a "$ENVF" "$BACKUP/sbonus.env.production" && chmod 600 "$BACKUP/sbonus.env.production" && echo "✓ .env.production SBonus"

step "2. Выключаю чужие конфиги с этими доменами"
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    [ "$(basename "$f")" = smartcentr-shop.conf ] && continue
    for n in $NAMES; do
        if grep -qE "server_name[^;]*[[:space:]]${n//./\\.}([[:space:]]|;)" "$f"; then
            mv "$f" "$BACKUP/disabled/" && echo "$f" >> "$BACKUP/disabled/list.txt" && echo "✓ выключен $f (копия в бэкапе)"
            break
        fi
    done
done
[ -f "$BACKUP/disabled/list.txt" ] || echo "• чужих конфигов нет"

step "3. nginx: магазин на $NAMES"
cat > "$NGINX_CONF" <<EOF
# Магазин Smart Centr (set_shop_domain.sh $TS) — HTTPS добавляет certbot
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    client_max_body_size 5m;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location /_next/static/ {
        proxy_pass http://127.0.0.1:$PORT;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf "$NGINX_CONF" "$NGINX_LINK"
if ! nginx -t; then restore_nginx; fail "nginx -t не прошёл — всё возвращено"; fi
systemctl reload nginx && echo "✓ nginx перезагружен"

step "4. HTTPS"
MY_IP=$(curl -s -m 10 https://api.ipify.org || true)
CERT_ARGS=""
for n in $NAMES; do
    DNS_IP=$(getent ahostsv4 "$n" | awk 'NR==1{print $1}')
    if [ "$DNS_IP" = "$MY_IP" ]; then CERT_ARGS="$CERT_ARGS -d $n"; else echo "⚠ $n → '${DNS_IP:-нет записи}', сервер $MY_IP — без HTTPS"; fi
done
if [ -n "$CERT_ARGS" ]; then
    certbot --nginx --cert-name "$DOMAIN" $CERT_ARGS --non-interactive --agree-tos --redirect --keep-until-expiring \
        || echo "⚠ HTTPS не получен. Магазин работает по HTTP."
    nginx -t || { restore_nginx; fail "после certbot nginx -t не прошёл — всё возвращено"; }
    systemctl reload nginx
fi

step "5. Ссылки на заказ в WhatsApp → https://$DOMAIN"
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

step "6. Проверка"
for n in $NAMES; do
    echo "  http://$n/ru  → HTTP $(code $n http://$n/ru)"
    echo "  https://$n/ru → HTTP $(code $n https://$n/ru)"
done
curl -s -m 10 https://api.smartcentr.store/health; echo
docker ps --format '{{.Names}} | {{.Status}}' | grep -E 'smartcentr_site|sbonus_'

cat > "$BACKUP/undo.sh" <<EOF
#!/usr/bin/env bash
# Отменить set_shop_domain.sh $TS
rm -rf /etc/nginx.undo && mv /etc/nginx /etc/nginx.undo && tar -xzf $BACKUP/nginx.tar.gz -C / && nginx -t && systemctl reload nginx
cp -a $BACKUP/sbonus.env.production $ENVF && cd $SBONUS && $API up -d --no-build --no-deps api
EOF
chmod 700 "$BACKUP/undo.sh"
echo
echo "=== ГОТОВО: магазин на https://$DOMAIN. Отмена: bash $BACKUP/undo.sh ==="
