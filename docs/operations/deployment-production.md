# Despliegue en producción — guía operativa

> **Estado: PROPUESTO, no ejecutado.** Actualizado el 2026-11-03.
> Este documento es el paso a paso. El diseño y las alternativas están en [`deployment-design.md`](../02-architecture/deployment-design.md); los ambientes, en [`environments.md`](environments.md).
>
> **No ejecutes nada de esto todavía.** El despliegue espera a que el acuerdo con el cliente esté pactado y firmado: alcance, precio, forma de pago, mantenimiento e infraestructura.

## 1. Qué se despliega

Un solo contenedor sirve la API y la SPA compilada; la base de datos y las tareas programadas viven al lado.

| Pieza                | Dónde                                          | Qué hace                                             |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Web Service (Docker) | Render                                         | API `/api/v1`, SPA estática, `/health` y `/ready`    |
| PostgreSQL           | Render, misma región                           | Datos reales del cliente                             |
| Cron de retención    | Render Cron                                    | Borra las sesiones de IA según Q-IA-05               |
| Monitor externo      | UptimeRobot                                    | Vigila `/ready` cada 5 minutos                       |
| Agente Quatreros AI  | Anthropic Console, **workspace de producción** | Se publica aparte con `ant apply`, no con `git push` |
| Dominio y TLS        | Render + registrador del dominio               | HTTPS automático                                     |

**No se despliega en Vercel.** El backend es un Express con conexiones persistentes a PostgreSQL, SSE para el asistente, cookies de sesión y trabajos programados. Separar frontend y backend agrega proxy, CORS y riesgo de buffering del SSE sin ningún beneficio para un ERP interno con pocos usuarios. Si más adelante el tráfico lo exige, se evalúa CDN o VPS; hoy no.

## 2. Antes de empezar: lo que falta resolver

Estos puntos **bloquean** un despliegue serio. No son opcionales.

| #   | Pendiente                            | Por qué bloquea                                                                                             |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | Acuerdo firmado con el cliente       | Sin alcance, precio y forma de pago cerrados no se publica nada                                             |
| 2   | CLI del primer administrador         | `seed.js` crea roles y permisos, **no usuarios**. Sin administrador no se puede entrar al sistema           |
| 3   | Respaldo externo operable            | La imagen de ejecución no trae `pg_dump`, `age` ni AWS CLI: `infrastructure/scripts/backup.sh` no corre ahí |
| 4   | Workspace de Anthropic de producción | El lockfile actual es de desarrollo; producción necesita su propia clave, agente y entorno                  |
| 5   | Rotación de la API key de Anthropic  | La clave de desarrollo quedó visible en una salida de terminal; se rota antes de publicar                   |
| 6   | Cuentas a nombre del cliente         | Render, dominio y Anthropic deben quedar en sus cuentas desde el día uno, no migrarse después               |

## 3. Paso 1 — Cuentas y titularidad

El cliente es dueño de lo suyo desde el principio:

1. Crea la cuenta de Render con **su** correo y su método de pago.
2. Compra el dominio en **su** cuenta (o se transfiere antes de publicar).
3. Crea el workspace de Anthropic de producción en **su** organización.
4. El proveedor queda como colaborador con permisos de despliegue.

Esto evita el problema clásico de fin de proyecto: el sistema funciona, pero las cuentas, la facturación y el dominio están a nombre de otra persona.

## 4. Paso 2 — Base de datos

En Render: **New → PostgreSQL**.

| Ajuste  | Valor                                                             |
| ------- | ----------------------------------------------------------------- |
| Nombre  | `quatreros-db`                                                    |
| Región  | La misma del Web Service (normalmente US East, cerca de Colombia) |
| Plan    | Basic 256 MB para el piloto                                       |
| Versión | PostgreSQL 17                                                     |

Guarda dos cadenas:

- **Internal Database URL** → va en `DATABASE_URL` de la API (baja latencia, no sale a internet).
- **External Database URL** → solo para migrar o depurar desde tu equipo.

### Roles (ADR-013)

Lo correcto es que la aplicación use un rol sin DDL (`quatreros_app`) y que solo las migraciones usen el rol dueño (`quatreros_owner`):

```bash
# Con la External Database URL, desde tu equipo
psql "<external-url>" \
  -v owner_pw="'<contraseña-owner>'" -v app_pw="'<contraseña-app>'" -v ro_pw="'<contraseña-ro>'" \
  -v dbname=quatreros -f infrastructure/scripts/db-roles.sql
```

Si el proveedor no permite crear roles sobre la instancia gestionada, hay dos salidas:

- **Aceptar el usuario por defecto** para el piloto y documentar la desviación (es lo más realista).
- **Migrar a un PostgreSQL propio** (VPS o servicio que permita roles) cuando el cliente lo justifique.

Lo que no se hace: usar el usuario administrador de la base en producción sin dejarlo escrito como deuda.

## 5. Paso 3 — Web Service

En Render: **New → Web Service** → repositorio de GitHub.

| Ajuste            | Valor                              |
| ----------------- | ---------------------------------- |
| Runtime           | Docker                             |
| Dockerfile Path   | `infrastructure/docker/Dockerfile` |
| Docker Context    | `.` (raíz del repositorio)         |
| Región            | La misma de la base                |
| Plan              | Starter (512 MB)                   |
| Health Check Path | `/health`                          |
| Auto-Deploy       | Solo desde `main`                  |

La imagen ya compila API y web, y expone el puerto `3000`. El `HEALTHCHECK` del Dockerfile usa `wget` contra `/health`.

## 6. Paso 4 — Variables de entorno

Se configuran en Render, nunca en el repositorio. La API valida al arrancar (`apps/api/src/config/env.ts`) y **no inicia** si falta algo obligatorio.

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://app.tudominio.com
LOG_LEVEL=info
TZ_BUSINESS=America/Bogota

DATABASE_URL=<Internal Database URL>
DATABASE_SSL=true
DATABASE_MIGRATIONS_URL=<External Database URL o Internal>

BETTER_AUTH_SECRET=<openssl rand -base64 32>

ANTHROPIC_API_KEY=<clave del workspace de producción>
ANTHROPIC_AGENT_ID=<agent_id del lockfile de producción>
ANTHROPIC_AGENT_VERSION=<version del lockfile de producción>
ANTHROPIC_ENVIRONMENT_ID=<environment_id del lockfile de producción>
ASSISTANT_SESSION_BUDGET_CENTS=25
```

Reglas que el código hace cumplir:

- `BETTER_AUTH_SECRET` es obligatoria y de mínimo 32 caracteres en `staging` y `production`.
- `APP_BASE_URL` es el **único** origen aceptado para CORS y CSRF. Si el dominio cambia, se actualiza y se vuelve a desplegar.
- `AUTH_RATE_LIMIT_DISABLED` y `AUTH_MFA_ENFORCEMENT_DISABLED` son **rechazadas** en producción. El arranque falla si se intentan usar.
- Los techos de consumo de IA no van aquí: viven en la base (`USD 3/día`, `USD 10/semana`, `USD 30/mes`).
- La clave de Anthropic va **solo** en el servidor: nunca en la web, ni en el repositorio, ni en un mensaje de Telegram.

## 7. Paso 5 — Migraciones y semilla

Desde la **Shell** del servicio en Render (el directorio de trabajo es `/app/apps/api`, donde están `dist/` y `drizzle/`):

```bash
node dist/cli/migrate.js    # aplica migraciones 0000–0030 con el rol dueño
node dist/cli/seed.js       # permisos, roles, flags y consecutivos (idempotente)
```

- `migrate.js` usa `DATABASE_MIGRATIONS_URL` si existe; si no, `DATABASE_URL`.
- `seed.js` es idempotente: se puede correr dos veces sin duplicar.
- **Nunca** ejecutes `seed-demo` en producción: crea usuarios y datos ficticios.
- Cuando las migraciones estén aplicadas, quita `DATABASE_MIGRATIONS_URL` del servicio y vuelve a desplegar, para que la aplicación en ejecución no tenga credenciales de DDL.

## 8. Paso 6 — Primer administrador (pendiente de código)

Hoy **no existe** un comando para esto, y es el hueco más grande del despliegue.

Lo recomendado es agregar `apps/api/src/cli/create-admin.ts` antes de publicar. Debe:

1. Crear el usuario en **Better Auth** (a través de su API, no con SQL suelto: el hash de la contraseña es suyo).
2. Asignar el rol `ADM` y la sede inicial en `admin.users`.
3. Registrar el alta en auditoría.
4. Leer `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` y `ADMIN_SITE` del entorno, sin escribir la contraseña en logs.

```bash
node dist/cli/create-admin.js
```

Por qué no hacerlo a mano: el usuario vive en `auth.user`/`auth.account` con el formato de Better Auth. Insertar filas a mano funciona hasta que cambie una versión del paquete o se rompa el hash, y entonces nadie puede entrar.

Después del primer ingreso, el administrador **debe enrolar el segundo factor** (TOTP): los roles sensibles lo exigen y no hay forma de saltarlo en producción.

## 9. Paso 7 — Agente de IA de producción

Es una publicación independiente del backend. `git push` no actualiza el agente.

```bash
cd quatreros-ai
export ANTHROPIC_API_KEY='<clave del workspace de producción>'
ant auth status                                  # debe mostrar la clave correcta
ant apply --dry-run --lock-file claude-lock.production.json .
ant apply --lock-file claude-lock.production.json .
```

Eso crea el agente y el entorno en el workspace de producción y escribe `claude-lock.production.json`. De ahí salen `ANTHROPIC_AGENT_ID`, `ANTHROPIC_AGENT_VERSION` y `ANTHROPIC_ENVIRONMENT_ID`.

- No edites el lockfile a mano.
- El lockfile **sí** se versiona; la clave **no**.
- Orden al cambiar herramientas: primero el manejador en el backend, después `ant apply`. Al quitarlas, al revés.
- Activa el complemento en la aplicación: **Sistema → Actividad de IA**, y verifica los techos de consumo.

## 10. Paso 8 — Cron de retención

En Render: **New → Cron Job**, con la **misma imagen** y el mismo repositorio.

| Ajuste    | Valor                                               |
| --------- | --------------------------------------------------- |
| Comando   | `node dist/cli/assistant-retention.js`              |
| Horario   | `0 3 * * *`                                         |
| Zona      | `America/Bogota`                                    |
| Variables | `DATABASE_URL`, `DATABASE_SSL`, `ANTHROPIC_API_KEY` |

Qué hace: archiva en Anthropic las sesiones de más de 24 horas y borra los datos asociados a los 30 días. Los tickets y las métricas se conservan (DEC-108).

El cron **no** corre en Vercel ni en un monitor de disponibilidad. Sin este trabajo, la política de retención no se cumple.

## 11. Paso 9 — Respaldos

La base paga de Render trae respaldos lógicos y PITR. Eso cubre el error reciente, pero no la pérdida del proveedor. La regla del proyecto (RNF-043) pide un `pg_dump` cifrado fuera del proveedor.

Hoy la imagen de ejecución **no** puede hacerlo: no trae `pg_dump`, `age` ni AWS CLI. Dos caminos:

1. **Ampliar la imagen** de ejecución con `postgresql-client`, `age` y `aws-cli`, y programar `infrastructure/scripts/backup.sh` como cron. Es lo definitivo.
2. **Ejecutar el respaldo fuera**, desde un equipo o un GitHub Action programado, con la URL externa. Es más rápido de montar y sirve para el piloto.

En ambos casos:

- La clave privada de `age` **nunca** vive en el servidor: se guarda fuera del proveedor.
- Se registra la primera restauración de prueba en [`restore-log.md`](restore-log.md) antes de dar el sistema por entregado.
- Los objetivos son RPO ≤ 24 h y RTO ≤ 4 h (PENDING P-12).

## 12. Paso 10 — Dominio, TLS y correo

1. Apunta el dominio al servicio de Render; Render emite y renueva el certificado solo.
2. Actualiza `APP_BASE_URL` con el dominio final y vuelve a desplegar. Si no, CORS y CSRF rechazan el origen.
3. El correo transaccional (`MAIL_PROVIDER_API_KEY`, `MAIL_FROM`) es opcional hoy: **no hay flujo de restablecimiento de contraseña** (Q-C-07). Si el cliente olvida su clave, se resuelve a mano. Conviene decidirlo antes de entregar.

## 13. Paso 11 — Monitoreo

| Qué                     | Cómo                                                         |
| ----------------------- | ------------------------------------------------------------ |
| Disponibilidad con base | UptimeRobot → `https://tu-dominio/ready` cada 5 minutos      |
| Vida del proceso        | `/health` (lo usa también el health check de Render)         |
| Errores 5xx             | Logs del proveedor; alerta si supera el 5 % en 5 minutos     |
| Consumo de IA           | Pantalla de consumo en la aplicación; alerta al 80 % y 100 % |

`/health` solo dice que el proceso responde. **`/ready` consulta PostgreSQL**: es el que hay que vigilar y el que sirve para mantener despierto un servicio gratuito.

## 14. Verificación de humo

Antes de decir "está en producción", recorre esta lista en orden. Si algo falla, no se anuncia la entrega.

- [ ] `/ready` responde `200` con `{"checks":{"database":"ok"}}`.
- [ ] El administrador puede ingresar y **enrola TOTP** en el primer acceso.
- [ ] Crear una sede, un usuario y asignarle rol y sede.
- [ ] Crear un producto fabricado con presentación y precio.
- [ ] Registrar una compra y recibirla: se crea el lote `MP-AAAA-####`.
- [ ] Planificar una orden de producción, consumir y cerrar: se crea el lote `PT-AAAA-####`.
- [ ] Abrir turno de caja, vender con pago mixto y cerrar con arqueo.
- [ ] Confirmar un pedido, despacharlo y registrar la entrega desde el portal de ruta.
- [ ] Ver un abono en cartera y exportar el CSV.
- [ ] Revisar el kardex y que el saldo cuadre con los movimientos.
- [ ] Consultar al asistente y recibir respuesta con permisos y sede correctos.
- [ ] Enviar una propuesta de escritura y **rechazarla**: no debe ejecutarse nada.
- [ ] Dejar la sesión inactiva 30 minutos y comprobar `401 SESSION_EXPIRED`.
- [ ] Verificar que la auditoría registró las operaciones del día.

## 15. Handoff y rotación de llaves

Al cerrar la entrega:

1. Transferir o confirmar la titularidad: repositorio, Render, dominio, workspace de Anthropic, base de datos.
2. Rotar todas las llaves de producción y entregarlas por un canal seguro, no por chat.
3. Entregar el acceso al repositorio y la documentación.
4. Registrar en el acta qué queda incluido en el mantenimiento y qué se cotiza aparte.
5. Conservar una **demo de portafolio aparte**: otra base, otra API key y datos ficticios. Nunca la misma infraestructura del cliente.

## 16. Costos mensuales

| Concepto                   | Estimado                          |
| -------------------------- | --------------------------------- |
| Render Web Service Starter | USD 7                             |
| PostgreSQL Basic 256 MB    | USD 6                             |
| Cron de retención          | ≈ USD 1–7 según ejecución         |
| UptimeRobot                | USD 0                             |
| Dominio                    | ≈ USD 1/mes prorrateado           |
| Anthropic                  | Variable, con techo de USD 30/mes |
| **Total núcleo**           | **≈ USD 15–21/mes sin IA**        |

Verifica los precios en la página del proveedor el día de la contratación: cambian sin aviso. Si la base se queda corta de memoria, subir a 1 GB agrega unos USD 13/mes.

## 17. Reversión

- **Si el despliegue nuevo falla:** volver a la imagen anterior en Render; el tráfico regresa en segundos.
- **Si falla una migración:** se aplicó antes de arrancar, así que la versión anterior sigue en pie. Las migraciones de contracción solo se aplican cuando la versión nueva lleva días estable.
- **Si se corrompen datos:** restaurar el último `pg_dump` verificado o usar PITR al instante previo, y registrar el incidente en `restore-log.md`.

## 18. Lo que no se hace

- No desplegar sin acuerdo firmado y sin primer administrador operativo.
- No ejecutar `seed-demo` ni `db:reset:demo` en producción.
- No reutilizar la API key de desarrollo ni el `claude-lock.json` de desarrollo.
- No publicar la base ni las llaves del cliente en la demo de portafolio.
- No activar `AUTH_RATE_LIMIT_DISABLED` ni `AUTH_MFA_ENFORCEMENT_DISABLED`: el arranque las rechaza.
- No separar frontend y backend entre Vercel y Render sin probar login, cookies y SSE antes.
- No declarar la entrega terminada sin recorrer la verificación de humo completa.
