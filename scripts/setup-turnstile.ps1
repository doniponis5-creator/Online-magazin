# ════════════════════════════════════════════════════════════════════════════
# Проверка «Я не робот» (Cloudflare Turnstile) на сайте: вход по коду, вход через
# WhatsApp и заказ без входа. Скрипт кладёт два ключа Cloudflare на сервер сайта
# и перезапускает сайт.
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-turnstile.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-turnstile.ps1 -Off
#     (-Off — убрать ключи: проверка выключается, формы работают как раньше)
#
# Где взять ключи: dash.cloudflare.com → Turnstile → Add widget.
#   Widget name — smarket; Hostnames — smarket.kg и www.smarket.kg;
#   Widget Mode — Managed. После «Create» Cloudflare покажет Site Key и Secret Key.
# Site Key не секрет (его видит каждый посетитель сайта). Secret Key — секрет:
# скрипт спрашивает его без показа на экране и отправляет на сервер через stdin.
# Пароль сервера спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
param([switch]$Off)

$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$RemoteScript = Join-Path $PSScriptRoot 'turnstile-remote.sh'
$Nothing = 'Ничего не изменено.'

function Fail($text) {
    Write-Host $text -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $RemoteScript)) { Fail "Не найден $RemoteScript — обновите проект из git." }
Write-Host 'Проверка «Я не робот» (Cloudflare Turnstile) — настройка' -ForegroundColor Cyan

# Ключи Turnstile выглядят как 0x4AAAA…; тестовые ключи Cloudflare — 1x…, 2x…
$KeyPattern = '^[0-9]x[A-Za-z0-9_-]{16,}$'
$Payload = ''
if (-not $Off) {
    $Host.UI.RawUI.FlushInputBuffer()
    $site = (Read-Host 'Вставьте Site Key и нажмите Enter').Trim()
    if ($site -notmatch $KeyPattern) { Fail "Это не похоже на Site Key (он начинается с 0x4AAAA). $Nothing" }
    $secure = Read-Host 'Вставьте Secret Key и нажмите Enter (на экране он не появится)' -AsSecureString
    $secret = [System.Net.NetworkCredential]::new('', $secure).Password.Trim()
    if ($secret -notmatch $KeyPattern) { Fail "Это не похоже на Secret Key (он тоже начинается с 0x4AAAA). $Nothing" }
    if ($secret -eq $site) { Fail "Вставлен один и тот же ключ дважды: нужны два разных — Site Key и Secret Key. $Nothing" }
    $Payload = "$site`n$secret`n"
    $secret = $null
}

# Серверную часть кладём отдельным файлом. Windows-переводы строк bash
# не понимает, поэтому убираем CR. Секретов в этом файле нет — ключи идут в stdin.
$tmp = [System.IO.Path]::GetTempFileName()
$body = [System.IO.File]::ReadAllText($RemoteScript) -replace "`r", ''
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Отправляю на сервер и перезапускаю сайт (около минуты)...' -ForegroundColor Cyan
scp -q $tmp "${Server}:/tmp/turnstile_setup.sh"
$scpCode = $LASTEXITCODE
Remove-Item $tmp -Force
if ($scpCode -ne 0) { Fail "Не удалось подключиться к серверу. $Nothing" }
$mode = if ($Off) { 'off' } else { 'on' }
$text = ($Payload | ssh $Server "bash /tmp/turnstile_setup.sh $mode; rm -f /tmp/turnstile_setup.sh" | Out-String)
$Payload = $null

if ($text -match 'NOENV') { Fail "На сервере нет /opt/smartcentr-site/.env.production — сайт ещё не установлен. $Nothing" }
if ($text -match 'BADKEY') { Fail "Сервер не принял ключи — проверьте, что скопированы целиком. $Nothing" }
if ($text -match 'NOBAK') { Fail "Сервер не смог сделать резервную копию настроек. $Nothing" }
if ($text -match 'NOUP') { Fail 'Настройки записаны, но сайт не поднялся за минуту. Напишите в чат — разберёмся.' }
if ($text -match 'TSOFF') {
    Write-Host 'Готово: проверка «Я не робот» выключена, формы работают как раньше.' -ForegroundColor Green
    exit 0
}
if ($text -notmatch 'TSON') {
    if (-not $text.Trim()) { Fail "Сервер не ответил (связь оборвалась или не тот пароль). $Nothing" }
    Fail "Непонятный ответ сервера: $text"
}
Write-Host 'Готово: ключи на сервере, сайт перезапущен. Secret Key нигде не показывался.' -ForegroundColor Green
Write-Host 'Откройте smarket.kg → «Кабинет»: над кнопкой «Получить код» появится проверка «Я не робот».'
Write-Host 'Если что-то мешает войти — выключить: powershell -ExecutionPolicy Bypass -File scripts\setup-turnstile.ps1 -Off'
