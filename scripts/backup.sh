#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/newsdeck-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_dump -U newsdeck -d newsdeck -Fc > "$file"
test -s "$file"
echo "Backup: $file"
