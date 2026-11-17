#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test "$#" -eq 2 && test "$2" = '--replace-database' || { echo 'Aufruf: scripts/restore.sh backups/DATEI.dump --replace-database'; exit 1; }
test -f "$1"
docker compose stop worker web
docker compose exec -T db pg_restore -U newsdeck -d newsdeck --clean --if-exists --single-transaction < "$1"
docker compose start web worker
echo 'Wiederherstellung abgeschlossen.'
