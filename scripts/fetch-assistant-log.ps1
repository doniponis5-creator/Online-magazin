# ════════════════════════════════════════════════════════════════════════════
# Журнал консультанта с сервера сайта — для разбора ответов бота (WhatsApp, Instagram, сайт, Telegram).
#
#  1) ASSISTANT_LOG_KEY (ключ страницы /panel/questions) — с сервера в .env.local. Значение не показывается.
#  2) Журналы вопросов и ответов (assistant-ГГГГ-ММ.jsonl из контейнера smartcentr_site) →
#     review\assistant-log\ (в git не идёт). Телефоны и номера в журнале уже спрятаны («…»).
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-assistant-log.ps1
# Пароль сервера спрашивает ssh; скрипт его не видит и не сохраняет.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root '.env.local'
$OutDir = Join-Path $Root 'review\assistant-log'

Write-Host 'Получаю ключ и журнал с сервера...' -ForegroundColor Cyan
# Одним подключением: строка ключа, разделитель, журналы архивом в base64 (одни латинские буквы —
# PowerShell не испортит кириллицу при чтении вывода ssh).
$remote = "grep '^ASSISTANT_LOG_KEY=' /opt/smartcentr-site/.env.production; echo ===LOG===; " +
          "docker exec smartcentr_site sh -c 'cd /app/data && tar -czf - assistant-*.jsonl 2>/dev/null' | base64 -w0"
$out = ssh $Server $remote
$text = ($out -join "`n")
$parts = $text -split '===LOG===', 2

$key = (($parts[0] -split "`n") | Where-Object { $_ -match '^ASSISTANT_LOG_KEY=' } | Select-Object -First 1)
$key = ("$key" -replace '^ASSISTANT_LOG_KEY=', '').Trim().Trim('"').Trim("'")
if ($key) {
    if (-not (Test-Path $EnvFile)) { Copy-Item (Join-Path $Root '.env.example') $EnvFile }
    $content = Get-Content $EnvFile -Raw -Encoding UTF8
    if ($content -match '(?m)^ASSISTANT_LOG_KEY=.*$') {
        $content = [regex]::Replace($content, '(?m)^ASSISTANT_LOG_KEY=.*$', "ASSISTANT_LOG_KEY=$key")
    } else {
        $content = $content.TrimEnd() + "`r`nASSISTANT_LOG_KEY=$key`r`n"
    }
    [System.IO.File]::WriteAllText($EnvFile, $content, (New-Object System.Text.UTF8Encoding $false))
    $key = $null
    Write-Host '✓ ключ панели записан в .env.local (значение не показывается)' -ForegroundColor Green
} else {
    Write-Host '• На сервере нет ASSISTANT_LOG_KEY — страница /panel/questions выключена. Журнал всё равно скачиваю.' -ForegroundColor Yellow
}

$b64 = ("$($parts[1])" -replace '\s', '')
if (-not $b64) {
    Write-Host 'Журнал не получен (контейнер smartcentr_site не запущен или журналов нет).' -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
$archive = Join-Path $OutDir 'assistant-log.tar.gz'
[System.IO.File]::WriteAllBytes($archive, [Convert]::FromBase64String($b64))
tar -xzf $archive -C $OutDir
Remove-Item $archive
Get-ChildItem $OutDir -Filter 'assistant-*.jsonl' | ForEach-Object {
    $lines = (Get-Content $_.FullName -Encoding UTF8 | Measure-Object -Line).Lines
    Write-Host ("✓ {0}: записей {1}" -f $_.Name, $lines) -ForegroundColor Green
}
Write-Host 'Готово. Напишите в чат «готово».'
