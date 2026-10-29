# Registro de pruebas de restauración

| Fecha      | Ambiente        | Respaldo usado                                                            | Resultado                                     | Tiempo  | Responsable | Notas                                                                                                                      |
| ---------- | --------------- | ------------------------------------------------------------------------- | --------------------------------------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-29 | Local (Etapa F) | `quatreros-daily-20261029T174056Z.dump.age` (PostgreSQL 16, esquema base) | ✅ Suma verificada, restaurado, integridad OK | < 1 min | Equipo      | Validación de los scripts `backup.sh` / `restore.sh` con datos de plataforma; repetir con datos reales al entrar en piloto |
