# ════════════════════════════════════════════════════════════════════════════
# Вход на сервер 145.223.100.16 без пароля (по SSH-ключу). Запускается ОДИН раз.
#
#  1. Создаёт ключ на этом компьютере (если его ещё нет) — %USERPROFILE%\.ssh\id_ed25519
#  2. Добавляет открытую часть ключа на сервер (последний раз спросит пароль сервера)
#  3. Проверяет, что вход работает без пароля
#
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\setup-ssh-key.ps1
# Закрытый ключ (id_ed25519) никому не пересылайте — он заменяет пароль.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$SshDir = Join-Path $env:USERPROFILE '.ssh'
$Key = Join-Path $SshDir 'id_ed25519'

if (-not (Test-Path $SshDir)) { New-Item -ItemType Directory -Path $SshDir | Out-Null }

if (-not (Test-Path $Key)) {
    Write-Host 'Создаю SSH-ключ...' -ForegroundColor Cyan
    ssh-keygen -t ed25519 -f $Key -N '""' -C "smartcentr-$env:COMPUTERNAME"
    if ($LASTEXITCODE -ne 0) {
        # В некоторых версиях PowerShell пустой пароль ключа передаётся иначе
        ssh-keygen -t ed25519 -f $Key -N '' -C "smartcentr-$env:COMPUTERNAME"
    }
} else {
    Write-Host "Ключ уже есть: $Key" -ForegroundColor Green
}

$PublicKey = (Get-Content "$Key.pub" -Raw).Trim()
if (-not $PublicKey) { throw 'Не удалось прочитать открытый ключ' }

Write-Host 'Добавляю ключ на сервер (последний раз введите пароль сервера)...' -ForegroundColor Cyan
$remote = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && grep -qF '$PublicKey' ~/.ssh/authorized_keys || echo '$PublicKey' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
ssh -o StrictHostKeyChecking=accept-new $Server $remote
if ($LASTEXITCODE -ne 0) { throw 'Не удалось добавить ключ на сервер' }

Write-Host 'Проверяю вход без пароля...' -ForegroundColor Cyan
$result = ssh -o BatchMode=yes -o ConnectTimeout=10 $Server 'echo OK'
if ($result -eq 'OK') {
    Write-Host 'Готово: ssh и scp к серверу теперь работают без пароля.' -ForegroundColor Green
} else {
    Write-Host 'Вход без пароля пока не работает — пришлите вывод в чат.' -ForegroundColor Red
    exit 1
}
