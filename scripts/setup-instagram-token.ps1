# ════════════════════════════════════════════════════════════════════════════
# Instagram: записывает новый ключ (IG_ACCESS_TOKEN) на сервер SBonus.
# Нужен, когда в кабинете Meta включили новое право (например, публикацию постов)
# и создали новый ключ — или когда робот пишет «Instagram 401» / «ключ устарел».
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-instagram-token.ps1
#
# Ключ берётся в кабинете Meta: «Instagram» → «Настройка API со входом через Instagram»
# → «Создать маркер». Скрипт спрашивает его скрытым вводом: он не показывается на экране,
# не попадает в историю команд и не сохраняется на этом компьютере.
# Пароль сервера спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$RemoteScript = Join-Path $PSScriptRoot 'instagram-token-remote.sh'

if (-not (Test-Path $RemoteScript)) {
    Write-Host "Не найден $RemoteScript — обновите проект из git." -ForegroundColor Red
    exit 1
}

Write-Host 'Instagram — новый ключ (IG_ACCESS_TOKEN)' -ForegroundColor Cyan
Write-Host 'Вставьте ключ из кабинета Meta («Создать маркер»). На экране его не видно — это нормально.'
Write-Host 'Вставьте ТОЛЬКО ключ, одной строкой, и нажмите Enter.'
# Если в терминале остался вставленный ранее текст, он попал бы в поле ключа
$Host.UI.RawUI.FlushInputBuffer()
$secure = Read-Host 'Ключ' -AsSecureString
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

$token = $token.Trim()
if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 50) {
    Write-Host 'Ключ слишком короткий — похоже, скопировался не полностью. Запустите скрипт заново.' -ForegroundColor Red
    exit 1
}
# Пробелы, путь к файлу или слово PS означают, что вставился не ключ, а кусок вывода терминала.
if ($token -match '\s' -or $token -match '\.ps1' -or $token -match '^PS ' -or $token -match '^[A-Za-z]:') {
    Write-Host 'Это не похоже на ключ — похоже, в поле попал текст из терминала.' -ForegroundColor Red
    Write-Host 'Очистите экран командой  cls  и запустите скрипт заново, вставив только ключ.'
    exit 1
}

# Серверную часть кладём отдельным файлом без Windows-переводов строк. Секретов в нём нет —
# ключ идёт через stdin.
$tmp = [System.IO.Path]::GetTempFileName()
$body = [System.IO.File]::ReadAllText($RemoteScript) -replace "`r", ''
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Проверяю ключ в Instagram и записываю его на сервер...' -ForegroundColor Cyan
scp -q $tmp "${Server}:/tmp/ig_token_setup.sh"
Remove-Item $tmp -Force
$text = ($token | ssh $Server 'bash /tmp/ig_token_setup.sh; rm -f /tmp/ig_token_setup.sh' | Out-String)
$token = $null
$secure = $null

if ($text -match 'NOENV') {
    Write-Host 'На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh.' -ForegroundColor Red
    exit 1
}
if ($text -match 'BADTOKEN') {
    Write-Host 'Instagram не принял этот ключ. Ничего не записано, старый ключ работает как раньше.' -ForegroundColor Red
    Write-Host 'Создайте ключ ещё раз в кабинете Meta и запустите скрипт заново.'
    exit 1
}
if ($text -match 'NOANSWER') {
    Write-Host 'Instagram не ответил. Ничего не записано, попробуйте через минуту.' -ForegroundColor Red
    exit 1
}
if ($text -match 'NORESTART') {
    Write-Host 'Ключ записан, но сервер не перезапустился. Перезапустите его этой командой:' -ForegroundColor Yellow
    Write-Host '  ssh root@145.223.100.16 "cd /opt/sbonus && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate api"'
    exit 1
}
if ($text -match 'IGOK\s+(\S+)') {
    Write-Host "Готово: Instagram принял ключ (аккаунт @$($Matches[1])), ключ записан, сервер перезапущен." -ForegroundColor Green
    Write-Host 'Значение нигде не показывалось и на этом компьютере не сохранено. Старая копия .env — рядом, с датой.'
    exit 0
}
Write-Host "Непонятный ответ сервера: $text" -ForegroundColor Red
exit 1
