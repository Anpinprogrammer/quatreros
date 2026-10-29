# Respaldo y restauración

Diseño: `docs/02-architecture/deployment-design.md` §4. Objetivos propuestos (PENDING Q-C-02): RPO ≤ 24 h con respaldo externo; RTO ≤ 4 h.

## Capas

1. **PITR del proveedor** (propuesto: 3 días en Render).
2. **Respaldo lógico diario cifrado** fuera del proveedor: `infrastructure/scripts/backup.sh` → R2 (bucket y credenciales distintos a los de la aplicación). Clasifica en `daily/`, `weekly/` (domingo) y `monthly/` (día 1); la retención (7/4/6) se aplica con reglas de ciclo de vida del bucket.
3. **Prueba de restauración trimestral** registrada en [`restore-log.md`](restore-log.md).

## Respaldar

```bash
BACKUP_DATABASE_URL=postgres://quatreros_readonly:...@host/quatreros \
BACKUP_AGE_RECIPIENT=age1... \
BACKUP_DEST=s3://quatreros-backups \
infrastructure/scripts/backup.sh
```

Requiere `pg_dump` de la **misma versión mayor** que el servidor (el script se detiene si no coinciden), `age` y, para `s3://`, el CLI de AWS apuntando a R2.

## Restaurar (siempre en una base nueva)

```bash
createdb -O quatreros_owner quatreros_restore
RESTORE_TARGET_URL=postgres://quatreros_owner:...@host/quatreros_restore \
AGE_IDENTITY_FILE=~/claves/quatreros-backup.key \
infrastructure/scripts/restore.sh s3://quatreros-backups/daily/quatreros-daily-AAAAMMDDTHHMMSSZ.dump.age
```

El script verifica la suma SHA-256, descifra, restaura y ejecuta `verify-integrity.sql` (migraciones, auditoría protegida, saldos vs. kardex y asientos balanceados cuando esos módulos existan). Después se apunta `DATABASE_URL` a la base restaurada y se registra el incidente.

## Generar el par de claves de respaldo

```bash
age-keygen -o quatreros-backup.key    # PRIVADA: guardar fuera del hosting
grep 'public key' quatreros-backup.key  # PÚBLICA: va en BACKUP_AGE_RECIPIENT
```
