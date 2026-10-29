#!/usr/bin/env bash
# Restauración de un respaldo cifrado en una base NUEVA y verificación de integridad
# (deployment-design §4). Nunca restaura sobre la base en uso.
#
# Uso:
#   RESTORE_TARGET_URL=postgres://quatreros_owner:...@host/quatreros_restore \
#   AGE_IDENTITY_FILE=~/claves/quatreros-backup.key \
#   infrastructure/scripts/restore.sh <archivo.dump.age | s3://.../archivo.dump.age>
set -euo pipefail

src="${1:?Indica el archivo de respaldo}"
: "${RESTORE_TARGET_URL:?Falta RESTORE_TARGET_URL (base vacía de destino)}"
: "${AGE_IDENTITY_FILE:?Falta AGE_IDENTITY_FILE (clave privada age)}"
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

case "$src" in
  s3://*) aws s3 cp "$src" "$tmp/backup.dump.age"; aws s3 cp "$src.sha256" "$tmp/backup.sha256" || true ;;
  *) cp "$src" "$tmp/backup.dump.age"; [ -f "$src.sha256" ] && cp "$src.sha256" "$tmp/backup.sha256" ;;
esac

if [ -f "$tmp/backup.sha256" ]; then
  echo "$(cat "$tmp/backup.sha256")  $tmp/backup.dump.age" | sha256sum --check --quiet
  echo "Suma de verificación correcta"
fi

age --decrypt --identity "$AGE_IDENTITY_FILE" "$tmp/backup.dump.age" > "$tmp/backup.dump"
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_TARGET_URL" "$tmp/backup.dump"
echo "Restauración aplicada. Verificando integridad…"
psql "$RESTORE_TARGET_URL" -v ON_ERROR_STOP=1 -f "$here/verify-integrity.sql"
echo "Listo. Registra el resultado en docs/operations/restore-log.md"
