# ════════════════════════════════════════════════════════════════════════════
# Telegram Gateway: записывает токен на сервер SBonus, чтобы коды входа шли
# в Telegram (0,01 $ за код), а в WhatsApp — только тем, у кого Telegram нет.
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-telegram-gateway.ps1
#
# Токен берётся на gateway.telegram.org → Account → API token.
# Скрипт спрашивает токен скрытым вводом: он не показывается на экране,
# не попадает в историю команд и не сохраняется на этом компьютере.
# Пароль сервера спрашивает ssh; скрипт его не видит.
# ════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'

Write-Host 'Telegram Gateway — настройка токена' -ForegroundColor Cyan
Write-Host 'Токен со страницы gateway.telegram.org (вводится скрыто, на экране не видно).'
$secure = Read-Host 'Токен' -AsSecureString
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 20) {
    Write-Host 'Токен слишком короткий — похоже, скопировался не полностью. Запустите скрипт заново.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Канал-отправитель — необязательно. Это проверенный Telegram-канал магазина,'
Write-Host 'от имени которого придёт код. Нет такого — просто нажмите Enter.'
$sender = (Read-Host 'Username канала без @ (можно пропустить)').Trim().TrimStart('@')

# Токен и канал уходят на сервер через stdin: в списке процессов их не видно.
# Сначала проверяем токен у Telegram и только потом записываем в .env.production.
$remote = @'
set -u
ENV=/opt/sbonus/.env.production
read -r TOKEN
read -r SENDER || SENDER=""
[ -f "$ENV" ] || { echo NOENV; exit 1; }
CHECK=$(curl -s -m 20 -X POST https://gatewayapi.telegram.org/checkSendAbility -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"phone_number\":\"+999999999999\"}")
case "$CHECK" in
    *ACCESS_TOKEN_INVALID*|*ACCESS_TOKEN_REQUIRED*) echo BADTOKEN; exit 1 ;;
    "") echo NOANSWER; exit 1 ;;
esac
cp "$ENV" "$ENV.bak_$(date +%Y%m%d_%H%M%S)"
sed -i "/^TELEGRAM_GATEWAY_TOKEN=/d; /^TELEGRAM_GATEWAY_SENDER=/d" "$ENV"
printf "\n# Telegram Gateway: коды входа на сайт\nTELEGRAM_GATEWAY_TOKEN=%s\nTELEGRAM_GATEWAY_SENDER=%s\n" "$TOKEN" "$SENDER" >> "$ENV"
echo TOKENOK
'@

Write-Host ''
Write-Host 'Проверяю токен и записываю его на сервер...' -ForegroundColor Cyan
$text = ("$token`n$sender" | ssh $Server $remote 2>&1 | Out-String)
$token = $null
$secure = $null

if ($text -match 'NOENV') {
    Write-Host 'На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh.' -ForegroundColor Red
    exit 1
}
if ($text -match 'BADTOKEN') {
    Write-Host 'Telegram не принял этот токен. Ничего не записано.' -ForegroundColor Red
    Write-Host 'Проверьте токен на gateway.telegram.org и запустите скрипт заново.'
    exit 1
}
if ($text -match 'NOANSWER') {
    Write-Host 'Telegram не ответил. Ничего не записано, попробуйте через минуту.' -ForegroundColor Red
    exit 1
}
if ($text -notmatch 'TOKENOK') {
    Write-Host "Непонятный ответ сервера: $text" -ForegroundColor Red
    exit 1
}

Write-Host 'Готово: Telegram принял токен, токен записан на сервер.' -ForegroundColor Green
Write-Host 'Значение нигде не показывалось и на этом компьютере не сохранено.'
Write-Host 'Напишите в чат «готово» — я установлю обновление и проверю отправку кода.'
