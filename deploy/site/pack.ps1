# Упаковка сайта для сервера: smartcentr-site.tar.gz в папке проекта.
# Берётся только то, что нужно для сборки сайта (без node_modules, .next, секретов и рабочих материалов).
# Запуск: powershell -ExecutionPolicy Bypass -File deploy\site\pack.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root
$Out = Join-Path $Root 'smartcentr-site.tar.gz'
if (Test-Path $Out) { Remove-Item $Out -Force }

# Что нужно сайту: код, публичные файлы, скрипт синхронизации каталога и файлы сборки.
$include = @(
  'src', 'public', 'scripts/sync-catalog.mjs', 'deploy/site',
  'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts',
  'Dockerfile', '.dockerignore', '.env.example'
)
$missing = $include | Where-Object { -not (Test-Path $_) }
if ($missing) { throw "Нет файлов: $($missing -join ', ')" }

$tarArgs = @('-czf', $Out, '--exclude=public/Бренд лого', '--exclude=*.log', '--exclude=__pycache__') + $include
& tar.exe @tarArgs
if ($LASTEXITCODE -ne 0) { throw "tar завершился с ошибкой $LASTEXITCODE" }

$size = [math]::Round((Get-Item $Out).Length / 1MB, 1)
Write-Host "Готово: $Out ($size МБ)" -ForegroundColor Green
Write-Host 'Дальше:'
Write-Host '  scp smartcentr-site.tar.gz root@145.223.100.16:/tmp/'
Write-Host '  scp deploy/site/install_site.sh root@145.223.100.16:/tmp/'
Write-Host '  ssh -t root@145.223.100.16 "bash /tmp/install_site.sh"'
