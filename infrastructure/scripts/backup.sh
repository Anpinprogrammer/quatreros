#!/usr/bin/env bash
# Respaldo lógico cifrado de PostgreSQL (deployment-design §4, RNF-041..045).
#
# Uso:
#   BACKUP_DATABASE_URL=postgres://quatreros_readonly:...@host/db \
#   BACKUP_AGE_RECIPIENT=age1...                                  \
#   BACKUP_DEST=s3://quatreros-backups          # o una carpeta local: ./backups
#   infrastructure/scripts/backup.sh
#
# Requisitos: pg_dump (misma versión mayor que el servidor), age; para s3:// el CLI de AWS
# configurado contra Cloudflare R2 (AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
# La clave PRIVADA de age nunca vive en el servidor: se guarda fuera del proveedor (security-design §7).
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL}"
: "${BACKUP_AGE_RECIPIENT:?Falta BACKUP_AGE_RECIPIENT (clave pública age)}"
: "${BACKUP_DEST:?Falta BACKUP_DEST (s3://bucket o carpeta local)}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
weekday="$(date -u +%u)"   # 7 = domingo
day="$(date -u +%d)"
tier="daily"
[ "$weekday" = "7" ] && tier="weekly"
[ "$day" = "01" ] && tier="monthly"
file="quatreros-${tier}-${stamp}.dump.age"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Respaldando ($tier) → $file"
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" > "$tmp/$file"

sha256sum "$tmp/$file" | awk '{print $1}' > "$tmp/$file.sha256"

case "$BACKUP_DEST" in
  s3://*)
    aws s3 cp "$tmp/$file" "$BACKUP_DEST/$tier/$file"
    aws s3 cp "$tmp/$file.sha256" "$BACKUP_DEST/$tier/$file.sha256"
    ;;
  *)
    mkdir -p "$BACKUP_DEST/$tier"
    cp "$tmp/$file" "$tmp/$file.sha256" "$BACKUP_DEST/$tier/"
    ;;
esac
echo "Respaldo completo: $BACKUP_DEST/$tier/$file"
# La retención (7 diarios, 4 semanales, 6 mensuales) se configura con reglas de ciclo de vida del bucket.
