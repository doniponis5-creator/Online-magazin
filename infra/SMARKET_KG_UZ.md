# smarket.kg — домен, DNS, сервер ва ҳимоя

Сана: 17.09.2026. Бу ҳужжат smarket.kg ишга туширилганда серверда ва Cloudflare да нима қилинганини қайд қилади.

## Қисқача

| Қисм | Ҳолат |
|---|---|
| Домен | smarket.kg, 17.09.2027 гача фаол |
| NS | `adele.ns.cloudflare.com`, `ben.ns.cloudflare.com` |
| DNS | `smarket.kg`, `www` → 145.223.100.16 (**Proxied**); `api` → 145.223.100.16 (**DNS only**, ҳозирча ишлатилмайди) |
| Cloudflare SSL | Full (strict) |
| Cloudflare ҳимоя | Bot Fight Mode — ёқилган |
| Сервер | VPS 145.223.100.16, Ubuntu 22.04, nginx 1.18 |
| Сайт | `smartcentr_site` Docker контейнери, `127.0.0.1:18820` |
| HTTPS | Let's Encrypt `smarket.kg` + `www.smarket.kg`, webroot, автоматик янгиланади |
| whitefitpro.com | Ўша контейнерга параллел ишлайди, ўзгартирилмади |

## Трафик йўли

```
Харидор → Cloudflare (HTTPS, Bot Fight Mode) → nginx :443 (smarket.kg.conf) → 127.0.0.1:18820 (smartcentr_site)
```

- `http://smarket.kg` ва `www.smarket.kg` → `https://smarket.kg` (301).
- nginx харидорнинг ҳақиқий IP сини `CF-Connecting-IP` дан олади; фақат Cloudflare IP диапазонларига ишонилади.

## Серверда қўшилган файллар

Бошқа лойиҳаларнинг файллари, портлари ва контейнерлари ўзгартирилмади.

| Файл | Нусха репода |
|---|---|
| `/etc/nginx/sites-available/smarket.kg.conf` (+ `sites-enabled` даги линк) | [nginx/smarket.kg.conf](nginx/smarket.kg.conf) |
| `/etc/nginx/snippets/cloudflare-realip.conf` — фақат smarket.kg ичида include | [nginx/cloudflare-realip.conf](nginx/cloudflare-realip.conf) |
| `/etc/letsencrypt/live/smarket.kg/` | — |
| Захира: `/root/smarket.kg.conf.bak-http`, `/root/smarket.kg.conf.bak-https` | — |

## Шу серверда ишлаётган бошқа лойиҳалар (тегилмайди)

| Домен | Йўл |
|---|---|
| api / admin / cabinet / pos .smartcentr.store (S Bonus) | nginx → 18800, 18811, 18812, 18803 |
| smartcentr.store | nginx → 3000 |
| whitefitpro.com | nginx → 18820 |
| kemalusman.kg | cloudflared tunnel → 8080, 8091 |
| IP (default) | prices.json, /upload → 5000 |

## Хавфсиз ўзгартириш тартиби

1. Ўзгартиришдан олдин файл захираси олинади.
2. `nginx -t` — хато бўлса, захирадан қайтарилади.
3. `systemctl reload nginx` (restart эмас).
4. smarket.kg ва бошқа барча доменлар текширилади.

## Очиқ масалалар

- Сервер IP си smartcentr.store орқали очиқ; тўлиқ DDoS ҳимояси учун бошқа доменлар ҳам Cloudflare га ўтгандан кейин 80/443 ни фақат Cloudflare IP лари учун очиш мумкин.
- Cloudflare IP рўйхати ўзгарса, `cloudflare-realip.conf` янгиланади.
- Кириш, код сўраш ва буюртма формаларига Turnstile қўшиш (сайт кодида).
- Тўлов callback, 1С ва мобил илова smarket.kg орқали уланганда Bot Fight Mode уларни тўсмаслигини текшириш.
- whitefitpro.com ни smarket.kg га 301 билан йўналтириш вақти.
