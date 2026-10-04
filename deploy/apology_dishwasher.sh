#!/usr/bin/env bash
# Извинение покупателям, которым бот 04.10 сказал «посудомоечных нет / калбай калган»,
# хотя они были (ошибка поиска, исправлена в 035db10 и 3509864).
#
# Что делает: ищет в разговорах WhatsApp (Redis wa:week:*) и Instagram (ig:turns:*) ответ бота
# «посудомойки нет» и шлёт этим людям извинение с настоящими ценами из каталога 1С на сервере.
#   • без --send — только показывает, кому и что уйдёт (ничего не шлёт);
#   • с --send   — отправляет. Второй раз тому же человеку не шлёт (Redis apology:dish:*).
# Пропускает: тех, кому бот или сотрудник уже потом назвал посудомойку с ценой; сохранённые
# контакты WhatsApp; Instagram, где покупатель писал больше 23 часов назад — Meta не даёт писать
# первыми после 24 часов (таких скрипт покажет, им может ответить только сотрудник, если человек напишет).
#
# Запуск на сервере (сначала выложить сайт с исправлением — иначе на «фото жибериңиз» старый бот
# снова скажет «нет»):
#   bash /tmp/apology_dishwasher.sh          ← посмотреть
#   bash /tmp/apology_dishwasher.sh --send   ← отправить
#   bash /tmp/apology_dishwasher.sh --shown  ← тем, кому уже отправили, запомнить показанную модель
#                                              (на «ооба, жибериңиз» робот пришлёт её фото)
set -euo pipefail

MODE="${1:-}"

docker exec -i -e MODE="$MODE" sbonus_api python3 - <<'PY'
import asyncio, json, os, re, time

from app.core.redis import redis_client

SEND = os.environ.get("MODE") == "--send"
SHOWN_ONLY = os.environ.get("MODE") == "--shown"
# Ответ бота «посудомойки нет»: про посудомойку и «нет» в одном сообщении.
ABOUT = re.compile(r"посуд|идиш|idish", re.I)
NONE = re.compile(r"\bнет\b|жок|калбай|калган|йук|йўқ|yo.?q|закончил", re.I)
# Потом посудомойку назвали с ценой — уже исправлено, не трогаем.
FIXED = re.compile(r"(midea|velberg|посудомоечн|идиш жуугуч|идиш ювиш)[^\n]{0,80}\d[\d\s]{2,}\s*сом", re.I)


def lang_of(text: str) -> str:
    if re.search(r"[ңөү]|\b(жок|азыр|калган|бар|сизге)\b", text, re.I):
        return "ky"
    if re.search(r"[ўқғҳ]|\b(йук|хозир|бор|сизга)\b", text, re.I):
        return "uz"
    return "ru"


def som(n: int) -> str:
    return f"{int(n):,}".replace(",", " ") + " сом"


def apology(lang: str, small: dict, low: int, high: int) -> str:
    name, price = small["name"], som(small["price"])
    more = low and high and high > small["price"]
    if lang == "ky":
        rest = f", чоңураактары {som(low)} – {som(high)}" if more else ""
        return (f"Ассаламу алейкум! Кечиресиз, мурун туура эмес маалымат берип алдык — идиш жуугуч машиналар бар. "
                f"Эң кичинекейи (стол үстүнө коюлат): {name} — {price}{rest}. Сүрөтүн жиберейинби?")
    if lang == "uz":
        rest = f", каттароқлари {som(low)} – {som(high)}" if more else ""
        return (f"Ассаламу алейкум! Кечирасиз, аввал нотўғри маълумот бериб қўйибмиз — идиш ювиш машиналари бор. "
                f"Энг кичиги (стол устига қўйилади): {name} — {price}{rest}. Расмини юборайми?")
    rest = f", побольше — от {som(low)} до {som(high)}" if more else ""
    return (f"Здравствуйте! Извините, мы ошиблись — посудомоечные машины есть. "
            f"Самая компактная (ставится на стол): {name} — {price}{rest}. Прислать фото?")


async def dishwashers() -> list[dict]:
    from app.core.database import async_session
    from app.shop.shop_router import catalog_items
    from app.shop import shop_promo_rules as promo
    async with async_session() as db:
        items = await catalog_items(db)
    found = [
        {"name": promo.clean_text(i.get("name")).replace("Посудомоечная машина ", ""), "price": promo.price(i),
         "id": promo.slug_from_code(i.get("code") or "")}
        for i in items
        if str(i.get("name") or "").lower().startswith("посудомоечн") and promo.sellable(i)
    ]
    return sorted(found, key=lambda x: x["price"])


async def remember_shown(channel: str, who: str, product_id: str) -> None:
    """Названную в извинении модель — в «показанные»: на «да, пришлите фото» робот знает, какую."""
    key = f"{'wa' if channel == 'whatsapp' else 'ig'}:shown:{who}"
    if product_id:
        await redis_client.set(key, json.dumps([product_id]), ex=3 * 24 * 3600)


async def main() -> None:
    from app.shop import shop_ig_rules as ig_rules
    items = await dishwashers()
    if not items:
        print("В каталоге сейчас нет посудомоечных в наличии — извиняться не за что, ничего не шлю.")
        return
    small, low, high = items[0], (items[1]["price"] if len(items) > 1 else 0), items[-1]["price"]
    print(f"Посудомоечные в наличии: {len(items)}, от {som(small['price'])} до {som(high)}\n")

    todo = []
    for pattern, channel in (("wa:week:*", "whatsapp"), ("ig:turns:*", "instagram")):
        async for key in redis_client.scan_iter(match=pattern, count=500):
            who = key.split(":", 2)[2]
            try:
                turns = json.loads(await redis_client.get(key) or "[]")
            except Exception:
                continue
            wrong = [i for i, t in enumerate(turns) if t.get("role") == "assistant"
                     and ABOUT.search(t.get("text") or "") and NONE.search(t.get("text") or "")]
            if not wrong:
                continue
            after = " ".join(t.get("text") or "" for t in turns[wrong[-1] + 1:] if t.get("role") == "assistant")
            if FIXED.search(after):
                continue
            todo.append((channel, who, turns[wrong[-1]]["text"]))

    if SHOWN_ONLY:
        done = 0
        for channel, who, _said in todo:
            if await redis_client.get(f"apology:dish:{channel}:{who}"):
                await remember_shown(channel, who, small["id"])
                done += 1
        print(f"Запомнил модель {small['name']} у {done} покупателей — на «фото жибериңиз» робот пришлёт её.")
        return

    sent = skipped = 0
    for channel, who, said in todo:
        tail = who[-4:]
        text = apology(lang_of(said), small, low, high)
        note = ""
        if await redis_client.get(f"apology:dish:{channel}:{who}"):
            note = "уже извинялись — пропускаю"
        elif channel == "whatsapp" and await redis_client.get(f"wa:saved:{who}"):
            note = "сохранённый контакт — пропускаю"
        elif channel == "instagram" and not ig_rules.window_open(float(await redis_client.get(f"ig:lastin:{who}") or 0), time.time()):
            note = "Instagram: писал больше 23 ч назад — Meta не даёт написать первыми"
        print(f"── {channel} …{tail}\n   бот сказал: {said[:160]!r}\n   уйдёт:      {text}" + (f"\n   ⏭ {note}" if note else ""))
        if note:
            skipped += 1
            continue
        if not SEND:
            continue
        try:
            if channel == "whatsapp":
                from app.shop.shop_wa_bot import _remember, _send_text
                await _send_text(who, text)
                await _remember(who, "assistant", text)
            else:
                from app.shop.shop_ig_bot import _load_token, _remember, _send_text
                await _load_token()
                await _send_text(who, text)
                await _remember(who, "assistant", text)
            await redis_client.set(f"apology:dish:{channel}:{who}", "1", ex=30 * 24 * 3600)
            await remember_shown(channel, who, small["id"])
            sent += 1
            print("   ✅ отправлено")
        except Exception as error:
            print(f"   ❌ не отправлено: {type(error).__name__}: {str(error)[:150]}")
    print(f"\nНайдено: {len(todo)}, пропущено: {skipped}" + (f", отправлено: {sent}" if SEND else
          ". Ничего не отправлено — это просмотр. Отправить: bash /tmp/apology_dishwasher.sh --send"))


async def run() -> None:
    try:
        await main()
    finally:
        try:
            from app.shop.shop_wa_bot import _close_redis
            await _close_redis()
        except Exception:
            pass


asyncio.run(run())
PY
