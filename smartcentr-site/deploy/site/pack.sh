#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# Упаковка сайта для сервера — версия для Mac.
# То же, что deploy/site/pack.ps1 для Windows: собирает smartcentr-site.tar.gz
# в папке проекта. Берётся только то, что нужно для сборки сайта — без
# node_modules, .next, секретов и рабочих материалов.
#
# Запуск (Терминал, из папки проекта):
#   bash deploy/site/pack.sh
# ════════════════════════════════════════════════════════════════════════════
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
OUT="$ROOT/smartcentr-site.tar.gz"
rm -f "$OUT"

INCLUDE="src public scripts/sync-catalog.mjs deploy/site package.json package-lock.json next.config.ts tsconfig.json next-env.d.ts Dockerfile .dockerignore .env.example"

for f in $INCLUDE; do
    [ -e "$f" ] || { echo "❌ Нет файла: $f"; exit 1; }
done

# COPYFILE_DISABLE: иначе macOS кладёт в архив свои служебные файлы ._имя,
# и сборка на сервере спотыкается о них.
COPYFILE_DISABLE=1 tar -czf "$OUT" \
    --exclude='public/Бренд лого' \
    --exclude='*.log' \
    --exclude='__pycache__' \
    $INCLUDE

SIZE=$(du -m "$OUT" | cut -f1)
echo "Готово: $OUT (${SIZE} МБ)"
echo "Дальше:"
echo "  scp smartcentr-site.tar.gz root@145.223.100.16:/tmp/"
echo "  scp deploy/site/update_site.sh root@145.223.100.16:/tmp/"
echo "  ssh root@145.223.100.16 \"bash /tmp/update_site.sh\""
