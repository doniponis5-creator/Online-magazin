# ════════════════════════════════════════════════════════════════════════════
# Файлы Firebase для push-уведомлений на Android — версия для Windows.
# То же, что scripts/setup-fcm.sh для Mac. Инструкция: docs/ANDROID_PUSH_UZ.md
#
# Запуск (PowerShell, из папки проекта):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-fcm.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-fcm.ps1 -Check
#     (-Check — только проверить файлы: ничего не отправляет и не копирует)
#
# Нужны два файла из Firebase, скрипт сам ищет их в «Загрузках»:
#   • google-services.json — «паспорт» приложения, кладём в android\app\.
#     Не секрет: он и так лежит внутри каждой сборки для Google Play.
#   • ключ сервисного аккаунта (…firebase-adminsdk….json) — секрет. Уходит на
#     сервер через stdin: на экран не выводится, в историю команд не попадает.
# Пароль сервера спрашивает ssh; скрипт его не видит.
#
# Порядок «всё или ничего»: сначала проверяем оба файла, потом сервер пишет
# ключ, и только после его «FCMOK» кладём google-services.json в проект.
# ════════════════════════════════════════════════════════════════════════════
param(
    [switch]$Check,
    [string]$GoogleServices = '',
    [string]$KeyFile = ''
)
$ErrorActionPreference = 'Stop'
$Server = 'root@145.223.100.16'
$Package = 'kg.smarket.app'
$RemoteScript = Join-Path $PSScriptRoot 'fcm-remote.sh'
$Dest = Join-Path (Split-Path $PSScriptRoot -Parent) 'android\app\google-services.json'
$Nothing = 'Ничего не записано.'

function Fail($text) {
    Write-Host $text -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $RemoteScript)) { Fail "Не найден $RemoteScript — обновите проект из git." }

Write-Host 'Firebase push для Android — настройка' -ForegroundColor Cyan

# Самый свежий файл по шаблону в «Загрузках»: браузер при повторном
# скачивании пишет «google-services (1).json», и нужен последний.
function Find-Newest($pattern) {
    $dirs = @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Загрузки'))
    $file = Get-ChildItem -Path $dirs -Filter $pattern -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($file) { return $file.FullName }
    return ''
}

# Спросить файл: найденный берём по Enter, иначе — перетащить в окно.
function Select-File($found, $what) {
    $Host.UI.RawUI.FlushInputBuffer()
    if ($found) {
        Write-Host "Нашёл ${what}: $found"
        $answer = (Read-Host 'Использовать его? Enter — да, или перетащите сюда другой файл').Trim()
        # «да», «yes», «ha» — это согласие, а не путь к файлу.
        if ($answer -eq '' -or $answer -match '^(да|д|yes|y|ha|ok)$') { return $found }
    } else {
        $answer = (Read-Host "Перетащите сюда $what и нажмите Enter").Trim()
    }
    # Перетаскивание в окно добавляет кавычки вокруг пути с пробелами.
    return $answer.Trim('"').Trim("'")
}

# JSON-объект из файла или $null, если это не JSON-объект.
function Read-Json($path) {
    try {
        $data = [System.IO.File]::ReadAllText($path) | ConvertFrom-Json
    } catch {
        return $null
    }
    if ($data -is [System.Management.Automation.PSCustomObject]) { return $data }
    return $null
}

function Text($value) {
    if ($value -is [string]) { return $value.Trim() }
    return ''
}

# 1. Два файла
$GsPath = $GoogleServices
if (-not $GsPath) { $GsPath = Select-File (Find-Newest 'google-services*.json') 'файл google-services.json' }
if (-not (Test-Path $GsPath -PathType Leaf)) { Fail "Файл не найден: $GsPath" }

$SaPath = $KeyFile
if (-not $SaPath) { $SaPath = Select-File (Find-Newest '*firebase-adminsdk*.json') 'ключ сервисного аккаунта (…firebase-adminsdk….json)' }
if (-not (Test-Path $SaPath -PathType Leaf)) { Fail "Файл не найден: $SaPath" }

# 2. Проверка — те же правила и те же слова, что в setup-fcm.sh.
$gs = Read-Json $GsPath
if ($null -eq $gs) { Fail "«$GsPath» не читается как JSON — это не google-services.json. Скачайте его в Firebase заново. $Nothing" }
if ($gs.type -eq 'service_account') { Fail "Файлы перепутаны: вместо google-services.json дан ключ сервисного аккаунта. $Nothing" }
$gsProject = Text $gs.project_info.project_id
if (-not $gsProject -or -not $gs.client) {
    Fail "«$GsPath» не похож на google-services.json. Он скачивается в Firebase у Android-приложения (Настройки проекта → Ваши приложения). $Nothing"
}
$packages = @($gs.client | ForEach-Object { Text $_.client_info.android_client_info.package_name } | Where-Object { $_ })
if ($packages -notcontains $Package) {
    $inFile = if ($packages.Count) { $packages -join ', ' } else { 'пусто' }
    Fail "В google-services.json нет приложения $Package (в файле: $inFile). Добавьте в Firebase Android-приложение с именем пакета $Package и скачайте файл заново. $Nothing"
}

# Ключ читаем так же строго, как сервер (shop_push_fcm.load_account): байты —
# строгий UTF-8, битый байт — ошибка, а не «?» на его месте. BOM в начале сервер
# не принимает — пропускаем его здесь, и на сервер уходят те же байты без BOM:
# «подходит» здесь ⇔ сервер этот ключ прочтёт.
$SaBytes = [System.IO.File]::ReadAllBytes($SaPath)
$SaSkip = 0
if ($SaBytes.Length -ge 3 -and $SaBytes[0] -eq 0xEF -and $SaBytes[1] -eq 0xBB -and $SaBytes[2] -eq 0xBF) { $SaSkip = 3 }
$sa = $null
try {
    $strict = New-Object System.Text.UTF8Encoding $false, $true
    $sa = $strict.GetString($SaBytes, $SaSkip, $SaBytes.Length - $SaSkip) | ConvertFrom-Json
} catch {
    $sa = $null
}
if (-not ($sa -is [System.Management.Automation.PSCustomObject])) { $sa = $null }
if ($null -eq $sa) { Fail "Ключ «$SaPath» не читается как JSON. Создайте ключ заново: Сервисные аккаунты → Создать закрытый ключ. $Nothing" }
if ($sa.project_info -and $sa.client) { Fail "Файлы перепутаны: вместо ключа сервисного аккаунта дан google-services.json. $Nothing" }
if ($sa.type -ne 'service_account') {
    Fail "Это не ключ сервисного аккаунта Firebase. Нужен файл …firebase-adminsdk….json: Настройки проекта → Сервисные аккаунты → Создать закрытый ключ. $Nothing"
}
foreach ($field in 'project_id', 'private_key', 'client_email') {
    if (-not (Text $sa.$field)) {
        Fail "В ключе нет поля «$field» — файл неполный. Создайте ключ заново: Сервисные аккаунты → Создать закрытый ключ. $Nothing"
    }
}
if ((Text $sa.private_key) -notmatch 'PRIVATE KEY') {
    Fail "В ключе нет поля «private_key» — файл неполный. Создайте ключ заново: Сервисные аккаунты → Создать закрытый ключ. $Nothing"
}
$saProject = Text $sa.project_id
if ($saProject -ne $gsProject) {
    Fail "Файлы из разных проектов Firebase: google-services.json — «$gsProject», ключ — «$saProject». Скачайте оба в одном проекте. $Nothing"
}
$sa = $null
Write-Host "Оба файла подходят: проект Firebase «$gsProject», приложение $Package." -ForegroundColor Green

if ($Check) {
    Write-Host 'Это была только проверка: на сервер ничего не отправлено, в проект ничего не скопировано.'
    exit 0
}

# 3. Ключ — на сервер, в base64: так переносы строк не портятся по дороге.
# Те самые байты, что проверены выше, уже без BOM.
$KeyB64 = [Convert]::ToBase64String($SaBytes, $SaSkip, $SaBytes.Length - $SaSkip)
$SaBytes = $null

# Серверную часть кладём отдельным файлом. Windows-переводы строк bash
# не понимает, поэтому убираем CR. Секретов в этом файле нет — ключ идёт в stdin.
$tmp = [System.IO.Path]::GetTempFileName()
$body = [System.IO.File]::ReadAllText($RemoteScript) -replace "`r", ''
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Записываю ключ на сервер...' -ForegroundColor Cyan
scp -q $tmp "${Server}:/tmp/fcm_setup.sh"
$scpCode = $LASTEXITCODE
Remove-Item $tmp -Force
if ($scpCode -ne 0) { Fail "Не удалось подключиться к серверу. $Nothing" }
$text = ($KeyB64 | ssh $Server 'bash /tmp/fcm_setup.sh; rm -f /tmp/fcm_setup.sh' | Out-String)
$KeyB64 = $null

if ($text -match 'NOENV') { Fail "На сервере нет /opt/sbonus/.env.production — сначала нужен deploy_shop.sh. $Nothing" }
if ($text -match 'BADJSON') { Fail "Сервер не смог прочитать ключ — файл испортился по дороге. Запустите скрипт ещё раз. $Nothing" }
if ($text -match 'NOTSA') { Fail "Сервер говорит: это не ключ сервисного аккаунта. $Nothing" }
if ($text -match 'NOPY') { Fail "На сервере нет python3 — ключ нечем проверить. $Nothing" }
if ($text -match 'NOBAK') { Fail "Сервер не смог сделать резервную копию .env.production. $Nothing" }
if ($text -notmatch 'FCMOK') {
    if (-not $text.Trim()) { Fail "Сервер не ответил (связь оборвалась или не тот пароль). $Nothing" }
    Fail "Непонятный ответ сервера: $text"
}
Write-Host 'Ключ Firebase записан на сервер (FCM_SERVICE_ACCOUNT_B64), старый .env.production сохранён рядом.'

# 4. google-services.json — в Android-проект.
Copy-Item -LiteralPath $GsPath -Destination $Dest -Force
Write-Host 'google-services.json положен в android\app\.'

Write-Host ''
Write-Host 'Готово. Ключ нигде не показывался и на этом компьютере не сохранён.' -ForegroundColor Green
Write-Host 'Файл ключа из «Загрузок» можно удалить: он уже на сервере, а новый всегда можно создать в Firebase.'
Write-Host 'google-services.json нужно сохранить в git (это не секрет) — напишите в чат «готово»'
Write-Host 'или сами: git add android/app/google-services.json; git commit -m "android: google-services.json"'
Write-Host 'Дальше — три команды из docs/ANDROID_PUSH_UZ.md (раздел 6): сервер, сайт, Android.'
