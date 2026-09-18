# ════════════════════════════════════════════════════════════════════════════
# Ключ Apple для push-уведомлений: записывает его на сервер SBonus, чтобы
# приложение на iPhone получало «Заказ оплачен» и «Заказ готов».
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-apns.ps1
#
# Что нужно приготовить (developer.apple.com → Certificates, Identifiers &
# Profiles → Keys → «+» → отметить Apple Push Notifications service):
#   • файл AuthKey_XXXXXXXXXX.p8  — скачивается один раз, храните его
#   • Key ID   — 10 знаков, показан рядом с ключом
#   • Team ID  — 10 знаков, справа вверху в кабинете разработчика
#
# Содержимое ключа скрипт читает из файла и никому не показывает: на экран
# оно не выводится, в историю команд не попадает, здесь не сохраняется.
# Пароль сервера спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$RemoteScript = Join-Path $PSScriptRoot 'apns-remote.sh'

if (-not (Test-Path $RemoteScript)) {
    Write-Host "Не найден $RemoteScript — обновите проект из git." -ForegroundColor Red
    exit 1
}

Write-Host 'Apple push — настройка ключа' -ForegroundColor Cyan
Write-Host 'Перетащите сюда файл AuthKey_XXXXXXXXXX.p8 (или вставьте путь к нему) и нажмите Enter.'
$Host.UI.RawUI.FlushInputBuffer()
$KeyPath = (Read-Host 'Файл .p8').Trim().Trim('"')

if (-not (Test-Path $KeyPath)) {
    Write-Host "Файл не найден: $KeyPath" -ForegroundColor Red
    exit 1
}
$Pem = [System.IO.File]::ReadAllText($KeyPath)
if ($Pem -notmatch 'BEGIN PRIVATE KEY') {
    Write-Host 'Это не похоже на ключ Apple (.p8). Проверьте файл.' -ForegroundColor Red
    exit 1
}

Write-Host ''
$Host.UI.RawUI.FlushInputBuffer()
$KeyId = (Read-Host 'Key ID (10 знаков, рядом с ключом)').Trim()
$TeamId = (Read-Host 'Team ID (10 знаков, справа вверху)').Trim()
if ($KeyId.Length -ne 10 -or $TeamId.Length -ne 10) {
    Write-Host 'Key ID и Team ID должны быть ровно по 10 знаков. Запустите скрипт заново.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Приложение уже в App Store? Если нет (проверяем сборку с Mac) — нажмите Enter.'
$Host.UI.RawUI.FlushInputBuffer()
$Prod = if ((Read-Host 'В App Store? да/нет').Trim().ToLower() -like 'д*') { '1' } else { '0' }

# Ключ передаём в base64: так переносы строк не портятся по дороге.
$KeyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Pem))

# Серверную часть кладём отдельным файлом. Windows-переводы строк bash
# не понимает, поэтому убираем CR. Секретов в этом файле нет — ключ идёт в stdin.
$tmp = [System.IO.Path]::GetTempFileName()
$body = [System.IO.File]::ReadAllText($RemoteScript) -replace "`r", ''
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Записываю ключ на сервер...' -ForegroundColor Cyan
scp -q $tmp "${Server}:/tmp/apns_setup.sh"
Remove-Item $tmp -Force
$text = ("$KeyB64`n$KeyId`n$TeamId`n$Prod" | ssh $Server 'bash /tmp/apns_setup.sh; rm -f /tmp/apns_setup.sh' | Out-String)
$Pem = $null
$KeyB64 = $null

if ($text -match 'NOENV') {
    Write-Host 'На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh.' -ForegroundColor Red
    exit 1
}
if ($text -match 'BADKEY') {
    Write-Host 'Сервер не смог прочитать ключ. Ничего не записано.' -ForegroundColor Red
    exit 1
}
if ($text -match 'BADID') {
    Write-Host 'Key ID не подошёл — должно быть ровно 10 знаков. Ничего не записано.' -ForegroundColor Red
    exit 1
}
if ($text -match 'BADTEAM') {
    Write-Host 'Team ID не подошёл — должно быть ровно 10 знаков. Ничего не записано.' -ForegroundColor Red
    exit 1
}
if ($text -notmatch 'KEYOK') {
    Write-Host "Непонятный ответ сервера: $text" -ForegroundColor Red
    exit 1
}

Write-Host 'Готово: ключ Apple записан на сервер.' -ForegroundColor Green
Write-Host 'Значение нигде не показывалось и на этом компьютере не сохранено.'
Write-Host 'Сам файл .p8 сохраните у себя — Apple его второй раз не выдаёт.'
Write-Host 'Напишите в чат «готово» — я перезапущу сервер и проверю отправку.'
