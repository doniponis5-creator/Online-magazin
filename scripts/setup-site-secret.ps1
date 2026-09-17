# ════════════════════════════════════════════════════════════════════════════
# Настройка секрета сайта: берёт SHOP_SITE_SECRET с сервера SBonus и записывает
# его в .env.local как SHOP_API_SECRET. Значение секрета нигде не показывается.
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-site-secret.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-site-secret.ps1 -Rotate
#
# -Rotate — сначала создать НОВЫЙ секрет на сервере (если старый где-то засветился)
#           и перезапустить только API (около 15 секунд).
# Пароль сервера спрашивает ssh; скрипт его не видит и не сохраняет.
# ════════════════════════════════════════════════════════════════════════════
param([switch]$Rotate)

$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$EnvFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.local'

if ($Rotate) {
    Write-Host 'Создаю новый секрет на сервере и перезапускаю API...' -ForegroundColor Cyan
    $remote = 'sed -i "s/^SHOP_SITE_SECRET=.*/SHOP_SITE_SECRET=$(openssl rand -hex 32)/" /opt/sbonus/.env.production && cd /opt/sbonus && docker compose -f docker-compose.prod.yml up -d api >/dev/null 2>&1 && sleep 12 && curl -s https://api.smartcentr.store/health'
    $health = ssh $Server $remote
    if ($health -notmatch 'healthy') {
        Write-Host "API не ответил healthy: $health" -ForegroundColor Red
        exit 1
    }
    Write-Host 'Новый секрет создан, API работает.' -ForegroundColor Green
}

Write-Host 'Получаю секрет с сервера...' -ForegroundColor Cyan
$line = ssh $Server 'grep ^SHOP_SITE_SECRET= /opt/sbonus/.env.production'
$secret = ($line -replace '^SHOP_SITE_SECRET=', '').Trim()
if ($secret -notmatch '^[0-9a-f]{32,}$') {
    Write-Host 'На сервере не найден SHOP_SITE_SECRET. Сначала запустите deploy_shop.sh.' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path (Split-Path $EnvFile -Parent) '.env.example') $EnvFile
}
$content = Get-Content $EnvFile -Raw -Encoding UTF8
if ($content -match '(?m)^SHOP_API_SECRET=.*$') {
    $content = [regex]::Replace($content, '(?m)^SHOP_API_SECRET=.*$', "SHOP_API_SECRET=$secret")
} else {
    $content = $content.TrimEnd() + "`r`nSHOP_API_SECRET=$secret`r`n"
}
[System.IO.File]::WriteAllText($EnvFile, $content, (New-Object System.Text.UTF8Encoding $false))
$secret = $null

Write-Host "Готово: секрет записан в $EnvFile (значение не показывается)." -ForegroundColor Green
Write-Host 'Напишите в чат «готово» — сайт будет перезапущен с новыми настройками.'
