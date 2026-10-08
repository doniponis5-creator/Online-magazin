# ════════════════════════════════════════════════════════════════════════════
# WhatsApp-переписка магазина за последние дни — чтобы научить консультанта говорить, как ваши продавцы.
#
# Берёт журнал Green API на сервере SBonus (входящие + исходящие; у исходящих видно, кто писал: робот
# или человек с телефона), собирает по чатам и кладёт в review\wa-dialogs\dialogs.json (в git не идёт).
# Номера чатов заменены на «чат 1, 2, …», цепочки из 6+ цифр в тексте — на «…». Голосовые — только пометка.
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-wa-dialogs.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-wa-dialogs.ps1 -Days 30
# Пароль сервера спрашивает ssh; скрипт его не видит и не сохраняет. Ключ Green API с сервера не уходит.
# ════════════════════════════════════════════════════════════════════════════
param([int]$Days = 14)

$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$Root = Split-Path $PSScriptRoot -Parent
$OutDir = Join-Path $Root 'review\wa-dialogs'

# Скрипт для сервера — только латиница (PowerShell 5.1 передаёт в ssh не-ASCII с ошибками).
$py = @"
import asyncio, base64, gzip, json, re
import httpx
from app.shop.shop_whatsapp import _url

MINUTES = $($Days * 1440)

async def journal(method):
    host, instance, token = _url()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(f"{host}/waInstance{instance}/{method}/{token}", params={"minutes": MINUTES})
    data = r.json() if r.status_code == 200 else []
    return data if isinstance(data, list) else []

def text_of(m):
    kind = m.get("typeMessage") or ""
    if kind == "textMessage":
        t = m.get("textMessage") or ""
    elif kind in ("extendedTextMessage", "quotedMessage"):
        t = (m.get("extendedTextMessage") or {}).get("text") or m.get("textMessage") or ""
    elif kind in ("imageMessage", "videoMessage", "documentMessage"):
        t = "[" + kind.replace("Message", "") + "] " + str(m.get("caption") or (m.get("fileMessageData") or {}).get("caption") or "")
    elif kind == "audioMessage":
        t = "[voice]"
    else:
        t = "[" + kind + "]"
    return re.sub(r"\+?\d[\d\s()+-]{5,}\d", lambda x: "..." if len(re.sub(r"\D", "", x.group())) >= 6 else x.group(), str(t))[:600]

async def main():
    inc = await journal("lastIncomingMessages")
    out = await journal("lastOutgoingMessages")
    rows = []
    for m in inc:
        rows.append((m.get("chatId"), m.get("timestamp") or 0, "customer", text_of(m), bool(str(m.get("senderContactName") or "").strip())))
    for m in out:
        rows.append((m.get("chatId"), m.get("timestamp") or 0, "bot" if m.get("sendByApi") else "seller", text_of(m), False))
    chats = {}
    for chat, ts, who, text, saved in rows:
        if not chat or not chat.endswith("@c.us"):
            continue
        c = chats.setdefault(chat, {"saved": False, "turns": []})
        c["saved"] = c["saved"] or saved
        c["turns"].append({"ts": ts, "who": who, "text": text})
    result = []
    for n, (chat, c) in enumerate(sorted(chats.items(), key=lambda kv: -max(t["ts"] for t in kv[1]["turns"])), 1):
        turns = sorted(c["turns"], key=lambda t: t["ts"])
        result.append({"chat": n, "savedContact": c["saved"], "turns": turns})
    blob = gzip.compress(json.dumps(result, ensure_ascii=False).encode("utf-8"))
    print("===DATA===" + base64.b64encode(blob).decode("ascii"))
    print("===INFO=== chats %d incoming %d outgoing %d" % (len(result), len(inc), len(out)))

asyncio.run(main())
"@

Write-Host "Забираю переписку WhatsApp за $Days дн. с сервера..." -ForegroundColor Cyan
$out = ($py | ssh $Server 'cd /opt/sbonus && docker exec -i sbonus_api python -') -join "`n"
$info = ([regex]::Match($out, '===INFO===(.*)')).Groups[1].Value.Trim()
$data = ([regex]::Match($out, '===DATA===([A-Za-z0-9+/=]+)')).Groups[1].Value
if (-not $data) {
    Write-Host 'Переписка не получена. Последние строки ответа сервера:' -ForegroundColor Red
    ($out -split "`n" | Select-Object -Last 8) | ForEach-Object { Write-Host "  $_" }
    exit 1
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
$gz = [Convert]::FromBase64String($data)
$ms = New-Object System.IO.MemoryStream(, $gz)
$zip = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
$reader = New-Object System.IO.StreamReader($zip, [System.Text.Encoding]::UTF8)
$json = $reader.ReadToEnd()
$reader.Close()
[System.IO.File]::WriteAllText((Join-Path $OutDir 'dialogs.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "✓ review\wa-dialogs\dialogs.json — $info" -ForegroundColor Green
Write-Host 'Готово. Напишите в чат «готово».'
