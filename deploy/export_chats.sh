#!/usr/bin/env bash
# Выгрузка переписок онлайн-консультанта — для разбора качества ответов.
#
# Что берётся:
#   • WhatsApp — копии разговоров за неделю (Redis wa:week:*, до 12 реплик в каждом);
#   • Instagram — разговоры за 3 дня (Redis ig:turns:*);
#   • сайт и Telegram — журнал вопросов (smartcentr_site:/app/data/assistant-*.jsonl).
# Номеров телефонов в выгрузке нет: ключи Redis не берём, цепочки из 6+ цифр в тексте — «…».
#
# Запуск на сервере:  bash /tmp/export_chats.sh   → /tmp/chats_export.tar.gz
set -euo pipefail

OUT=/tmp/chats_export
rm -rf "$OUT" /tmp/chats_export.tar.gz
mkdir -p "$OUT"

docker exec -i sbonus_api python3 - > "$OUT/messengers.json" <<'PY'
import asyncio, json, re
from app.core.redis import redis_client

DIGITS = re.compile(r"\+?\d[\d\s()+-]{5,}\d")


def hide(text) -> str:
    return DIGITS.sub(lambda m: "…" if len(re.sub(r"\D", "", m.group())) >= 6 else m.group(), str(text or ""))


async def main() -> None:
    out = []
    for pattern, channel in (("wa:week:*", "whatsapp"), ("ig:turns:*", "instagram")):
        async for key in redis_client.scan_iter(match=pattern, count=500):
            try:
                turns = json.loads(await redis_client.get(key) or "[]")
            except Exception:
                continue
            out.append({"ch": channel, "turns": [{"role": t.get("role"), "text": hide(t.get("text"))} for t in turns]})
    print(json.dumps(out, ensure_ascii=False))


asyncio.run(main())
PY

docker exec smartcentr_site sh -c 'cat /app/data/assistant-*.jsonl 2>/dev/null' > "$OUT/site.jsonl" || true

tar -czf /tmp/chats_export.tar.gz -C /tmp chats_export
rm -rf "$OUT"
echo "Готово: /tmp/chats_export.tar.gz ($(du -h /tmp/chats_export.tar.gz | cut -f1))"
