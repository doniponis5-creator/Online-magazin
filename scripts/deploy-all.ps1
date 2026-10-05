# ════════════════════════════════════════════════════════════════════════════
# Выкладка одной командой: сервер SBonus (робот WhatsApp/Instagram, заказы) и сайт.
# Делает те же шесть шагов, что раньше вводились по одному:
#   1–3. сервер: копирует integrations/sbonus-server/shop и запускает deploy_shop.sh
#        (бэкап базы, пробный импорт, откат сам, если API не поднялся);
#   4–6. сайт: собирает архив (deploy/site/pack.ps1) и запускает update_site.sh
#        (бэкап прежней версии, nginx не трогает).
# Шаг не прошёл — скрипт останавливается и дальше не идёт.
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-all.ps1
# Только сервер:  ... scripts\deploy-all.ps1 -Server
# Только сайт:    ... scripts\deploy-all.ps1 -Site
# Пароль сервера (если нет ключа SSH) спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
param(
    [switch]$Server,
    [switch]$Site
)
$ErrorActionPreference = 'Stop'
$Target = 'root@145.223.100.16'
# Ни одного ключа — значит, всё.
if (-not $Server -and -not $Site) { $Server = $true; $Site = $true }

Set-Location (Join-Path $PSScriptRoot '..')

function Step([string]$title) {
    Write-Host ''
    Write-Host "━━━ $title ━━━" -ForegroundColor Cyan
}

function Check([string]$what) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "❌ Не прошло: $what (код $LASTEXITCODE). Дальше не иду." -ForegroundColor Red
        Write-Host 'Пришлите этот экран в чат — разберёмся.' -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path 'integrations\sbonus-server\shop\deploy_shop.sh') -or -not (Test-Path 'deploy\site\pack.ps1')) {
    Write-Host 'Не та папка: нет integrations\sbonus-server\shop или deploy\site. Обновите проект из git.' -ForegroundColor Red
    exit 1
}

if ($Server) {
    Step '1/3 Сервер: убираю старую копию'
    ssh $Target 'rm -rf /tmp/sb_shop'
    Check 'очистка /tmp/sb_shop'

    Step '2/3 Сервер: копирую файлы'
    scp -q -r integrations/sbonus-server/shop "${Target}:/tmp/sb_shop"
    Check 'копирование на сервер'

    Step '3/3 Сервер: устанавливаю (бэкап, проверка, перезапуск)'
    ssh $Target 'bash /tmp/sb_shop/deploy_shop.sh'
    Check 'deploy_shop.sh'
    Write-Host '✅ Сервер обновлён' -ForegroundColor Green
}

if ($Site) {
    Step '1/3 Сайт: собираю архив'
    powershell -ExecutionPolicy Bypass -File deploy\site\pack.ps1
    Check 'pack.ps1'

    Step '2/3 Сайт: копирую архив'
    scp smartcentr-site.tar.gz deploy/site/update_site.sh "${Target}:/tmp/"
    Check 'копирование архива'

    Step '3/3 Сайт: обновляю (3–5 минут)'
    ssh $Target 'bash /tmp/update_site.sh'
    Check 'update_site.sh'
    Write-Host '✅ Сайт обновлён' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== ВСЁ ГОТОВО ===' -ForegroundColor Green
